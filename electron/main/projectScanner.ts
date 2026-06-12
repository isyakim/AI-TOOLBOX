import { promises as fs } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import createIgnore from 'ignore'

const DEFAULT_IGNORES = [
  '.git/',
  'node_modules/',
  'dist/',
  'out/',
  'build/',
  '.next/',
  'coverage/',
  '*.min.js',
  '*.map'
]
const SECRET_NAMES = [
  /^\.env(?:\..+)?$/i,
  /^(?:id_rsa|id_ed25519)$/i,
  /\.(?:pem|key|p12|pfx)$/i,
  /^(?:credentials|secrets?)\.(?:json|ya?ml|toml)$/i
]

export interface ScannedProjectFile {
  path: string
  relativePath: string
  extension: string
  language: string
  bytes: number
}

export interface ProjectScanResult {
  rootPath: string
  files: ScannedProjectFile[]
  failedFiles: Array<{ path: string; message: string }>
  languageStats: Record<string, number>
}

export async function scanProject(options: {
  rootPath: string
  extensions: string[]
  excludePatterns?: string[]
  maxFileBytes?: number
}): Promise<ProjectScanResult> {
  const rootPath = await fs.realpath(options.rootPath)
  const matcher = createIgnore()
    .add(DEFAULT_IGNORES)
    .add(options.excludePatterns || [])
  const gitignore = await fs.readFile(join(rootPath, '.gitignore'), 'utf-8').catch(() => '')
  if (gitignore) matcher.add(gitignore)
  const allowed = new Set(options.extensions.map((extension) => extension.toLowerCase()))
  const maxFileBytes = options.maxFileBytes || 1024 * 1024
  const files: ScannedProjectFile[] = []
  const failedFiles: Array<{ path: string; message: string }> = []
  const languageStats: Record<string, number> = {}

  async function walk(directory: string): Promise<void> {
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch (error: unknown) {
      failedFiles.push({ path: relativePath(directory), message: errorMessage(error) })
      return
    }

    for (const entry of entries) {
      const fullPath = join(directory, entry.name)
      const relativeFile = relativePath(fullPath)
      if (matcher.ignores(relativeFile + (entry.isDirectory() ? '/' : ''))) continue
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!entry.isFile() || SECRET_NAMES.some((pattern) => pattern.test(entry.name))) continue
      const extension = extname(entry.name).toLowerCase()
      if (!allowed.has(extension)) continue

      try {
        const realPath = await fs.realpath(fullPath)
        if (!isInside(rootPath, realPath)) continue
        const stats = await fs.stat(realPath)
        if (stats.size > maxFileBytes || (await isBinary(realPath))) continue
        const language = languageForExtension(extension)
        files.push({
          path: realPath,
          relativePath: relativeFile,
          extension,
          language,
          bytes: stats.size
        })
        languageStats[language] = (languageStats[language] || 0) + 1
      } catch (error: unknown) {
        failedFiles.push({ path: relativeFile, message: errorMessage(error) })
      }
    }
  }

  function relativePath(path: string): string {
    return relative(rootPath, path).replace(/\\/g, '/')
  }

  await walk(rootPath)
  return { rootPath, files, failedFiles, languageStats }
}

function isInside(rootPath: string, candidatePath: string): boolean {
  const relativePath = relative(rootPath, resolve(candidatePath))
  return relativePath === '' || (!relativePath.startsWith('..') && !relativePath.includes(':'))
}

async function isBinary(path: string): Promise<boolean> {
  const handle = await fs.open(path, 'r')
  try {
    const buffer = Buffer.alloc(8192)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    return buffer.subarray(0, bytesRead).includes(0)
  } finally {
    await handle.close()
  }
}

function languageForExtension(extension: string): string {
  return (
    {
      '.ts': 'TypeScript',
      '.tsx': 'TSX',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.vue': 'Vue',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.css': 'CSS',
      '.html': 'HTML',
      '.txt': 'Text'
    }[extension] || extension.slice(1).toUpperCase()
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to scan file.'
}
