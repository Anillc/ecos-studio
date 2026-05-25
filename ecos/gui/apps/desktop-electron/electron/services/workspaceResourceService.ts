import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  WorkspaceResourceFile,
  WorkspaceResourceIndex,
  WorkspaceResourceStatus,
  WorkspaceStepInfoRequest,
  WorkspaceStepInfoResult,
  WorkspaceStepResource,
} from '@ecos-studio/shared'
import type { ProjectScopeProvider } from './workspaceService'

type WorkspaceResourceFileKind = WorkspaceResourceFile['kind']
type ResourceBucketName = keyof WorkspaceStepResource['resources']
type StepFileBuckets = WorkspaceStepResource['resources']

interface WorkspaceResourceServiceOptions {
  projectScopeProvider: Pick<ProjectScopeProvider, 'getProjectRoot' | 'requestProjectPathAccess'>
}

interface FlowStepInput {
  name: string
  tool: string
  state: string
  runtime: string
  info: Record<string, unknown>
}

interface IndexBuildResult {
  index: WorkspaceResourceIndex
  statErrors: string[]
}

export class WorkspaceResourceService {
  private readonly projectScopeProvider: WorkspaceResourceServiceOptions['projectScopeProvider']

  constructor(options: WorkspaceResourceServiceOptions) {
    this.projectScopeProvider = options.projectScopeProvider
  }

  async getIndex(): Promise<WorkspaceResourceIndex> {
    const { index } = await this.buildIndex()
    return index
  }

  async readHome(): Promise<Record<string, unknown> | null> {
    return await this.readJsonOrNull(join(await this.projectScopeProvider.getProjectRoot(), 'home', 'home.json'))
  }

  async readFlow(): Promise<Record<string, unknown> | null> {
    return await this.readJsonOrNull(join(await this.projectScopeProvider.getProjectRoot(), 'home', 'flow.json'))
  }

  async readParameters(): Promise<Record<string, unknown> | null> {
    return await this.readJsonOrNull(
      join(await this.projectScopeProvider.getProjectRoot(), 'home', 'parameters.json'),
    )
  }

  async resolveStepInfo(request: WorkspaceStepInfoRequest): Promise<WorkspaceStepInfoResult> {
    try {
      const { index, statErrors } = await this.buildIndex()
      if (index.status === 'error') {
        return {
          step: request.step,
          id: request.id,
          response: 'error',
          info: {},
          missing: [],
          message: index.messages,
        }
      }

      const step = index.flow.steps.find((candidate) =>
        candidate.name.toLocaleLowerCase() === request.step.toLocaleLowerCase(),
      )
      if (!step) {
        return {
          step: request.step,
          id: request.id,
          response: 'missing',
          info: {},
          missing: [],
          message: [`Workspace step not found: ${request.step}`, ...statErrors],
        }
      }

      const info = this.buildStepInfoResponse(request.id, step)
      const requiredFiles = this.requiredFilesForStepInfo(request.id, step)
      const missing = requiredFiles.filter((file) => !file.exists).map((file) => file.path)
      const response = statErrors.length > 0 ? 'error' : missing.length > 0 ? 'missing' : 'available'

      return {
        step: step.name,
        id: request.id,
        response,
        info,
        missing,
        message: statErrors,
      }
    } catch (error) {
      return {
        step: request.step,
        id: request.id,
        response: 'error',
        info: {},
        missing: [],
        message: [formatErrorMessage('Failed to resolve workspace step info', error)],
      }
    }
  }

