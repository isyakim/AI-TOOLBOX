import { app, ipcMain } from 'electron'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { extname, join, relative } from 'node:path'
import type { Connection, Table } from '@lancedb/lancedb'
import OpenAI from 'openai'
import type {
  ProjectHealthReport,
  ProviderRuntimeConfig,
  RAGConfigPayload,
  RAGIndexStatus,
  RAGIngestPayload,
  RAGQueryPayload,
  RAGQueryResult
} from '../../src/shared/types/ipc'
import { resolveProvider } from './providerRepository'

type LanceDBModule = typeof import('@lancedb/lancedb')
type ChunkMetadata = Record<string, unknown>
type KnowledgeChunk = { text: string; metadata: ChunkMetadata }

const TABLE_PREFIX = 'knowledge_base_v3_'
const LEGACY_TABLE_NAMES = new Set(['knowledge_base', 'knowledge_base_v2'])
const INDEX_VERSION = 3
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
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'out', 'build', '.next', 'coverage'])
const MAX_FILE_BYTES = 512 * 1024

let lancedb: LanceDBModule | null = null
let lancedbLoadError: string | null = null
let db: Connection | null = null
let table: Table | null = null
let activeTableName = ''

const indexState: Omit<RAGIndexStatus, 'success'> = {
  status: 'idle',
  rootPath: '',
  totalFiles: 0,
  indexedFiles: 0,
  totalChunks: 0,
  currentFile: '',
  startedAt: 0,
  completedAt: 0,
  message: ''
}

interface ProjectManifest {
  version: number
  projects: Record<
    string,
    { rootPath: string; embeddingModel: string; files: Record<string, string> }
  >
}

interface PackageDependencies {
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
}

async function getLanceDB(): Promise<LanceDBModule> {
  if (lancedb) return lancedb
  if (lancedbLoadError) throw new Error(lancedbLoadError)

  try {
    lancedb = await import('@lancedb/lancedb')
    return lancedb
  } catch (error: unknown) {
    lancedbLoadError = `LanceDB failed to load: ${errorMessage(error)}. Project knowledge is unavailable.`
    console.error(lancedbLoadError)
    throw new Error(lancedbLoadError)
  }
}

function getEmbeddingModel(config: ProviderRuntimeConfig): string {
  return config.embeddingModel?.trim() || DEFAULT_EMBEDDING_MODEL
}

export function getTableName(config: ProviderRuntimeConfig): string {
  return `${TABLE_PREFIX}${hash(getEmbeddingModel(config)).slice(0, 12)}`
}

export async function initRAG(config: RAGConfigPayload): Promise<void> {
  const provider = await resolveProvider(config.providerId)
  const lance = await getLanceDB()
  if (!db) db = await lance.connect(join(app.getPath('userData'), 'vector_db'))

  const tableName = getTableName(provider)
  if (table && activeTableName === tableName) return

  const tableNames = await db.tableNames()
  if (tableNames.includes(tableName)) {
    table = await db.openTable(tableName)
  } else {
    const initialVector = await getEmbedding('AI Toolbox knowledge index', provider)
    table = await db.createTable(tableName, [
      {
        id: 'init',
        vector: initialVector,
        text: 'Initial data',
        projectId: 'system',
        path: '',
        relativePath: '',
        fileHash: '',
        metadata: { source: 'system' }
      }
    ])
  }
  activeTableName = tableName
}

async function getEmbedding(text: string, config: ProviderRuntimeConfig): Promise<number[]> {
  const openai = new OpenAI({
    apiKey: config.apiKey || 'ollama',
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: false
  })
  const response = await openai.embeddings.create({
    model: getEmbeddingModel(config),
    input: text
  })
  return response.data[0].embedding
}

function resetIndexState(status: RAGIndexStatus['status'] = 'idle'): void {
  indexState.status = status
  indexState.totalFiles = 0
  indexState.indexedFiles = 0
  indexState.totalChunks = 0
  indexState.currentFile = ''
  indexState.startedAt = status === 'indexing' ? Date.now() : 0
  indexState.completedAt = 0
  indexState.message = ''
}

export function chunkText(
  text: string,
  metadata: ChunkMetadata,
  chunkSize = 1200,
  overlap = 160
): KnowledgeChunk[] {
  if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new Error('Chunk size must be positive and overlap must be smaller than chunk size.')
  }

  const chunks: KnowledgeChunk[] = []
  let start = 0
  let chunkIndex = 0
  while (start < text.length) {
    const chunk = text.slice(start, Math.min(start + chunkSize, text.length)).trim()
    if (chunk) {
      chunks.push({
        text: chunk,
        metadata: { ...metadata, chunkIndex, snippet: chunk.slice(0, 360) }
      })
      chunkIndex += 1
    }
    start += chunkSize - overlap
  }
  return chunks
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readManifest(): Promise<ProjectManifest> {
  try {
    const value = await fs.readFile(
      join(app.getPath('userData'), 'rag-index-manifest.json'),
      'utf-8'
    )
    const parsed = JSON.parse(value) as ProjectManifest
    return parsed.projects ? parsed : { version: INDEX_VERSION, projects: {} }
  } catch {
    return { version: INDEX_VERSION, projects: {} }
  }
}

