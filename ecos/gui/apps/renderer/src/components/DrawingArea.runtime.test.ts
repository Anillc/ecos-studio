/// <reference types="node" />

import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import drawingAreaSource from './DrawingArea.vue?raw'

type VueRuntime = typeof import('vue')

type GlobalKey =
  | 'document'
  | 'window'
  | 'Node'
  | 'Element'
  | 'HTMLElement'
  | 'SVGElement'
  | 'DocumentFragment'
  | 'requestAnimationFrame'
  | 'cancelAnimationFrame'

const originalGlobals = {
  document: globalThis.document,
  window: globalThis.window,
  Node: globalThis.Node,
  Element: globalThis.Element,
  HTMLElement: globalThis.HTMLElement,
  SVGElement: globalThis.SVGElement,
  DocumentFragment: globalThis.DocumentFragment,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
} as const

let domInstalled = false

class FakeNode {
  parentNode: FakeElement | null = null

  childNodes: FakeNode[] = []

  constructor(public readonly nodeType: number) {}

  get nextSibling(): FakeNode | null {
    if (!this.parentNode) return null
    const index = this.parentNode.childNodes.indexOf(this)
    return this.parentNode.childNodes[index + 1] ?? null
  }

  appendChild(node: FakeNode) {
    return this.insertBefore(node, null)
  }

  insertBefore(node: FakeNode, anchor: FakeNode | null) {
    if (node.parentNode) {
      node.parentNode.removeChild(node)
    }

    node.parentNode = this as unknown as FakeElement

    if (!anchor) {
      this.childNodes.push(node)
      return node
    }

    const index = this.childNodes.indexOf(anchor)
    if (index === -1) {
      this.childNodes.push(node)
      return node
    }

    this.childNodes.splice(index, 0, node)
    return node
  }

  removeChild(node: FakeNode) {
    const index = this.childNodes.indexOf(node)
    if (index !== -1) {
      this.childNodes.splice(index, 1)
      node.parentNode = null
    }

    return node
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join('')
  }

  set textContent(value: string) {
    this.childNodes = value ? [new FakeText(value)] : []
  }
}

class FakeText extends FakeNode {
  constructor(public data: string) {
    super(3)
  }

  get textContent(): string {
    return this.data
  }

  set textContent(value: string) {
    this.data = value
  }
}

class FakeComment extends FakeNode {
  constructor(public data: string) {
    super(8)
  }

  get textContent(): string {
    return this.data
  }

  set textContent(value: string) {
    this.data = value
  }
}

class FakeElement extends FakeNode {
  readonly tagName: string

  readonly attributes = new Map<string, string>()

  readonly listeners = new Map<string, Set<(event: unknown) => void>>()

  readonly style: Record<string, string> = {}

  private _className = ''

  constructor(tagName: string) {
    super(1)
    this.tagName = tagName.toUpperCase()
  }

  get className(): string {
    return this._className
  }

  set className(value: string) {
    this._className = value
    if (value) {
      this.attributes.set('class', value)
    } else {
      this.attributes.delete('class')
    }
  }

  get classList() {
    const read = () => this.className.split(/\s+/).filter(Boolean)
    return {
      contains: (token: string) => read().includes(token),
      add: (...tokens: string[]) => {
        this.className = [...new Set([...read(), ...tokens])].join(' ')
      },
      remove: (...tokens: string[]) => {
        this.className = read().filter((token) => !tokens.includes(token)).join(' ')
      },
    }
  }

  get innerHTML(): string {
    return this.textContent
  }

  set innerHTML(value: string) {
    this.childNodes = value ? [new FakeText(value)] : []
  }