  private async buildIndex(): Promise<IndexBuildResult> {
    const root = await this.projectScopeProvider.getProjectRoot()
    const messages: string[] = []
    const statErrors: string[] = []
    const homePath = join(root, 'home', 'home.json')
    const flowPath = join(root, 'home', 'flow.json')
    const parametersPath = join(root, 'home', 'parameters.json')
    const checklistPath = join(root, 'home', 'checklist.json')

    const [homeJson, flowJson, parametersJson, checklistJson] = await Promise.all([
      this.describeFile(homePath, 'home', statErrors),
      this.describeFile(flowPath, 'flow', statErrors),
      this.describeFile(parametersPath, 'parameters', statErrors),
      this.describeFile(checklistPath, 'checklist', statErrors),
    ])

    const homeData = await this.readJsonForIndex(homePath, messages)
    const parameters = await this.readJsonForIndex(parametersPath, messages)
    const flowData = await this.readJsonForIndex(flowPath, messages)

    if (!parametersJson.exists) messages.push(`Missing workspace parameters: ${parametersPath}`)
    if (!flowJson.exists) messages.push(`Missing workspace flow: ${flowPath}`)

    const design = stringValue(parameters, 'Design')
    const topModule = stringValue(parameters, 'Top module')
    const pdk = stringValue(parameters, 'PDK')
    const steps = isRecord(flowData) && Array.isArray(flowData.steps)
      ? flowData.steps.map(readFlowStep).filter((step): step is FlowStepInput => step !== null)
      : []
    const flowSteps = await Promise.all(
      steps.map((step) => this.buildStepResource(root, design, topModule, step, statErrors)),
    )
    const status = resolveIndexStatus({
      messages,
      statErrors,
      parametersExists: parametersJson.exists,
      flowExists: flowJson.exists,
    })

    return {
      index: {
        root,
        design,
        topModule,
        pdk,
        home: {
          homeJson,
          flowJson,
          parametersJson,
          checklistJson,
        },
        homeData,
        parameters,
        flow: {
          steps: flowSteps,
        },
        status,
        messages: [...messages, ...statErrors],
      },
      statErrors,
    }
  }

  private async buildStepResource(
    root: string,
    design: string,
    topModule: string,
    step: FlowStepInput,
    errors: string[],
  ): Promise<WorkspaceStepResource> {
    const tool = step.tool || 'unknown'
    const directory = join(root, `${step.name}_${tool}`)
    const resources = createEmptyBuckets()
    const toolKey = tool.toLocaleLowerCase()

    if (toolKey === 'yosys') {
      addYosysResources(resources, root, directory, design, step.name)
    } else if (toolKey === 'ecc') {
      addEccLikeResources(resources, directory, design, topModule, step.name)
    } else if (toolKey === 'dreamplace') {
      addEccLikeResources(resources, directory, design, topModule, step.name)
      resources.config.dreamplace = createFile(join(root, 'config', 'dreamplace.json'), 'config')
    } else {
      addUnknownResources(resources, directory, step.name)
    }

    await this.describeBuckets(resources, errors)

    return {
      name: step.name,
      tool,
      state: step.state,
      runtime: step.runtime,
      directory,
      info: step.info,
      resources,
    }
  }

  private async describeBuckets(resources: StepFileBuckets, errors: string[]): Promise<void> {
    const files = collectFiles(resources)
    await Promise.all(files.map(async (file) => {
      const described = await this.describeFile(file.path, file.kind, errors)
      Object.assign(file, described)
    }))
  }

  private async describeFile(
    path: string,
    kind: WorkspaceResourceFileKind,
    errors: string[],
  ): Promise<WorkspaceResourceFile> {
    try {
      const canonicalPath = await this.projectScopeProvider.requestProjectPathAccess(path)
      const fileStats = await stat(canonicalPath)
      return {
        path: canonicalPath,
        exists: true,
        kind,
        sizeBytes: fileStats.size,
        mtimeMs: fileStats.mtimeMs,
      }
    } catch (error) {
      if (isNodeErrorWithCode(error, 'ENOENT')) {
        return { path, exists: false, kind }
      }

      errors.push(formatErrorMessage(`Failed to stat workspace resource: ${path}`, error))
      return { path, exists: false, kind }
    }
  }

