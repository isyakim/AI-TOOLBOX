import { promises as fs } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

function isInside(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(rootPath, candidatePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

export async function resolveWorkspacePath(
  rootPath: string,
  requestedPath: string
): Promise<string> {
  if (!rootPath || !requestedPath || requestedPath.includes('\0')) {
    throw new Error('A workspace and relative file path are required.')
  }
  if (isAbsolute(requestedPath)) {
    throw new Error('Absolute paths are not allowed.')
  }

  const realRoot = await fs.realpath(rootPath)
  const targetPath = resolve(realRoot, requestedPath)
  if (!isInside(realRoot, targetPath)) {
    throw new Error('The requested path is outside the active workspace.')
  }

  let existingAncestor = targetPath
  while (true) {
    try {
      const realAncestor = await fs.realpath(existingAncestor)
      if (!isInside(realRoot, realAncestor)) {
        throw new Error('The requested path escapes the active workspace through a link.')
      }
      break
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error
      }
      const parent = dirname(existingAncestor)
      if (parent === existingAncestor) throw error
      existingAncestor = parent
    }
  }

  return targetPath
}
