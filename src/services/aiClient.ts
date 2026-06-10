/**
 * AI Client Service
 * 统一的 AI API 调用服务，支持流式响应
 */

export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string // 格式: "data:image/jpeg;base64,{base64_data}"
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export interface StreamCallbacks {
  onStart?: () => void
  onToken?: (token: string) => void
  onComplete?: (fullText: string) => void
  onError?: (error: Error) => void
}

export interface AIClientConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export class AIClient {
  private config: AIClientConfig
  private abortController: AbortController | null = null

  constructor(config: AIClientConfig) {
    this.config = config
  }

  /**
   * 更新客户端配置
   */
  updateConfig(config: Partial<AIClientConfig>) {
    this.config = { ...this.config, ...config }
  }

  /**
   * 停止当前流式请求
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * 发送聊天请求（流式响应）
   */
  async chat(messages: ChatMessage[], callbacks: StreamCallbacks = {}): Promise<string> {
    const { onStart, onToken, onComplete, onError } = callbacks

    this.abortController = new AbortController()
    let fullText = ''

    try {
      onStart?.()

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: true
        }),
        signal: this.abortController.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((line) => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta
              const content = delta?.content || ''

              if (content) {
                fullText += content
                onToken?.(content)
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      onComplete?.(fullText)
      return fullText
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          onComplete?.(fullText)
          return fullText
        }
        onError?.(error)
        throw error
      }
      throw error
    } finally {
      this.abortController = null
    }
  }

  /**
   * 测试 API 连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        }
      })

      if (response.ok) {
        return { success: true, message: '连接成功' }
      } else {
        const error = await response.json().catch(() => ({}))
        return {
          success: false,
          message: error.error?.message || `HTTP ${response.status}`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '连接失败'
      }
    }
  }
}

// 单例实例
let aiClientInstance: AIClient | null = null

export function getAIClient(): AIClient | null {
  return aiClientInstance
}

export function createAIClient(config: AIClientConfig): AIClient {
  aiClientInstance = new AIClient(config)
  return aiClientInstance
}

export function destroyAIClient() {
  if (aiClientInstance) {
    aiClientInstance.abort()
    aiClientInstance = null
  }
}
