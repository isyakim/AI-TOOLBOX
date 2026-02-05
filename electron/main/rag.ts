import { ipcMain, app } from 'electron'
import { join } from 'path'
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
  model: string
}

let db: any = null
let table: any = null
const TABLE_NAME = 'knowledge_base'

export async function initRAG(config: RAGConfig) {
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
    dangerouslyAllowBrowser: false // Running in main process
  })
  
  // Update base URL if it's a custom provider like DeepSeek but usually embeddings need OpenAI/HuggingFace
  // Let's assume OpenAI embedding format. Many providers support it.
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small', // Default high-performance small model
    input: text,
  })
  
  return response.data[0].embedding
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
      const dataWithEmbeddings = await Promise.all(
        chunks.map(async (chunk: { text: string; metadata: any }) => {
          const vector = await getEmbedding(chunk.text, config)
          return {
            id: Math.random().toString(36).substring(7),
            vector,
            text: chunk.text,
            metadata: chunk.metadata
          }
        })
      )

      await table.add(dataWithEmbeddings)
      return { success: true }
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
      const results = await table
        .search(queryVector)
        .limit(limit)
        .toArray()

      return { success: true, results }
    } catch (error: any) {
      console.error('RAG Query Error:', error)
      return { success: false, message: error.message }
    }
  })

  // 清空知识库
  ipcMain.handle('rag:clear', async () => {
    if (!db) return { success: false }
    try {
      await db.dropTable(TABLE_NAME)
      const initialData = [{ id: 'init', vector: new Array(1536).fill(0), text: 'Init', metadata: {} }]
      table = await db.createTable(TABLE_NAME, initialData)
      return { success: true }
    } catch (error) {
      return { success: false }
    }
  })
}
