import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getMimeTypeFromPath,
  readProjectBlobUrl,
  readProjectTextFile,
  resolveProjectFilePath,
  writeProjectTextFile,
} from './projectFiles'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalCreateObjectUrl = URL.createObjectURL

function setWindow(value: unknown) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
    writable: true,
  })
}

function restoreWindow() {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', originalWindow)
    return
  }

  delete (globalThis as { window?: unknown }).window
}

describe('projectFiles', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:project-file')
  })

  afterEach(() => {
    restoreWindow()
    URL.createObjectURL = originalCreateObjectUrl
    vi.restoreAllMocks()
  })

  it('resolves relative project file paths through the project root', () => {
    expect(resolveProjectFilePath('home/flow.json', '/workspace/demo')).toBe(
      '/workspace/demo/home/flow.json',
    )
    expect(resolveProjectFilePath('/workspace/demo/home/flow.json', '/workspace/demo')).toBe(
      '/workspace/demo/home/flow.json',
    )
  })

  it('delegates text, blob, and write calls through the desktop bridge', async () => {
    const readProjectText = vi.fn().mockResolvedValue('{"steps":[]}')
    const readProjectBinary = vi.fn().mockResolvedValue(Uint8Array.from([0x45, 0x43, 0x4f, 0x53]))
    const writeProjectText = vi.fn().mockResolvedValue(undefined)

    setWindow({
      ecosDesktop: {
        workspace: {
          readProjectTextFile: readProjectText,
          readProjectBinaryFile: readProjectBinary,
          writeProjectTextFile: writeProjectText,
        },
      },
    })

    await expect(
      readProjectTextFile('home/flow.json', { projectPath: '/workspace/demo' }),
    ).resolves.toBe('{"steps":[]}')
    await expect(
      readProjectBlobUrl('images/layout.png', { projectPath: '/workspace/demo' }),
    ).resolves.toBe('blob:project-file')
    await expect(
      writeProjectTextFile('home/parameters.json', '{"PDK":"ics55"}', {
        projectPath: '/workspace/demo',
      }),
    ).resolves.toBeUndefined()

    expect(readProjectText).toHaveBeenCalledWith('/workspace/demo/home/flow.json')
    expect(readProjectBinary).toHaveBeenCalledWith('/workspace/demo/images/layout.png')
    expect(writeProjectText).toHaveBeenCalledWith(
      '/workspace/demo/home/parameters.json',
      '{"PDK":"ics55"}',
    )
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('infers MIME types from common file extensions', () => {
    expect(getMimeTypeFromPath('chart.png')).toBe('image/png')
    expect(getMimeTypeFromPath('report.csv')).toBe('text/csv')
    expect(getMimeTypeFromPath('unknown.bin')).toBe('application/octet-stream')
  })
})
