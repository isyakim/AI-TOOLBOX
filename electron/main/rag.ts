import { app, ipcMain } from 'electron'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Connection, Table } from '@lancedb/lancedb'
import { watch, type FSWatcher } from 'chokidar'
import OpenAI from 'openai'
import type {
  ProjectHealthFinding,
  ProjectHealthReport,
  ProviderRuntimeConfig,
  RAGConfigPayload,
  RAGIndexStatus,
  RAGQueryPayload,
  RAGQueryResult
} from '../../src/shared/types/ipc'
import { analyzeProject } from './projectAnalyzer'
import {
  getActiveWorkspaceProjectId,
  getProjectIndexManifest,
  getStoredProjectMap,
  getWorkspaceProject,
  listWorkspaceProjects,
  registerWorkspaceProject,
  saveProjectIndexManifest,
  saveProjectMap,
  setActiveWorkspaceProject,
  updateWorkspaceProject
} from './projectRepository'
import { scanProject } from './projectScanner'
import { resolveProvider } from './providerRepository'

type LanceDBModule = typeof import('@lancedb/lancedb')
const execFileAsync = promisify(execFile)
const TABLE_PREFIX = 'knowledge_base_v4_'
const LEGACY_TABLE_NAMES = new Set(['knowledge_base', 'knowledge_base_v2'])
const LEGACY_TABLE_PREFIXES = ['knowledge_base_v3_']
const INDEX_VERSION = 4
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
const DEFAULT_EXTENSIONS = [
  '.md',
  '.txt',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.json',
  '.css',
  '.html'
]

let lancedb: LanceDBModule | null = null
let db: Connection | null = null
let table: Table | null = null
let activeTableName = ''
const states = new Map<string, RAGIndexStatus>()
const controls = new Map<string, { paused: boolean; cancelRequested: boolean }>()
const watchers = new Map<string, FSWatcher>()
const watchTimers = new Map<string, NodeJS.Timeout>()

function emptyStatus(projectId = ''): RAGIndexStatus {
  return {
    success: true,
    status: 'idle',
    projectId,
    rootPath: '',
    totalFiles: 0,
    indexedFiles: 0,
    totalChunks: 0,
    currentFile: '',
    startedAt: 0,
    completedAt: 0,
    message: '',
    failedFiles: [],
    paused: false,
    cancelRequested: false
  }
}

async function getLanceDB(): Promise<LanceDBModule> {
  if (!lancedb) lancedb = await import('@lancedb/lancedb')
  return lancedb
}

function getEmbeddingModel(config: ProviderRuntimeConfig): string {
  return config.embeddingModel?.trim() || DEFAULT_EMBEDDING_MODEL
}

export function getTableName(config: ProviderRuntimeConfig): string {
  return `${TABLE_PREFIX}${hash(getEmbeddingModel(config)).slice(0, 12)}`
}

async function initRAG(config: RAGConfigPayload): Promise<ProviderRuntimeConfig> {
  const provider = await resolveProvider(config.providerId)
  const lance = await getLanceDB()
  if (!db) db = await lance.connect(join(app.getPath('userData'), 'vector_db'))
  const tableName = getTableName(provider)
  if (table && activeTableName === tableName) return provider
  const tableNames = await db.tableNames()
  if (tableNames.includes(tableName)) table = await db.openTable(tableName)
  else {
    table = await db.createTable(tableName, [
      {
        id: 'init',
        vector: await getEmbedding('AI Toolbox knowledge index', provider),
        projectId: 'system',
        path: '',
        relativePath: '',
        lineStart: 0,
        lineEnd: 0,
        symbol: '',
        language: '',
        indexedAt: new Date(0).toISOString(),
        fileHash: '',
        text: 'Initial data',
        snippet: ''
      }
    ])
  }
  activeTableName = tableName
  return provider
}

async function getEmbedding(text: string, config: ProviderRuntimeConfig): Promise<number[]> {
  const openai = new OpenAI({
    apiKey: config.apiKey || 'ollama',
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: false
  })
  const response = await openai.embeddings.create({ model: getEmbeddingModel(config), input: text })
  return response.data[0].embedding
}

interface ProjectIndexPayload {
  projectId: string
  rootPath: string
  extensions?: string[]
  excludePatterns?: string[]
  force?: boolean
  config: RAGConfigPayload
}