  private async readJsonForIndex(
    path: string,
    messages: string[],
  ): Promise<Record<string, unknown> | null> {
    try {
      return await this.readJsonOrNull(path)
    } catch (error) {
      messages.push(formatErrorMessage(`Failed to parse workspace JSON: ${path}`, error))
      return null
    }
  }

  private async readJsonOrNull(path: string): Promise<Record<string, unknown> | null> {
    try {
      const canonicalPath = await this.projectScopeProvider.requestProjectPathAccess(path)
      const raw = await readFile(canonicalPath, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      return isRecord(parsed) ? parsed : {}
    } catch (error) {
      if (isNodeErrorWithCode(error, 'ENOENT')) {
        return null
      }

      throw error
    }
  }

  private buildStepInfoResponse(
    id: WorkspaceStepInfoRequest['id'],
    step: WorkspaceStepResource,
  ): Record<string, unknown> {
    switch (id) {
      case 'layout':
        return {
          image: step.resources.output.image?.path,
          json: step.resources.output.json?.path,
        }
      case 'views':
        return {
          image: step.resources.output.image?.path,
          json: step.resources.output.json?.path,
          metrics: step.resources.analysis.metrics?.path,
          information: {},
        }
      case 'metrics':
        return { metrics: step.resources.analysis.metrics?.path }
      case 'subflow':
        return { path: step.resources.subflow.path?.path }
      case 'analysis':
        return buildAnalysisInfo(step)
      case 'checklist':
        return { path: step.resources.checklist.path?.path }
      case 'config':
        return buildConfigInfo(step)
      case 'maps':
        return step.resources.feature.map?.exists ? { map: step.resources.feature.map.path } : {}
      case 'sta':
        return { sta: nestedResourcePaths(step.resources.report.sta) }
    }
  }

  private requiredFilesForStepInfo(
    id: WorkspaceStepInfoRequest['id'],
    step: WorkspaceStepResource,
  ): WorkspaceResourceFile[] {
    switch (id) {
      case 'layout':
        return existingResourceRefs([step.resources.output.image, step.resources.output.json])
      case 'views':
        return existingResourceRefs([
          step.resources.output.image,
          step.resources.output.json,
          step.resources.analysis.metrics,
        ])
      case 'metrics':
        return existingResourceRefs([step.resources.analysis.metrics])
      case 'subflow':
        return existingResourceRefs([step.resources.subflow.path])
      case 'analysis':
        return analysisFiles(step)
      case 'checklist':
        return existingResourceRefs([step.resources.checklist.path])
      case 'config':
        return configFiles(step)
      case 'maps':
        return step.resources.feature.map ? [step.resources.feature.map] : []
      case 'sta':
        return resourceRecordValues(step.resources.report.sta)
    }
  }
}

function createFile(path: string, kind: WorkspaceResourceFileKind): WorkspaceResourceFile {
  return { path, exists: false, kind }
}

function createEmptyBuckets(): StepFileBuckets {
  return {
    output: {},
    data: {},
    feature: {},
    report: {},
    log: {},
    script: {},
    analysis: {},
    subflow: {},
    checklist: {},
    config: {},
  }
}

function addEccLikeResources(
  resources: StepFileBuckets,
  directory: string,
  design: string,
  topModule: string,
  stepName: string,
): void {
  resources.output.dir = createFile(join(directory, 'output'), 'output')
  resources.output.def = createFile(join(directory, 'output', `${design}_${stepName}.def.gz`), 'output')
  resources.output.verilog = createFile(join(directory, 'output', `${design}_${stepName}.v`), 'output')
  resources.output.gds = createFile(join(directory, 'output', `${design}_${stepName}.gds`), 'output')
  resources.output.db = createFile(join(directory, 'output', `${design}_${stepName}_db`), 'output')
  resources.output.image = createFile(join(directory, 'output', `${design}_${stepName}.png`), 'layout-image')
  resources.output.json = createFile(join(directory, 'output', `${design}_${stepName}.json`), 'layout-json')
  resources.output.lef = createFile(join(directory, 'output', `${design}_${stepName}.lef`), 'output')
  resources.output.lib = createFile(join(directory, 'output', `${design}_${stepName}.lib`), 'output')
  resources.data.dir = createFile(join(directory, 'data'), 'unknown')
  resources.data.sta = createFile(join(directory, 'data', 'sta'), 'unknown')
  resources.feature.dir = createFile(join(directory, 'feature'), 'analysis')
  resources.feature.db = createFile(join(directory, 'feature', `${stepName}.db.json`), 'analysis')
  resources.feature.step = createFile(join(directory, 'feature', `${stepName}.step.json`), 'analysis')
  resources.feature.map = createFile(join(directory, 'feature', `${stepName}.map.json`), 'analysis')
  resources.feature.timing = createFile(join(directory, 'data', 'sta', `${topModule}.rpt.json`), 'analysis')
  resources.report.dir = createFile(join(directory, 'report'), 'report')
  resources.report.db = createFile(join(directory, 'report', `${stepName}.db.rpt`), 'report')
  resources.report.step = createFile(join(directory, 'report', `${stepName}.rpt`), 'report')
  resources.report.sta = {
    timing: createFile(join(directory, 'data', 'sta', `${topModule}.rpt`), 'report'),
    hold: createFile(join(directory, 'data', 'sta', `${topModule}_hold.skew`), 'report'),
    setup: createFile(join(directory, 'data', 'sta', `${topModule}_setup.skew`), 'report'),
    cap: createFile(join(directory, 'data', 'sta', `${topModule}.cap`), 'report'),
    fanout: createFile(join(directory, 'data', 'sta', `${topModule}.fanout`), 'report'),
    trans: createFile(join(directory, 'data', 'sta', `${topModule}.trans`), 'report'),
  }
  resources.log.file = createFile(join(directory, 'log', `${stepName}.log`), 'log')
  resources.script.main = createFile(join(directory, 'script', `${stepName}_main.tcl`), 'script')
  resources.analysis.metrics = createFile(join(directory, 'analysis', `${stepName}_metrics.json`), 'metrics')
  resources.analysis.statis_csv = createFile(join(directory, 'analysis', `${stepName}_statis.csv`), 'analysis')
  resources.subflow.path = createFile(join(directory, 'subflow.json'), 'subflow')
  resources.checklist.path = createFile(join(directory, 'checklist.json'), 'checklist')
  addEccConfigResources(resources, directory, stepName)
}

function addYosysResources(
  resources: StepFileBuckets,
  root: string,
  directory: string,
  design: string,
  stepName: string,
): void {
  resources.output.dir = createFile(join(directory, 'output'), 'output')
  resources.output.def = createFile(join(directory, 'output', `${design}_${stepName}.def.gz`), 'output')
  resources.output.verilog = createFile(join(directory, 'output', `${design}_${stepName}.v`), 'output')
  resources.output.fixedVerilog = createFile(join(directory, 'output', `${design}_${stepName}_fixed.v`), 'output')
  resources.output.json = createFile(join(directory, 'output', `${design}_${stepName}.json`), 'layout-json')
  resources.output.report = createFile(join(directory, 'output', `${design}_${stepName}.rpt`), 'report')
  resources.output.image = createFile(join(directory, 'output', `${design}_${stepName}.png`), 'layout-image')
  resources.feature.genericStat = createFile(join(directory, 'feature', `${stepName}_generic_stat.json`), 'analysis')
  resources.feature.stat = createFile(join(directory, 'feature', `${stepName}_stat.json`), 'analysis')
  resources.report.stat = createFile(join(directory, 'report', `${stepName}_stat.json`), 'report')
  resources.report.check = createFile(join(directory, 'report', `${stepName}_check.rpt`), 'report')
  resources.log.file = createFile(join(directory, 'log', `${stepName}.log`), 'log')
  resources.script.main = createFile(join(directory, 'script', `${stepName}_main.tcl`), 'script')
  resources.analysis.metrics = createFile(join(directory, 'analysis', `${stepName}_metrics.json`), 'metrics')
  resources.analysis.summary = createFile(join(directory, 'analysis', `${stepName}_summary.json`), 'analysis')
  resources.subflow.path = createFile(join(directory, 'subflow.json'), 'subflow')
  resources.checklist.path = createFile(join(directory, 'checklist.json'), 'checklist')
  resources.config.path = createFile(join(root, 'config', 'flow_config.json'), 'config')
}

function addEccConfigResources(
  resources: StepFileBuckets,
  directory: string,
  stepName: string,
): void {
  resources.config.dir = createFile(join(directory, 'config'), 'config')
  resources.config.flow = createFile(join(directory, 'config', 'flow_config.json'), 'config')
  resources.config.db = createFile(join(directory, 'config', 'db_default_config.json'), 'config')
  resources.config.cts = createFile(join(directory, 'config', 'cts_default_config.json'), 'config')
  resources.config.drc = createFile(join(directory, 'config', 'drc_default_config.json'), 'config')
  resources.config.floorplan = createFile(join(directory, 'config', 'fp_default_config.json'), 'config')
  resources.config.netlist_opt = createFile(join(directory, 'config', 'no_default_config_fixfanout.json'), 'config')
  resources.config.placement = createFile(join(directory, 'config', 'pl_default_config.json'), 'config')
  resources.config.pnp = createFile(join(directory, 'config', 'pnp_default_config.json'), 'config')
  resources.config.routing = createFile(join(directory, 'config', 'rt_default_config.json'), 'config')
  resources.config.timing_opt_drv = createFile(join(directory, 'config', 'to_default_config_drv.json'), 'config')
  resources.config.timing_opt_hold = createFile(join(directory, 'config', 'to_default_config_hold.json'), 'config')
  resources.config.timing_opt_setup = createFile(join(directory, 'config', 'to_default_config_setup.json'), 'config')
  resources.config.legalization = createFile(join(directory, 'config', 'pl_default_config.json'), 'config')
  resources.config.filler = createFile(join(directory, 'config', 'pl_default_config.json'), 'config')
  resources.config.config = resources.config[stepName] ?? resources.config.flow
}

function addUnknownResources(
  resources: StepFileBuckets,
  directory: string,
  stepName: string,
): void {
  resources.output.dir = createFile(join(directory, 'output'), 'output')
  resources.analysis.dir = createFile(join(directory, 'analysis'), 'analysis')
  resources.log.file = createFile(join(directory, 'log', `${stepName}.log`), 'log')
  resources.subflow.path = createFile(join(directory, 'subflow.json'), 'subflow')
  resources.checklist.path = createFile(join(directory, 'checklist.json'), 'checklist')
}

function collectFiles(resources: StepFileBuckets): WorkspaceResourceFile[] {
  return Object.values(resources).flatMap((bucket) => collectBucketFiles(bucket))
}

function collectBucketFiles(
  bucket: Record<string, WorkspaceResourceFile | Record<string, WorkspaceResourceFile>>,
): WorkspaceResourceFile[] {
  return Object.values(bucket).flatMap((value) => {
    if (isWorkspaceResourceFile(value)) return [value]
    return Object.values(value)
  })
}

function isWorkspaceResourceFile(value: unknown): value is WorkspaceResourceFile {
  return isRecord(value) && typeof value.path === 'string' && typeof value.exists === 'boolean'
}

function readFlowStep(value: unknown): FlowStepInput | null {
  if (!isRecord(value)) return null
  const name = typeof value.name === 'string' ? value.name : ''
  if (!name) return null

  return {
    name,
    tool: typeof value.tool === 'string' ? value.tool : 'unknown',
    state: typeof value.state === 'string' ? value.state : '',
    runtime: typeof value.runtime === 'string' ? value.runtime : '',
    info: isRecord(value.info) ? value.info : {},
  }
}

function stringValue(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key]
  return typeof value === 'string' ? value : ''
}