  setAttribute(name: string, value: string) {
    if (name === 'class') {
      this.className = value
      return
    }

    this.attributes.set(name, String(value))
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  removeAttribute(name: string) {
    if (name === 'class') {
      this.className = ''
      return
    }

    this.attributes.delete(name)
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  dispatchEvent(event: { type: string }) {
    this.listeners.get(event.type)?.forEach((listener) => listener(event))
    return true
  }

  click() {
    this.dispatchEvent({ type: 'click' })
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null
  }

  querySelectorAll(selector: string): FakeElement[] {
    const results: FakeElement[] = []
    const matches = (element: FakeElement) => {
      if (selector.startsWith('.')) {
        return element.classList.contains(selector.slice(1))
      }

      return element.tagName.toLowerCase() === selector.toLowerCase()
    }

    const walk = (node: FakeNode) => {
      if (!(node instanceof FakeElement)) return
      if (matches(node)) {
        results.push(node)
      }
      node.childNodes.forEach(walk)
    }

    this.childNodes.forEach(walk)
    return results
  }
}

function ensureDom(): void {
  if ((globalThis as typeof globalThis & { document?: unknown }).document) return

  const body = new FakeElement('body')
  const documentElement = new FakeElement('html')
  const fakeDocument = {
    body,
    documentElement,
    createElement: (tagName: string) => new FakeElement(tagName),
    createElementNS: (_namespace: string, tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => new FakeText(text),
    createComment: (text: string) => new FakeComment(text),
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector),
  }

  const windowListeners = new Map<string, Set<(event: unknown) => void>>()
  const fakeWindow = {
    document: fakeDocument,
    navigator: { platform: 'Linux' },
    addEventListener(type: string, listener: (event: unknown) => void) {
      const listeners = windowListeners.get(type) ?? new Set()
      listeners.add(listener)
      windowListeners.set(type, listeners)
    },
    removeEventListener(type: string, listener: (event: unknown) => void) {
      windowListeners.get(type)?.delete(listener)
    },
    dispatchEvent(event: { type: string }) {
      windowListeners.get(event.type)?.forEach((listener) => listener(event))
      return true
    },
  }

  Object.defineProperty(globalThis, 'document', {
    value: fakeDocument,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'window', {
    value: fakeWindow,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'navigator', {
    value: fakeWindow.navigator,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'Node', {
    value: FakeNode,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'Element', {
    value: FakeElement,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'HTMLElement', {
    value: FakeElement,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'SVGElement', {
    value: FakeElement,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'DocumentFragment', {
    value: FakeElement,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    },
    configurable: true,
  })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    value: () => undefined,
    configurable: true,
  })

  domInstalled = true
}

function restoreDomGlobals(): void {
  if (!domInstalled) return

  const keys: GlobalKey[] = [
    'document',
    'window',
    'Node',
    'Element',
    'HTMLElement',
    'SVGElement',
    'DocumentFragment',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ]

  for (const key of keys) {
    const value = originalGlobals[key]
    if (value === undefined) {
      delete (globalThis as Record<GlobalKey, unknown>)[key]
    } else {
      Object.defineProperty(globalThis, key, {
        value,
        configurable: true,
        writable: true,
      })
    }
  }

  domInstalled = false
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const require = createRequire(import.meta.url)
let vueRuntime: VueRuntime | null = null

async function loadVueRuntime(): Promise<VueRuntime> {
  vueRuntime ??= await import('vue')
  return vueRuntime
}

const tileManagerConstructed = vi.fn()
const resolveWorkspaceStepInfoApi = vi.fn()
const getResourceUrl = vi.fn()
const getLayoutTileGenerationStatus = vi.fn()
const runLayoutTileGenerationSingleFlight = vi.fn()
const requestProjectPathAccess = vi.fn()
const readOptionalProjectTextFile = vi.fn()
const setProject = vi.fn()
const notifyNavigatedStep = vi.fn()
const invalidateStep = vi.fn()
const clearDeferredPrefetchQueue = vi.fn()

const mountedApps: Array<{ unmount: () => void }> = []

interface DrawingAreaTestState {
  route: { path: string }
  currentProject: ReturnType<VueRuntime['ref']>
  resourceVersions: ReturnType<VueRuntime['ref']>
  workspaceSession: ReturnType<VueRuntime['ref']>
  layoutState: {
    selectedGroups: ReturnType<VueRuntime['shallowRef']>
    dataStore: ReturnType<VueRuntime['shallowRef']>
    layerManager: ReturnType<VueRuntime['shallowRef']>
    layerStyleSnapshot: ReturnType<VueRuntime['shallowRef']>
    renderMode: ReturnType<VueRuntime['ref']>
    loadingState: ReturnType<VueRuntime['ref']>
    loadingMessage: ReturnType<VueRuntime['ref']>
    tileSelection: ReturnType<VueRuntime['shallowRef']>
    tileDbuPerMicron: ReturnType<VueRuntime['ref']>
    tileDieWorldH: ReturnType<VueRuntime['ref']>
    tileActions: ReturnType<VueRuntime['shallowRef']>
    tileLayers: ReturnType<VueRuntime['shallowRef']>
    tileLayerActions: ReturnType<VueRuntime['shallowRef']>
    tileEditActions: ReturnType<VueRuntime['shallowRef']>
    hasUnsavedEdits: ReturnType<VueRuntime['ref']>
    isPlacementMode: ReturnType<VueRuntime['ref']>
    drcOverlayReady: ReturnType<VueRuntime['ref']>
    drcViolationCount: ReturnType<VueRuntime['ref']>
    drcViolations: ReturnType<VueRuntime['shallowRef']>
    focusDrcViolationByIndex: ReturnType<VueRuntime['shallowRef']>
  }
  fakeEditor: ReturnType<typeof createFakeEditor>
}

function createLayoutState(vue: VueRuntime) {
  return {
    selectedGroups: vue.shallowRef([]),
    dataStore: vue.shallowRef(null),
    layerManager: vue.shallowRef(null),
    layerStyleSnapshot: vue.shallowRef({}),
    renderMode: vue.ref('image'),
    loadingState: vue.ref('idle'),
    loadingMessage: vue.ref(''),
    tileSelection: vue.shallowRef(null),
    tileDbuPerMicron: vue.ref(1000),
    tileDieWorldH: vue.ref(0),
    tileActions: vue.shallowRef(null),
    tileLayers: vue.shallowRef([]),
    tileLayerActions: vue.shallowRef(null),
    tileEditActions: vue.shallowRef(null),
    hasUnsavedEdits: vue.ref(false),
    isPlacementMode: vue.ref(false),
    drcOverlayReady: vue.ref(false),
    drcViolationCount: vue.ref(0),
    drcViolations: vue.shallowRef([]),
    focusDrcViolationByIndex: vue.shallowRef(null),
  }
}

let testState: DrawingAreaTestState | null = null

function createFakeEditor() {
  const canvas = document.createElement('canvas')
  const view = {
    toWorld: vi.fn((x: number, y: number) => ({ x, y })),
    addChild: vi.fn(),
    on: vi.fn(),
    plugins: {
      resume: vi.fn(),
    },
  }

  return {
    application: { canvas },
    view,
    getPlugin: vi.fn(() => null),
    clearBackground: vi.fn(),
    setBackgroundImage: vi.fn(async () => undefined),
    fitToWorld: vi.fn(),
    worldToDisplay: vi.fn((x: number, y: number) => ({ x, y })),
    setWorldBounds: vi.fn(),
    setPluginEnabled: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    getScale: vi.fn(() => 1),
    onTransformChange: vi.fn(() => () => undefined),
  }
}

class MockTileManager {
  readonly cellStore = {
    ready: Promise.resolve(),
    getAllCellIds: () => [] as number[],
    getCellDef: () => null,
  }

  readonly globalStore = {
    ready: Promise.resolve(),
    shapes: [] as Array<{ layerIdx: number }>,
  }

  readonly manifest = {
    dieArea: { x: 0, y: 0, w: 120, h: 80 },
    dbuPerMicron: 1000,
    layers: [] as Array<{ id: number; name: string; color: string; alpha: number; zOrder: number }>,
  }

  constructor(
    _view: unknown,
    _baseUrl: string,
    _localRoot?: string,
  ) {
    tileManagerConstructed()
  }

  async init(): Promise<void> {}

  setEditDirtyGetter(): void {}

  isLayerVisible(): boolean {
    return true
  }

  setLayerVisible(): void {}

  destroy(): void {}
}

class MockTileInteraction {
  readonly ghostOverlay = {}

  readonly highlightOverlay = { clear: vi.fn() }

  readonly selectionOverlay = {}

  currentSelection: unknown = null

  setEditManager(): void {}

  onSelectionChange(): void {}

  onRequestPlacement(): void {}

  enable(): void {}

  disable(): void {}

  clearSelection(): void {}

  refreshSelectionStroke(): void {}

  destroy(): void {}
}

class MockViewportAnimator {
  constructor(_view: unknown) {}

  setManifest(): void {}

  fitToBbox(): void {}

  destroy(): void {}
}

class MockEditManager {
  readonly editOverlay = {}

  hasUnsavedChanges = false

  constructor(
    _tileManager: unknown,
    _cellStore: unknown,
  ) {}

  onChange(): void {}

  deleteInstance(): void {}

  undo(): void {}

  redo(): void {}

  destroy(): void {}
}

class MockPlacementTool {
  readonly ghostOverlay = {}

  constructor(
    _view: unknown,
    _editManager: unknown,
    _tileManager: unknown,
    _cellStore: unknown,
  ) {}

  onDeactivate(): void {}

  activate(): void {}

  deactivate(): void {}

  destroy(): void {}
}

class MockDrcViolationOverlay {
  constructor(_view: unknown) {}

  bindViewportEvents(): void {}

  setViolations(): void {}

  destroy(): void {}
}

function compileDrawingArea(vue: VueRuntime) {
  const { descriptor } = parse(drawingAreaSource, {
    filename: 'DrawingArea.vue',
  })

  const script = compileScript(descriptor, {
    id: 'drawing-area',
    inlineTemplate: true,
    templateOptions: {
      compilerOptions: {
        hoistStatic: false,
      },
    },
  })

  const transpiled = ts.transpileModule(script.content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
    fileName: 'DrawingArea.ts',
  })

  const moduleExports: { default?: unknown } = {}
  const customRequire = (id: string) => {
    if (id === 'vue') return vue
    if (id === 'vue-router') {
      return {
        useRoute: () => testState!.route,
      }
    }
    if (id === '@/applications/editor') {
      return {
        EditorContainer: vue.defineComponent({
          emits: ['ready'],
          setup(_, { emit }) {
            vue.onMounted(() => {
              emit('ready', testState!.fakeEditor)
            })
            return () => vue.h('div', { class: 'editor-container-stub' })
          },
        }),
      }
    }
    if (id === '@/applications/editor/plugins') {
      return {
        LayerManagerPlugin: class {},
      }
    }
    if (id === '@/applications/editor/tile') {
      return {
        TileManager: MockTileManager,
        TileInteraction: MockTileInteraction,
        ViewportAnimator: MockViewportAnimator,
        EditManager: MockEditManager,
        PlacementTool: MockPlacementTool,
        DrcViolationOverlay: MockDrcViolationOverlay,
      }
    }
    if (id === './DrawingToolbar.vue') {
      return vue.defineComponent({
        emits: ['generateTiles', 'toolChange', 'previewModeChange'],
        setup(_, { emit }) {
          return () => vue.h('div', { class: 'drawing-toolbar-stub' }, [
            vue.h('button', {
              class: 'generate-tiles',
              onClick: () => emit('generateTiles'),
            }, 'generate'),
          ])
        },
      })
    }
    if (id === '@/composables/useWorkspace') {
      return {
        useWorkspace: () => ({
          currentProject: testState!.currentProject,
          resourceVersions: testState!.resourceVersions,
          workspaceSession: testState!.workspaceSession,
        }),
      }
    }
    if (id === '@/composables/useEDA') {
      return {
        useEDA: () => ({
          getResourceUrl,
        }),
      }
    }
    if (id === '@/composables/useLayoutState') {
      return {
        useLayoutState: () => testState!.layoutState,
      }
    }
    if (id === '@/composables/useDesktopRuntime') {
      return {
        isDesktopRuntime: () => true,
      }
    }
    if (id === '@/composables/useLayoutTileGen') {
      return {
        deriveDrcStepPathFromLayoutJsonRelative: (path: string) => `${path}.drc.step.json`,
        getLayoutTileGenerationStatus,
        pickDrcJsonPath: (info: Record<string, unknown>) =>
          typeof info.drcJson === 'string' ? info.drcJson : null,
        pickLayoutJsonPath: (info: Record<string, unknown>) =>
          typeof info.json === 'string' ? info.json : null,
        resolveLayoutJsonAbsolutePath: async (projectPath: string, relative: string) =>
          `${projectPath}/${relative}`,
      }
    }
    if (id === '@/composables/drcStepParser') {
      return {
        parseDrcStepJson: () => [],
        violationToFitRect: () => ({ x: 0, y: 0, w: 1, h: 1 }),
      }
    }
    if (id === '@/utils/projectFs') {
      return {
        requestProjectPathAccess,
      }
    }
    if (id === '@/utils/projectFiles') {
      return {
        readOptionalProjectTextFile,
      }
    }
    if (id === '@/composables/layoutTilePipeline') {
      return {
        runLayoutTileGenerationSingleFlight,
      }
    }
    if (id === '@/stores/layoutTilePrefetchStore') {
      return {
        useLayoutTilePrefetchStore: () => ({
          setProject,
          notifyNavigatedStep,
          invalidateStep,
          clearDeferredPrefetchQueue,
        }),
      }
    }
    if (id === '@/api/type') {
      return {
        InfoEnum: {
          layout: 'layout',
        },
        StepEnum: {
          SYNTHESIS: 'Synthesis',
          DRC: 'drc',
          ROUTING: 'route',
        },
      }
    }
    if (id === '@/api/workspaceResources') {
      return {
        resolveWorkspaceStepInfoApi,
      }
    }
    if (id === '@/applications/editor/core/rulerConfig') {
      return {
        RULER_THICKNESS: 24,
      }
    }

    return require(id)
  }

  const evaluator = new Function('require', 'exports', 'module', transpiled.outputText)
  evaluator(customRequire, moduleExports, { exports: moduleExports })

  return moduleExports.default
}

function resetTestState(vue: VueRuntime, routePath: string): void {
  testState = {
    route: vue.reactive({ path: routePath }),
    currentProject: vue.ref({ path: '/workspace/demo' }),
    resourceVersions: vue.ref({ step: 0, tiles: 0, all: 0 }),
    workspaceSession: vue.ref({ sessionId: 'session-1' }),
    layoutState: createLayoutState(vue),
    fakeEditor: createFakeEditor(),
  }

  tileManagerConstructed.mockClear()
  resolveWorkspaceStepInfoApi.mockClear()
  getResourceUrl.mockClear()
  getLayoutTileGenerationStatus.mockClear()
  runLayoutTileGenerationSingleFlight.mockClear()
  requestProjectPathAccess.mockClear()
  readOptionalProjectTextFile.mockClear()
  setProject.mockReset()
  notifyNavigatedStep.mockReset()
  invalidateStep.mockReset()
  clearDeferredPrefetchQueue.mockReset()

  if (!getLayoutTileGenerationStatus.getMockImplementation()) {
    getLayoutTileGenerationStatus.mockResolvedValue({
      baseUrl: 'file:///status',
      outDir: '/status',
      fromCache: false,
    })
  }
  if (!requestProjectPathAccess.getMockImplementation()) {
    requestProjectPathAccess.mockResolvedValue(true)
  }
  if (!readOptionalProjectTextFile.getMockImplementation()) {
    readOptionalProjectTextFile.mockResolvedValue(null)
  }
}

async function flush(vue: VueRuntime): Promise<void> {
  await Promise.resolve()
  await vue.nextTick()
  await Promise.resolve()
  await vue.nextTick()
}

async function mountDrawingArea(routePath: string) {
  ensureDom()
  const vue = await loadVueRuntime()
  resetTestState(vue, routePath)
  const DrawingArea = compileDrawingArea(vue)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = vue.createApp(DrawingArea as never)
  app.mount(container as never)
  mountedApps.push(app)
  await flush(vue)
  return { vue, app, container }
}

afterEach(() => {
  while (mountedApps.length > 0) {
    mountedApps.pop()?.unmount()
  }

  const doc = globalThis.document as unknown as { body?: FakeElement } | undefined
  if (doc?.body) {
    doc.body.innerHTML = ''
  }

  tileManagerConstructed.mockReset()
  resolveWorkspaceStepInfoApi.mockReset()
  getResourceUrl.mockReset()
  getLayoutTileGenerationStatus.mockReset()
  runLayoutTileGenerationSingleFlight.mockReset()
  requestProjectPathAccess.mockReset()
  readOptionalProjectTextFile.mockReset()
  setProject.mockReset()
  notifyNavigatedStep.mockReset()
  invalidateStep.mockReset()
  clearDeferredPrefetchQueue.mockReset()

  restoreDomGlobals()
})

describe('DrawingArea runtime guards', () => {
  it('does not let a stale preview-image load from the previous route overwrite the current stage', async () => {
    const staleImage = deferred<string>()
    resolveWorkspaceStepInfoApi.mockImplementation(async ({ step }: { step: string }) => {
      if (step === 'Synthesis') {
        return {
          response: 'available',
          info: {
            image: 'preview-old.png',
            json: 'synth/output/layout.json',
          },
        }
      }

      return {
        response: 'available',
        info: {
          image: 'preview-new.png',
          json: 'drc/output/layout.json',
        },
      }
    })
    getResourceUrl.mockImplementation(async (path: string) => {
      if (path === 'preview-old.png') return await staleImage.promise
      return `blob:${path}`
    })

    const { vue } = await mountDrawingArea('/workspace/Synthesis')

    testState!.route.path = '/workspace/drc'
    await flush(vue)

    expect(testState!.fakeEditor.setBackgroundImage).toHaveBeenCalledWith('blob:preview-new.png')

    staleImage.resolve('blob:preview-old.png')
    await flush(vue)

    expect(testState!.fakeEditor.setBackgroundImage).not.toHaveBeenCalledWith('blob:preview-old.png')
    expect(testState!.layoutState.renderMode.value).toBe('image')
  })

  it('ignores a stale tile-generation completion after the workspace session changes', async () => {
    const tileGeneration = deferred<{
      baseUrl: string
      outDir: string
      fromCache: boolean
    }>()
    resolveWorkspaceStepInfoApi.mockResolvedValue({
      response: 'available',
      info: {
        image: 'preview-route.png',
        json: 'route/output/layout.json',
      },
    })
    getResourceUrl.mockImplementation(async (path: string) => `blob:${path}`)
    runLayoutTileGenerationSingleFlight.mockReturnValue(tileGeneration.promise)

    const { vue, container } = await mountDrawingArea('/workspace/route')

    ;(container.querySelector('.generate-tiles') as FakeElement | null)?.click()
    await flush(vue)

    expect(runLayoutTileGenerationSingleFlight).toHaveBeenCalledTimes(1)

    testState!.workspaceSession.value = {
      sessionId: 'session-2',
    }

    tileGeneration.resolve({
      baseUrl: 'file:///tiles',
      outDir: '/tiles',
      fromCache: false,
    })
    await flush(vue)

    expect(tileManagerConstructed).not.toHaveBeenCalled()
    expect(testState!.layoutState.renderMode.value).toBe('image')
  })
})
