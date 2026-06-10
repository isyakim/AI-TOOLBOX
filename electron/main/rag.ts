import { ipcMain, app } from 'electron'
import { join, relative, extname } from 'path'
import { promises as fs } from 'fs'
import { createHash } from 'node:crypto'
import OpenAI from 'openai'

// 延迟导入 lancedb，因为它的原生模块可能不兼容
let lancedb: any = null
let lancedbLoadError: string | null = null

async function getLanceDB() {
  if (lancedb) return lancedb
  if (lancedbLoadError) throw new Error(lancedbLoadError)

  try {
    lancedb = await import('@lancedb/lancedb')
    return lancedb
  } catch (error: any) {
    lancedbLoadError = `LanceDB 加载失败: ${error.message}。知识库功能暂不可用。`
    console.error(lancedbLoadError)
    throw new Error(lancedbLoadError)
  }
}

interface RAGConfig {
  apiKey: string
  baseUrl: string
  model?: string
  embeddingModel?: string
}

let db: any = null
let table: any = null
const TABLE_NAME = 'knowledge_base_v2'
const INDEX_VERSION = 2
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

const indexState = {
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

export async function initRAG(_config: RAGConfig) {
  const lance = await getLanceDB()
  const dbPath = join(app.getPath('userData'), 'vector_db')
  db = await lance.connect(dbPath)

  const tables = await db.tableNames()
  if (!tables.includes(TABLE_NAME)) {
    // Initial dummy data to set schema
    const initialData = [
      {
        id: 'init',
        vector: new Array(1536).fill(0),
        text: 'Initial data',
        projectId: 'system',
        path: '',
        relativePath: '',
        fileHash: '',
        metadata: { source: 'system' }
      }
    ]
    table = await db.createTable(TABLE_NAME, initialData)
  } else {
    table = await db.openTable(TABLE_NAME)
  }
}

async function getEmbedding(text: string, config: RAGConfig): Promise<number[]> {
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: false // Running in main process
  })

  // Update base URL if it's a custom provider like DeepSeek but usually embeddings need OpenAI/HuggingFace
  // Let's assume OpenAI embedding format. Many providers support it.
  const response = await openai.embeddings.create({
    model: config.embeddingModel || 'text-embedding-3-small',
    input: text
  })

  return response.data[0].embedding
}

function resetIndexState(status = 'idle') {
  indexState.status = status
  indexState.totalFiles = 0
  indexState.indexedFiles = 0
  indexState.totalChunks = 0
  indexState.currentFile = ''
  indexState.startedAt = status === 'indexing' ? Date.now() : 0
  indexState.completedAt = 0
  indexState.message = ''
}

function chunkText(text: string, metadata: Record<string, any>, chunkSize = 1200, overlap = 160) {
  const chunks: Array<{ text: string; metadata: Record<string, any> }> = []
  let start = 0
  let chunkIndex = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    const chunk = text.slice(start, end).trim()

    if (chunk) {
      chunks.push({
        text: chunk,
        metadata: {
          ...metadata,
          chunkIndex,
          snippet: chunk.slice(0, 360)
        }
      })
      chunkIndex += 1
    }

    start += chunkSize - overlap
  }

  return chunks
}

interface ProjectManifest {
  version: number
  projects: Record<
    string,
    { rootPath: string; embeddingModel: string; files: Record<string, string> }
  >
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readManifest(): Promise<ProjectManifest> {
  try {
    return JSON.parse(
      await fs.readFile(join(app.getPath('userData'), 'rag-index-manifest.json'), 'utf-8')
    ) as ProjectManifest
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

async function scanProjectFiles(rootPath: string, extensions: string[]) {
  const files: string[] = []
  const allowed = new Set(extensions.map((ext) => ext.toLowerCase()))

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(fullPath)
        }
        continue
      }

      if (!entry.isFile()) continue

      const extension = extname(entry.name).toLowerCase()
      if (!allowed.has(extension)) continue

      const stat = await fs.stat(fullPath)
      if (stat.size <= MAX_FILE_BYTES) {
        files.push(fullPath)
      }
    }
  }

  await walk(rootPath)
  return files
}

