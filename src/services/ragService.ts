/**
 * RAG Service (Renderer Side)
 * 处理文档解析、切片及与主进程 RAG 模块的通信
 */

import { useConfigStore } from '@/stores'

export interface DocumentChunk {
  text: string
  metadata: {
    source: string
    page?: number
    [key: string]: any
  }
}

export class RAGService {
  /**
   * 将文档解析并切片
   */
  static async parseAndChunk(file: File): Promise<DocumentChunk[]> {
    const extension = file.name.split('.').pop()?.toLowerCase()
    let text = ''

    if (extension === 'md' || extension === 'txt') {
      text = await file.text()
    } else if (extension === 'pdf') {
       // PDF 解析通常在渲染进程较重，但为了简单这里先做占位处理
       // 实际生产中可能需要调用主进程的 pdf-parse
       // 这里我们先假设通过 FileReader 读取 arrayBuffer
       text = "PDF Content Placeholder (需要集成 pdf-parse)"
    } else {
      throw new Error(`不支持的文件格式: ${extension}`)
    }

    return this.chunkText(text, file.name)
  }

  /**
   * 文本切片逻辑 (递归字符切片模拟)
   */
  private static chunkText(text: string, source: string, chunkSize = 800, overlap = 100): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    let start = 0

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length)
      let chunk = text.slice(start, end)
      
      chunks.push({
        text: chunk,
        metadata: { source }
      })

      start += (chunkSize - overlap)
    }

    return chunks
  }

  /**
   * 初始化主进程知识库
   */
  static async init() {
    const configStore = useConfigStore()
    const activeConfig = configStore.activeConfig
    if (!activeConfig) throw new Error('未激活 API 配置')

    return await window.api.ragInit({
      apiKey: activeConfig.apiKey,
      baseUrl: activeConfig.baseUrl,
      model: activeConfig.selectedModel
    })
  }

  /**
   * 注入文档到知识库
   */
  static async ingest(file: File) {
    const configStore = useConfigStore()
    const activeConfig = configStore.activeConfig
    if (!activeConfig) throw new Error('未激活 API 配置')

    // 1. 解析切片
    const chunks = await this.parseAndChunk(file)
    
    // 2. 调用主进程注入
    return await window.api.ragIngest({
      chunks,
      config: {
        apiKey: activeConfig.apiKey,
        baseUrl: activeConfig.baseUrl
      }
    })
  }

  /**
   * 检索相关上下文
   */
  static async query(query: string, limit = 3) {
    const configStore = useConfigStore()
    const activeConfig = configStore.activeConfig
    if (!activeConfig) throw new Error('未激活 API 配置')

    return await window.api.ragQuery({
      query,
      limit,
      config: {
        apiKey: activeConfig.apiKey,
        baseUrl: activeConfig.baseUrl
      }
    })
  }
}
