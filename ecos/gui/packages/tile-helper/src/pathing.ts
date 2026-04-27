import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'

export const TILE_CACHE_BASE_SEGMENTS = ['.ecos', 'tile-cache', 'layout'] as const

export function sanitizeStepKey(raw: string): string {
  const mapped = raw
    .trim()
    .split('')
    .map((char) => {
      if (
        (char >= 'a' && char <= 'z')
        || (char >= 'A' && char <= 'Z')
        || (char >= '0' && char <= '9')
        || char === '_'
        || char === '-'
      ) {
        return char
      }

      return '_'
    })
    .join('')

  const collapsed = mapped.replace(/_+/g, '_')
  const sanitized = collapsed.replace(/^_+|_+$/g, '')

  return sanitized.length > 0 ? sanitized : '_default'
}

export function getLayoutTileCacheBase(projectRoot: string): string {
  return join(projectRoot, ...TILE_CACHE_BASE_SEGMENTS)
}

export function getLayoutTileCacheDir(projectRoot: string, stepKey: string): string {
  return join(getLayoutTileCacheBase(projectRoot), sanitizeStepKey(stepKey))
}

export async function canonicalizeExistingPath(path: string): Promise<string> {
  return await realpath(path)
}

export async function canonicalizeExistingDirectory(path: string): Promise<string> {
  const canonicalPath = await canonicalizeExistingPath(path)
  const pathStats = await stat(canonicalPath)

  if (!pathStats.isDirectory()) {
    throw new Error(`${canonicalPath} is not a directory`)
  }

  return canonicalPath
}

export function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const relativePath = relative(rootPath, candidatePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

export async function validateProjectScopedPath(path: string, rootPath: string): Promise<string> {
  const canonicalPath = await canonicalizeExistingPath(path)

  if (!isWithinRoot(canonicalPath, rootPath)) {
    throw new Error(`Refusing to grant access outside current project root: ${canonicalPath}`)
  }

  return canonicalPath
}

export async function validateTileCacheOutDir(
  outDir: string,
  rootPath: string,
): Promise<string> {
  const canonicalPath = await validateProjectScopedPath(outDir, rootPath)
  const basePath = getLayoutTileCacheBase(rootPath)
  const canonicalBasePath = await realpath(basePath).catch(() => basePath)

  if (!isWithinRoot(canonicalPath, canonicalBasePath)) {
    throw new Error(
      `Refusing tile cache out_dir outside ${canonicalBasePath}: ${canonicalPath}`,
    )
  }

  return canonicalPath
}