async function ingestChunks(
  chunks: Array<{ text: string; metadata: Record<string, any> }>,
  config: RAGConfig
) {
  if (!table || !chunks.length) return 0

  const dataWithEmbeddings = []
  for (const chunk of chunks) {
    const vector = await getEmbedding(chunk.text, config)
    dataWithEmbeddings.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      vector,
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

async function buildProjectHealth(rootPath: string) {
  const readText = async (path: string) => {
    try {
      return await fs.readFile(join(rootPath, path), 'utf-8')
    } catch {
      return ''
    }
  }

  const [readme, packageJson] = await Promise.all([readText('README.md'), readText('package.json')])

  const allFiles = await scanProjectFiles(rootPath, DEFAULT_EXTENSIONS)
  const relativeFiles = allFiles.map((file) => relative(rootPath, file).replace(/\\/g, '/'))
  const testFiles = relativeFiles.filter(
    (file) => /(^|\/)(tests?|e2e)\//i.test(file) || /\.(test|spec)\./i.test(file)
  )
  const sourceFiles = relativeFiles.filter((file) => /^src\//.test(file))
  const packageData = packageJson ? JSON.parse(packageJson) : null
  const deps = packageData
    ? Object.keys({ ...(packageData.dependencies || {}), ...(packageData.devDependencies || {}) })
    : []

  const findings = [
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
  ]

  return {
    rootPath,
    scannedFiles: relativeFiles.length,
    findings,
    generatedAt: new Date().toISOString()
  }
}

export function setupRAGHandlers() {
  // 初始化接口
  ipcMain.handle('rag:init', async (_, config) => {
    try {
      await initRAG(config)
      return { success: true }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  // 注入文档
  ipcMain.handle('rag:ingest', async (_, payload) => {
    const { chunks, config } = payload
    if (!table || !chunks.length) return { success: false, message: '知识库未就绪或块为空' }

    try {
      const count = await ingestChunks(chunks, config)
      return { success: true, chunks: count }
    } catch (error: any) {
      console.error('RAG Ingest Error:', error)
      return { success: false, message: error.message }
    }
  })

  // 检索文档
  ipcMain.handle('rag:query', async (_, payload) => {
    const { query, config, limit = 5 } = payload
    if (!table) return { success: false, message: '知识库未就绪' }

    try {
      const queryVector = await getEmbedding(query, config)
      const results = await table.search(queryVector).limit(limit).toArray()

      return { success: true, results }
    } catch (error: any) {
      console.error('RAG Query Error:', error)
      return { success: false, message: error.message }
    }
  })

  ipcMain.handle('rag:index-project', async (_, payload) => {
    const { rootPath, extensions = DEFAULT_EXTENSIONS, config } = payload
    if (!rootPath) return { success: false, message: 'Project path is required' }

    try {
      if (!table) {
        await initRAG(config)
      }

      resetIndexState('indexing')
      indexState.rootPath = rootPath
      const files = await scanProjectFiles(rootPath, extensions)
      indexState.totalFiles = files.length
      const realRoot = await fs.realpath(rootPath)
      const projectId = hash(realRoot).slice(0, 24)
      const embeddingModel = config.embeddingModel || 'text-embedding-3-small'
      const manifest = await readManifest()
      const previous = manifest.projects[projectId]
      const previousFiles = previous?.embeddingModel === embeddingModel ? previous.files : {}
      const currentFiles: Record<string, string> = {}

      if (previous && previous.embeddingModel !== embeddingModel) {
        await table.delete(`projectId = '${escapeFilter(projectId)}'`)
      }

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

        indexState.totalChunks += await ingestChunks(chunks, config)
        indexState.indexedFiles += 1
      }

      manifest.version = INDEX_VERSION
      manifest.projects[projectId] = { rootPath: realRoot, embeddingModel, files: currentFiles }
      await writeManifest(manifest)

      indexState.status = 'ready'
      indexState.completedAt = Date.now()
      indexState.currentFile = ''
      indexState.message = `Scanned ${indexState.indexedFiles} files and updated ${indexState.totalChunks} chunks.`
      return {
        success: true,
        projectId,
        indexVersion: INDEX_VERSION,
        embeddingModel,
        ...indexState
      }
    } catch (error: any) {
      indexState.status = 'error'
      indexState.message = error.message
      return { success: false, ...indexState }
    }
  })

  ipcMain.handle('rag:index-status', async () => ({ success: true, ...indexState }))

  ipcMain.handle('project:health-check', async (_, payload) => {
    try {
      const report = await buildProjectHealth(payload.rootPath)
      return { success: true, report }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  })

  // 清空知识库
  ipcMain.handle('rag:clear', async () => {
    if (!db) return { success: false }
    try {
      await db.dropTable(TABLE_NAME)
      const initialData = [
        {
          id: 'init',
          vector: new Array(1536).fill(0),
          text: 'Init',
          projectId: 'system',
          path: '',
          relativePath: '',
          fileHash: '',
          metadata: {}
        }
      ]
      table = await db.createTable(TABLE_NAME, initialData)
      await writeManifest({ version: INDEX_VERSION, projects: {} })
      resetIndexState()
      return { success: true }
    } catch {
      return { success: false }
    }
  })
}