async function indexProject(payload: ProjectIndexPayload): Promise<RAGIndexStatus> {
  const project = await getWorkspaceProject(payload.projectId)
  if (!project || project.rootPath !== (await fs.realpath(payload.rootPath))) {
    return {
      ...emptyStatus(payload.projectId),
      success: false,
      status: 'error',
      message: 'Workspace project identity does not match the selected path.'
    }
  }
  const control = { paused: false, cancelRequested: false }
  controls.set(project.id, control)
  const status: RAGIndexStatus = {
    ...emptyStatus(project.id),
    status: 'indexing',
    rootPath: project.rootPath,
    startedAt: Date.now(),
    message: 'Scanning project files.'
  }
  states.set(project.id, status)

  try {
    const provider = await initRAG(payload.config)
    if (!table) throw new Error('Knowledge table is unavailable.')
    const scan = await scanProject({
      rootPath: project.rootPath,
      extensions: payload.extensions || DEFAULT_EXTENSIONS,
      excludePatterns: payload.excludePatterns
    })
    status.totalFiles = scan.files.length
    status.failedFiles = scan.failedFiles
    status.message = 'Analyzing project structure.'
    const currentProject = await updateWorkspaceProject(project.id, {
      branch: project.branch,
      languageStats: scan.languageStats,
      failedFiles: scan.failedFiles
    })
    const analysis = await analyzeProject(currentProject, scan.files)
    const embeddingModel = getEmbeddingModel(provider)
    const previousManifest = await getProjectIndexManifest(project.id)
    const canIncrement =
      !payload.force &&
      previousManifest?.indexVersion === INDEX_VERSION &&
      previousManifest.embeddingModel === embeddingModel
    const previousFiles = canIncrement ? previousManifest.files : {}
    const currentFiles: Record<string, string> = {}
    for (const file of scan.files) {
      currentFiles[file.relativePath] = hash(await fs.readFile(file.path))
    }
    if (!canIncrement) await table.delete(`projectId = '${escapeFilter(project.id)}'`)
    else {
      for (const oldPath of Object.keys(previousFiles)) {
        if (!(oldPath in currentFiles)) {
          await table.delete(
            `projectId = '${escapeFilter(project.id)}' AND relativePath = '${escapeFilter(oldPath)}'`
          )
        }
      }
    }
    const indexedAt = new Date().toISOString()

    for (const file of scan.files) {
      if (control.cancelRequested) {
        status.status = 'cancelled'
        status.message = 'Indexing cancelled.'
        break
      }
      while (control.paused && !control.cancelRequested) {
        status.status = 'paused'
        status.paused = true
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
      if (control.cancelRequested) continue
      status.status = 'indexing'
      status.paused = false
      status.currentFile = file.relativePath
      const fileHash = currentFiles[file.relativePath]
      if (previousFiles[file.relativePath] === fileHash) {
        status.indexedFiles += 1
        continue
      }
      const fileChunks = analysis.chunks.filter((chunk) => chunk.relativePath === file.relativePath)
      if (canIncrement) {
        await table.delete(
          `projectId = '${escapeFilter(project.id)}' AND relativePath = '${escapeFilter(file.relativePath)}'`
        )
      }
      const rows = []
      for (const chunk of fileChunks) {
        rows.push({
          id: crypto.randomUUID(),
          vector: await getEmbedding(chunk.text, provider),
          projectId: project.id,
          path: file.path,
          relativePath: file.relativePath,
          lineStart: chunk.lineStart,
          lineEnd: chunk.lineEnd,
          symbol: chunk.symbol || '',
          language: chunk.language,
          indexedAt,
          fileHash,
          text: chunk.text,
          snippet: chunk.text.slice(0, 420)
        })
      }
      if (rows.length) await table.add(rows)
      status.indexedFiles += 1
      status.totalChunks += rows.length
    }

    if (status.status !== 'cancelled') {
      const updatedProject = await updateWorkspaceProject(project.id, {
        indexVersion: INDEX_VERSION,
        lastIndexedAt: indexedAt,
        failedFiles: status.failedFiles,
        languageStats: scan.languageStats
      })
      analysis.projectMap.project = updatedProject
      await saveProjectMap(analysis.projectMap)
      await saveProjectIndexManifest(project.id, {
        indexVersion: INDEX_VERSION,
        embeddingModel,
        files: currentFiles
      })
      status.status = 'ready'
      status.indexVersion = INDEX_VERSION
      status.embeddingModel = getEmbeddingModel(provider)
      status.completedAt = Date.now()
      status.currentFile = ''
      status.message = `Processed ${status.indexedFiles} files and updated ${status.totalChunks} language-aware chunks.`
      await watchProject(project.id, payload)
    }
    return { ...status }
  } catch (error: unknown) {
    status.success = false
    status.status = 'error'
    status.message = errorMessage(error)
    return { ...status }
  } finally {
    controls.delete(project.id)
  }
}

async function watchProject(projectId: string, payload: ProjectIndexPayload): Promise<void> {
  await watchers.get(projectId)?.close()
  const extensions = new Set(payload.extensions || DEFAULT_EXTENSIONS)
  const watcher = watch(payload.rootPath, {
    ignoreInitial: true,
    ignored: [/(^|[\\/])\.git([\\/]|$)/, /(^|[\\/])node_modules([\\/]|$)/],
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
  })
  const schedule = (path: string) => {
    const dotIndex = path.lastIndexOf('.')
    if (dotIndex < 0 || !extensions.has(path.slice(dotIndex).toLowerCase())) return
    const status = states.get(projectId)
    if (status) status.message = 'Project files changed; scheduling incremental index.'
    const existingTimer = watchTimers.get(projectId)
    if (existingTimer) clearTimeout(existingTimer)
    watchTimers.set(
      projectId,
      setTimeout(() => {
        watchTimers.delete(projectId)
        if (!controls.has(projectId)) void indexProject({ ...payload, force: false })
      }, 900)
    )
  }
  watcher.on('add', schedule).on('change', schedule).on('unlink', schedule)
  watchers.set(projectId, watcher)
}

async function queryProject(payload: RAGQueryPayload) {
  if (!payload.projectId || !payload.query.trim())
    return { success: false, message: 'Project ID and query are required.' }
  const provider = await initRAG(payload.config)
  if (!table) return { success: false, message: 'Knowledge table is unavailable.' }
  const queryVector = await getEmbedding(payload.query, provider)
  const rows = (await table
    .search(queryVector)
    .where(buildProjectPredicate(payload))
    .limit(payload.limit ?? 5)
    .toArray()) as Array<Record<string, unknown>>
  const results: RAGQueryResult[] = rows.map((row) => ({
    projectId: String(row.projectId),
    path: String(row.path),
    relativePath: String(row.relativePath),
    lineStart: Number(row.lineStart),
    lineEnd: Number(row.lineEnd),
    symbol: String(row.symbol || '') || undefined,
    language: String(row.language || '') || undefined,
    indexedAt: String(row.indexedAt),
    score: typeof row._distance === 'number' ? row._distance : undefined,
    _distance: typeof row._distance === 'number' ? row._distance : undefined,
    snippet: String(row.snippet || ''),
    text: String(row.text || '')
  }))
  return { success: true, results }
}

export function setupRAGHandlers(): void {
  ipcMain.handle('workspace-projects:list', () => listWorkspaceProjects())
  ipcMain.handle('workspace-projects:register', (_, rootPath: unknown) => {
    if (typeof rootPath !== 'string' || !rootPath) throw new Error('Invalid workspace path.')
    return registerWorkspaceProject(rootPath)
  })
  ipcMain.handle('workspace-projects:get-active', () => getActiveWorkspaceProjectId())
  ipcMain.handle('workspace-projects:set-active', async (_, projectId: unknown) => {
    if (typeof projectId !== 'string') return { success: false }
    await setActiveWorkspaceProject(projectId)
    return { success: true }
  })
  ipcMain.handle('project-map:get', async (_, projectId: unknown) => {
    if (typeof projectId !== 'string') return { success: false, message: 'Invalid project ID.' }
    const projectMap = await getStoredProjectMap(projectId)
    return projectMap
      ? { success: true, projectMap }
      : { success: false, message: 'Index this project to create its map.' }
  })
  ipcMain.handle('rag:init', async (_, config: unknown) => {
    if (!isRAGConfig(config)) return { success: false, message: 'Invalid RAG configuration.' }
    try {
      await initRAG(config)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })
  ipcMain.handle('rag:query', async (_, payload: unknown) => {
    if (!isRAGQueryPayload(payload)) return { success: false, message: 'Invalid RAG query.' }
    try {
      return await queryProject(payload)
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })
  ipcMain.handle('rag:index-project', async (_, payload: unknown) => {
    if (!isProjectIndexPayload(payload))
      return {
        ...emptyStatus(),
        success: false,
        status: 'error',
        message: 'Invalid index request.'
      }
    try {
      return await indexProject(payload)
    } catch (error: unknown) {
      return {
        ...emptyStatus(payload.projectId),
        success: false,
        status: 'error',
        message: errorMessage(error)
      }
    }
  })
  ipcMain.handle('rag:index-status', (_, projectId: unknown) => {
    const id = typeof projectId === 'string' ? projectId : undefined
    return {
      ...((id ? states.get(id) : Array.from(states.values()).at(-1)) || emptyStatus(id))
    }
  })
  ipcMain.handle('rag:index-pause', (_, projectId: unknown) => {
    if (typeof projectId !== 'string') return { success: false }
    const control = controls.get(projectId)
    if (control) control.paused = true
    return { success: Boolean(control) }
  })
  ipcMain.handle('rag:index-resume', (_, projectId: unknown) => {
    if (typeof projectId !== 'string') return { success: false }
    const control = controls.get(projectId)
    if (control) control.paused = false
    return { success: Boolean(control) }
  })
  ipcMain.handle('rag:index-cancel', (_, projectId: unknown) => {
    if (typeof projectId !== 'string') return { success: false }
    const control = controls.get(projectId)
    if (control) control.cancelRequested = true
    const status = states.get(projectId)
    if (status) status.cancelRequested = true
    return { success: Boolean(control) }
  })
  ipcMain.handle('project:health-check', async (_, payload: unknown) => {
    if (!isRecord(payload) || typeof payload.rootPath !== 'string' || !payload.rootPath)
      return { success: false, message: 'Invalid project path.' }
    try {
      return { success: true, report: await buildProjectHealth(payload.rootPath) }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })
  ipcMain.handle('rag:clear', async () => {
    try {
      if (db)
        for (const name of (await db.tableNames()).filter(
          (item) =>
            item.startsWith(TABLE_PREFIX) ||
            LEGACY_TABLE_NAMES.has(item) ||
            LEGACY_TABLE_PREFIXES.some((prefix) => item.startsWith(prefix))
        ))
          await db.dropTable(name)
      table = null
      activeTableName = ''
      states.clear()
      await Promise.all(Array.from(watchers.values()).map((watcher) => watcher.close()))
      watchers.clear()
      return { success: true }
    } catch {
      return { success: false }
    }
  })
}

async function buildProjectHealth(rootPath: string): Promise<ProjectHealthReport> {
  const scan = await scanProject({ rootPath, extensions: DEFAULT_EXTENSIONS })
  const findings: ProjectHealthFinding[] = []
  const readme = await fs.readFile(join(scan.rootPath, 'README.md'), 'utf-8').catch(() => '')
  const packageJson = await fs
    .readFile(join(scan.rootPath, 'package.json'), 'utf-8')
    .catch(() => '')
  const packageData = parseJsonRecord(packageJson)
  findings.push({
    title: 'README quality',
    status:
      readme.length > 900 && /npm (?:run )?(?:dev|start)/i.test(readme) ? 'good' : 'needs-work',
    detail: readme
      ? `${readme.length} characters; quickstart ${/npm (?:run )?(?:dev|start)/i.test(readme) ? 'detected' : 'missing'}.`
      : 'README.md was not found.'
  })
  const trackedFiles = await runCommand('git', ['-C', scan.rootPath, 'ls-files'])
  const sensitiveFiles = trackedFiles.output
    .split(/\r?\n/)
    .filter((path) =>
      /(^|\/)(\.env(?:\..+)?|id_rsa|id_ed25519|credentials\.json|secrets?\.ya?ml)$/i.test(path)
    )
  findings.push({
    title: 'Sensitive files',
    status: sensitiveFiles.length ? 'needs-work' : 'good',
    detail: sensitiveFiles.length
      ? `${sensitiveFiles.length} tracked path(s) match sensitive filename rules.`
      : 'No tracked path matches the sensitive filename rules.'
  })
  const tests = scan.files.filter(
    (file) =>
      /(^|\/)(tests?|e2e)\//i.test(file.relativePath) || /\.(test|spec)\./i.test(file.relativePath)
  )
  findings.push({
    title: 'Test distribution',
    status: tests.length ? 'good' : 'needs-work',
    detail: `${tests.length} test files across ${scan.files.length} scanned files.`
  })
  const largeModules = scan.files.filter((file) => file.bytes > 100 * 1024)
  findings.push({
    title: 'Large modules',
    status: largeModules.length ? 'watch' : 'good',
    detail: largeModules.length
      ? `${largeModules.length} indexed source file(s) exceed 100 KB.`
      : 'No indexed source file exceeds 100 KB.'
  })
  const license = typeof packageData?.license === 'string' ? packageData.license : ''
  const licenseFile = await fs
    .stat(join(scan.rootPath, 'LICENSE'))
    .then(() => true)
    .catch(() => false)
  findings.push({
    title: 'License',
    status: license || licenseFile ? 'good' : 'needs-work',
    detail: license
      ? `package.json declares ${license}.`
      : licenseFile
        ? 'A LICENSE file is present.'
        : 'No package license field or LICENSE file was found.'
  })
  const git = await runCommand('git', ['-C', scan.rootPath, 'status', '--porcelain'])
  findings.push({
    title: 'Git workspace',
    status: git.available ? (git.output.trim() ? 'watch' : 'good') : 'unavailable',
    detail: git.available
      ? git.output.trim()
        ? `${git.output.trim().split(/\r?\n/).length} uncommitted path(s).`
        : 'Working tree is clean.'
      : 'Git status is unavailable.'
  })
  const audit = await runCommand(
    'npm',
    ['audit', '--omit=dev', '--json', '--registry=https://registry.npmjs.org'],
    scan.rootPath,
    30000
  )
  const auditAvailable = audit.available && audit.output.includes('"metadata"')
  findings.push({
    title: 'Dependency audit',
    status: auditAvailable ? (audit.exitCode === 0 ? 'good' : 'watch') : 'unavailable',
    detail: auditAvailable
      ? audit.exitCode === 0
        ? 'npm reported no production vulnerabilities.'
        : 'npm audit reported findings; inspect the generated command output.'
      : 'Network or npm audit is unavailable.'
  })
  return {
    rootPath: scan.rootPath,
    scannedFiles: scan.files.length,
    findings,
    generatedAt: new Date().toISOString()
  }
}

async function runCommand(command: string, args: string[], cwd?: string, timeout = 5000) {
  try {
    const result = await execFileAsync(command, args, { cwd, windowsHide: true, timeout })
    return { available: true, exitCode: 0, output: result.stdout }
  } catch (error: unknown) {
    const value = error as { code?: string | number; stdout?: string }
    return {
      available: value.code !== 'ENOENT',
      exitCode: typeof value.code === 'number' ? value.code : 1,
      output: value.stdout || ''
    }
  }
}

function sqlList(field: string, values: string[]): string {
  return `(${values.map((value) => `${field} = '${escapeFilter(value)}'`).join(' OR ')})`
}
function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
function isRAGConfig(value: unknown): value is RAGConfigPayload {
  return isRecord(value) && typeof value.providerId === 'string' && Boolean(value.providerId.trim())
}
export function isRAGQueryPayload(value: unknown): value is RAGQueryPayload {
  if (!isRecord(value) || !isRAGConfig(value.config)) return false
  if (typeof value.projectId !== 'string' || typeof value.query !== 'string') return false
  if (value.limit !== undefined && (!Number.isInteger(value.limit) || Number(value.limit) < 1))
    return false
  if (value.filters === undefined) return true
  if (!isRecord(value.filters)) return false
  const filters = value.filters
  return ['paths', 'languages', 'symbols'].every((key) => {
    const filter = filters[key]
    return (
      filter === undefined ||
      (Array.isArray(filter) && filter.every((item) => typeof item === 'string'))
    )
  })
}
export function isProjectIndexPayload(value: unknown): value is ProjectIndexPayload {
  return (
    isRecord(value) &&
    typeof value.projectId === 'string' &&
    Boolean(value.projectId) &&
    typeof value.rootPath === 'string' &&
    Boolean(value.rootPath) &&
    Array.isArray(value.extensions) &&
    value.extensions.every(
      (extension) => typeof extension === 'string' && extension.startsWith('.')
    ) &&
    (value.excludePatterns === undefined ||
      (Array.isArray(value.excludePatterns) &&
        value.excludePatterns.every((pattern) => typeof pattern === 'string'))) &&
    (value.force === undefined || typeof value.force === 'boolean') &&
    isRAGConfig(value.config)
  )
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function buildProjectPredicate(payload: RAGQueryPayload): string {
  const predicates = [`projectId = '${escapeFilter(payload.projectId)}'`]
  if (payload.filters?.languages?.length)
    predicates.push(sqlList('language', payload.filters.languages))
  if (payload.filters?.paths?.length)
    predicates.push(sqlList('relativePath', payload.filters.paths))
  if (payload.filters?.symbols?.length) predicates.push(sqlList('symbol', payload.filters.symbols))
  return predicates.join(' AND ')
}
function escapeFilter(value: string): string {
  return value.replace(/'/g, "''")
}
function hash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown project knowledge error.'
}