async function writeManifest(manifest: ProjectManifest): Promise<void> {
  await fs.writeFile(
    join(app.getPath('userData'), 'rag-index-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  )
}

function escapeFilter(value: string): string {
  return value.replace(/'/g, "''")
}

async function scanProjectFiles(rootPath: string, extensions: string[]): Promise<string[]> {
  const files: string[] = []
  const allowed = new Set(extensions.map((extension) => extension.toLowerCase()))

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(fullPath)
        continue
      }
      if (!entry.isFile() || !allowed.has(extname(entry.name).toLowerCase())) continue
      const stat = await fs.stat(fullPath)
      if (stat.size <= MAX_FILE_BYTES) files.push(fullPath)
    }
  }

  await walk(rootPath)
  return files
}

async function ingestChunks(
  chunks: KnowledgeChunk[],
  config: ProviderRuntimeConfig
): Promise<number> {
  if (!table || !chunks.length) return 0
  const dataWithEmbeddings = []
  for (const chunk of chunks) {
    dataWithEmbeddings.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      vector: await getEmbedding(chunk.text, config),
      text: chunk.text,
      projectId: String(chunk.metadata.projectId || ''),
      path: String(chunk.metadata.path || ''),
      relativePath: String(chunk.metadata.relativePath || ''),
      fileHash: String(chunk.metadata.fileHash || ''),
      metadata: chunk.metadata
    })
  }
  await table.add(dataWithEmbeddings)
  return dataWithEmbeddings.length
}