function resolveIndexStatus(input: {
  messages: string[]
  statErrors: string[]
  parametersExists: boolean
  flowExists: boolean
}): WorkspaceResourceStatus {
  if (input.messages.some((message) => message.startsWith('Failed to parse')) || input.statErrors.length > 0) {
    return 'error'
  }
  if (!input.parametersExists || !input.flowExists) return 'missing'
  return 'available'
}

function buildAnalysisInfo(step: WorkspaceStepResource): Record<string, unknown> {
  const tool = step.tool.toLocaleLowerCase()
  if (tool === 'yosys') {
    return {
      metrics: step.resources.analysis.metrics?.path,
      'data summary': step.resources.analysis.summary?.path,
      'step report': nestedResourcePath(step.resources.report, 'stat'),
    }
  }

  return {
    metrics: step.resources.analysis.metrics?.path,
    statis: step.resources.analysis.statis_csv?.path,
    'data summary': step.resources.feature.db?.path,
    'step feature': step.resources.feature.step?.path,
    'step report': nestedResourcePath(step.resources.report, 'db'),
  }
}

function analysisFiles(step: WorkspaceStepResource): WorkspaceResourceFile[] {
  const tool = step.tool.toLocaleLowerCase()
  if (tool === 'yosys') {
    return existingResourceRefs([
      step.resources.analysis.metrics,
      step.resources.analysis.summary,
      nestedResource(step.resources.report, 'stat'),
    ])
  }

  return existingResourceRefs([
    step.resources.analysis.metrics,
    step.resources.analysis.statis_csv,
    step.resources.feature.db,
    step.resources.feature.step,
    nestedResource(step.resources.report, 'db'),
  ])
}

