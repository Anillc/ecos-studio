import { isAbsoluteLocalPath, joinLocalPath } from '@ecos-studio/shared'
import { getDesktopApi } from '@/platform/desktop'

export interface ProjectFilePathOptions {
  projectPath?: string
}

export interface ProjectBlobUrlOptions extends ProjectFilePathOptions {
  mimeType?: string
}

export function resolveProjectFilePath(path: string, projectPath?: string): string {
  if (!path || !projectPath || isAbsoluteLocalPath(path)) {
    return path
  }

  return joinLocalPath(projectPath, path)
}

export function getMimeTypeFromPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'json':
      return 'application/json'
    case 'csv':
      return 'text/csv'
    case 'txt':
    case 'log':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}

export async function readProjectTextFile(
  path: string,
  options: ProjectFilePathOptions = {},
): Promise<string> {
  const resolvedPath = resolveProjectFilePath(path, options.projectPath)
  return await getDesktopApi().workspace.readProjectTextFile(resolvedPath)
}

export async function readProjectJsonFile<T>(
  path: string,
  options: ProjectFilePathOptions = {},
): Promise<T> {
  return JSON.parse(await readProjectTextFile(path, options)) as T
}

export async function readProjectBinaryFile(
  path: string,
  options: ProjectFilePathOptions = {},
): Promise<Uint8Array> {
  const resolvedPath = resolveProjectFilePath(path, options.projectPath)
  return await getDesktopApi().workspace.readProjectBinaryFile(resolvedPath)
}

export async function writeProjectTextFile(
  path: string,
  content: string,
  options: ProjectFilePathOptions = {},
): Promise<void> {
  const resolvedPath = resolveProjectFilePath(path, options.projectPath)
  await getDesktopApi().workspace.writeProjectTextFile(resolvedPath, content)
}

export async function readProjectBlobUrl(
  path: string,
  options: ProjectBlobUrlOptions = {},
): Promise<string> {
  const resolvedPath = resolveProjectFilePath(path, options.projectPath)
  const bytes = await readProjectBinaryFile(resolvedPath)
  const blobBytes = Uint8Array.from(bytes)
  const blob = new Blob([blobBytes], {
    type: options.mimeType ?? getMimeTypeFromPath(resolvedPath),
  })
  return URL.createObjectURL(blob)
}