async function buildProjectHealth(rootPath: string): Promise<ProjectHealthReport> {
  const readText = async (path: string): Promise<string> => {
    try {
      return await fs.readFile(join(rootPath, path), 'utf-8')
    } catch {
      return ''
    }
  }

  const [readme, packageJson] = await Promise.all([readText('README.md'), readText('package.json')])
  const relativeFiles = (await scanProjectFiles(rootPath, DEFAULT_EXTENSIONS)).map((file) =>
    relative(rootPath, file).replace(/\\/g, '/')
  )
  const testFiles = relativeFiles.filter(
    (file) => /(^|\/)(tests?|e2e)\//i.test(file) || /\.(test|spec)\./i.test(file)
  )
  const sourceFiles = relativeFiles.filter((file) => /^src\//.test(file))
  const packageData = parsePackageJson(packageJson)
  const deps = packageData
    ? Object.keys({ ...packageData.dependencies, ...packageData.devDependencies })
    : []

  return {
    rootPath,
    scannedFiles: relativeFiles.length,
    findings: [
      {
        title: 'README quality',
        status:
          readme.length > 900 && /npm run dev|pnpm dev|yarn dev/i.test(readme)
            ? 'good'
            : 'needs-work',
        detail: readme
          ? `README has ${readme.length} characters and ${/npm run dev|pnpm dev|yarn dev/i.test(readme) ? 'includes' : 'does not include'} a quickstart command.`
          : 'README.md was not found.'
      },
      {
        title: 'Dependency risk',
        status: deps.length < 80 ? 'good' : 'watch',
        detail: packageData
          ? `${deps.length} total dependencies/devDependencies. Review native or Electron packages before release.`
          : 'package.json was not found.'
      },
      {
        title: 'Test coverage signals',
        status: testFiles.length > 0 ? 'good' : 'needs-work',
        detail: `${testFiles.length} test files detected across the project.`
      },
      {
        title: 'Code structure',
        status: sourceFiles.length > 0 ? 'good' : 'needs-work',
        detail: `${sourceFiles.length} source files detected under src/. Keep shared services, stores, and UI components separated.`
      }
    ],
    generatedAt: new Date().toISOString()
  }
}

async function indexProject(payload: {
  rootPath: string
  extensions?: string[]
  config: RAGConfigPayload
}): Promise<RAGIndexStatus> {
  const { rootPath, extensions = DEFAULT_EXTENSIONS, config } = payload
  if (!rootPath) return { success: false, ...indexState, message: 'Project path is required.' }

  try {
    await initRAG(config)
    const provider = await resolveProvider(config.providerId)
    if (!table) throw new Error('Knowledge table is unavailable.')

    resetIndexState('indexing')
    indexState.rootPath = rootPath
    const files = await scanProjectFiles(rootPath, extensions)
    indexState.totalFiles = files.length
    const realRoot = await fs.realpath(rootPath)
    const projectId = hash(realRoot).slice(0, 24)
    const embeddingModel = getEmbeddingModel(provider)
    const manifest = await readManifest()
    const previous = manifest.projects[projectId]
    const previousFiles =
      manifest.version === INDEX_VERSION && previous?.embeddingModel === embeddingModel
        ? previous.files
        : {}
    const currentFiles: Record<string, string> = {}

    for (const previousPath of Object.keys(previousFiles)) {
      if (!files.includes(previousPath)) {
        await table.delete(
          `projectId = '${escapeFilter(projectId)}' AND path = '${escapeFilter(previousPath)}'`
        )
      }
    }

    for (const filePath of files) {
      const relativePath = relative(rootPath, filePath).replace(/\\/g, '/')
      indexState.currentFile = relativePath
      const text = await fs.readFile(filePath, 'utf-8')
      const fileHash = hash(text)
      currentFiles[filePath] = fileHash
      if (previousFiles[filePath] === fileHash) {
        indexState.indexedFiles += 1
        continue
      }

      await table.delete(
        `projectId = '${escapeFilter(projectId)}' AND path = '${escapeFilter(filePath)}'`
      )
      const chunks = chunkText(text, {
        projectId,
        source: relativePath,
        path: filePath,
        relativePath,
        rootPath,
        fileHash,
        indexVersion: INDEX_VERSION,
        embeddingModel,
        extension: extname(filePath).toLowerCase(),
        kind: 'project-file'
      })
      indexState.totalChunks += await ingestChunks(chunks, provider)
      indexState.indexedFiles += 1
    }

    manifest.version = INDEX_VERSION
    manifest.projects[projectId] = { rootPath: realRoot, embeddingModel, files: currentFiles }
    await writeManifest(manifest)
    indexState.status = 'ready'
    indexState.completedAt = Date.now()
    indexState.currentFile = ''
    indexState.message = `Scanned ${indexState.indexedFiles} files and updated ${indexState.totalChunks} chunks.`
    return { success: true, projectId, indexVersion: INDEX_VERSION, embeddingModel, ...indexState }
  } catch (error: unknown) {
    indexState.status = 'error'
    indexState.message = errorMessage(error)
    return { success: false, ...indexState }
  }
}

export function setupRAGHandlers(): void {
  ipcMain.handle('rag:init', async (_, config: RAGConfigPayload) => {
    try {
      await initRAG(config)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('rag:ingest', async (_, payload: RAGIngestPayload) => {
    if (!payload.chunks.length)
      return { success: false, message: 'No knowledge chunks were provided.' }
    try {
      await initRAG(payload.config)
      const provider = await resolveProvider(payload.config.providerId)
      return { success: true, chunks: await ingestChunks(payload.chunks, provider) }
    } catch (error: unknown) {
      console.error('RAG ingest error:', error)
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('rag:query', async (_, payload: RAGQueryPayload) => {
    try {
      await initRAG(payload.config)
      const provider = await resolveProvider(payload.config.providerId)
      if (!table) return { success: false, message: 'Knowledge table is unavailable.' }
      const queryVector = await getEmbedding(payload.query, provider)
      const results = (await table
        .search(queryVector)
        .limit(payload.limit ?? 5)
        .toArray()) as unknown as RAGQueryResult[]
      return { success: true, results }
    } catch (error: unknown) {
      console.error('RAG query error:', error)
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('rag:index-project', (_, payload) => indexProject(payload))
  ipcMain.handle('rag:index-status', async () => ({ success: true, ...indexState }))
  ipcMain.handle('project:health-check', async (_, payload: { rootPath: string }) => {
    try {
      return { success: true, report: await buildProjectHealth(payload.rootPath) }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('rag:clear', async () => {
    try {
      if (db) {
        const tableNames = await db.tableNames()
        for (const tableName of tableNames.filter(
          (name) => name.startsWith(TABLE_PREFIX) || LEGACY_TABLE_NAMES.has(name)
        )) {
          await db.dropTable(tableName)
        }
      }
      table = null
      activeTableName = ''
      await writeManifest({ version: INDEX_VERSION, projects: {} })
      resetIndexState()
      return { success: true }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })
}

function parsePackageJson(value: string): PackageDependencies | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return null
    const data = parsed as Record<string, unknown>
    return {
      dependencies: stringRecord(data.dependencies),
      devDependencies: stringRecord(data.devDependencies)
    }
  } catch {
    return null
  }
}

function stringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown RAG error'
}