function buildConfigInfo(step: WorkspaceStepResource): Record<string, unknown> {
  const tool = step.tool.toLocaleLowerCase()
  if (tool === 'yosys') return { path: step.resources.config.path?.path }
  if (tool === 'dreamplace') return { config: step.resources.config.dreamplace?.path }
  return { config: step.resources.config.config?.path }
}

function configFiles(step: WorkspaceStepResource): WorkspaceResourceFile[] {
  const tool = step.tool.toLocaleLowerCase()
  if (tool === 'yosys') return existingResourceRefs([step.resources.config.path])
  if (tool === 'dreamplace') return existingResourceRefs([step.resources.config.dreamplace])
  return existingResourceRefs([step.resources.config.config])
}

function existingResourceRefs(
  files: Array<WorkspaceResourceFile | undefined>,
): WorkspaceResourceFile[] {
  return files.filter((file): file is WorkspaceResourceFile => file !== undefined)
}

function nestedResource(
  bucket: StepFileBuckets[ResourceBucketName],
  key: string,
): WorkspaceResourceFile | undefined {
  const value = bucket[key]
  return isWorkspaceResourceFile(value) ? value : undefined
}

function nestedResourcePath(
  bucket: StepFileBuckets[ResourceBucketName],
  key: string,
): string | undefined {
  return nestedResource(bucket, key)?.path
}

function nestedResourcePaths(value: unknown): Record<string, string> | string | undefined {
  if (isWorkspaceResourceFile(value)) return value.path
  if (!isRecord(value)) return undefined

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, WorkspaceResourceFile] => isWorkspaceResourceFile(entry[1]))
      .map(([key, file]) => [key, file.path]),
  )
}

function resourceRecordValues(value: unknown): WorkspaceResourceFile[] {
  if (isWorkspaceResourceFile(value)) return [value]
  if (!isRecord(value)) return []
  return Object.values(value).filter(isWorkspaceResourceFile)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNodeErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === code
  )
}

function formatErrorMessage(prefix: string, error: unknown): string {
  if (error instanceof Error) return `${prefix}: ${error.message}`
  return prefix
}
