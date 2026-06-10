import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAIClient } from '@/services/aiClient'
import type { ChatMessage as AIMessage, ContentPart } from '@/services/aiClient'
import { RAGService } from '@/services/ragService'
import type { RAGCitation } from '@/services/ragService'
import type { ImageInfo } from '@/utils/imageUtils'
import {
  loadChatSnapshot,
  saveChatSnapshot,
  type ChatSnapshot
} from '@/features/chat/repositories/chatRepository'

export interface MessageImage {
  url: string // 预览 URL
  base64: string // Base64 编码
  type: string // MIME 类型
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  images?: MessageImage[] // 附加的图片
  citations?: RAGCitation[]
}

export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export interface RoleMode {
  id: string
  title: string
  desc: string
  prompt: string
}

export interface ChatSettings {
  temperature: number
  contextLength: number
  enableStream: boolean
  enableMemory: boolean
  useRAG: boolean
}

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  temperature: 0.7,
  contextLength: 10,
  enableStream: true,
  enableMemory: true,
  useRAG: false
}

export const ROLE_MODES: RoleMode[] = [
  {
    id: 'roo-helper',
    title: 'Roo · 默认助手',
    desc: '友好万能型，回答清晰有条理。',
    prompt:
      '你是 Roo，一位沉稳可靠的助手。请以结构清晰、语气友好的方式回答，并在需要时给出可执行的步骤。'
  },
  {
    id: 'roo-coder',
    title: 'Roo · 代码专家',
    desc: '偏工程实现，输出代码与命令。',
    prompt: '你是 Roo 的代码专家。优先输出可运行的代码片段与调试命令，必要时说明风险或性能建议。'
  },
  {
    id: 'roo-product',
    title: 'Roo · 产品参谋',
    desc: '聚焦体验和策略，强调用户价值。',
    prompt: '你是 Roo 的产品参谋。回答需要兼顾用户价值、成功指标与落地建议。'
  },
  {
    id: 'roo-challenger',
    title: 'Roo · 思辨导师',
    desc: '喜欢提问和反思，激发更深层思考。',
    prompt: '你是 Roo 的思辨导师。请通过提问和反例帮助用户更深入地思考问题。'
  }
]

export const FILE_ACTION_PROMPT = `
你可以使用文件操作工具来读取、修改或删除本地文件。
请按照如下格式输出指令：

\`\`\`file-action
{
  "action": "read|write|delete",
  "path": "相对于项目根目录的路径",
  "content": "当 action 为 write/edit 时的新内容"
}
\`\`\`

注意：
- 一次可以包含多个 file-action 代码块。
- 等待用户执行结果后再继续回答。
- path 应当是相对于当前工作目录的相对路径。
`

export const useChatStore = defineStore('chat', () => {
  // State
  const sessions = ref<Session[]>([])
  const activeSessionId = ref<string | null>(null)
  const isStreaming = ref(false)
  const streamingMessageId = ref<string | null>(null)
  const currentRoleId = ref<string>('roo-helper')
  const settings = ref<ChatSettings>({ ...DEFAULT_CHAT_SETTINGS })
  const searchKeyword = ref('')

  // Getters
  const activeSession = computed(
    () => sessions.value.find((s) => s.id === activeSessionId.value) || null
  )

  const currentRole = computed(
    () => ROLE_MODES.find((r) => r.id === currentRoleId.value) || ROLE_MODES[0]
  )

  const filteredSessions = computed(() => {
    const keyword = searchKeyword.value.toLowerCase()
    let result = [...sessions.value]

    if (keyword) {
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(keyword) ||
          s.messages.some((m) => m.content.toLowerCase().includes(keyword))
      )
    }

    return result.sort((a, b) => b.updatedAt - a.updatedAt)
  })

  const sessionStats = computed(() => {
    if (!activeSession.value) return { count: 0, time: '' }
    const count = activeSession.value.messages.length
    const date = new Date(activeSession.value.updatedAt)
    const time = formatTime(date)
    return { count, time }
  })

  function formatTime(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    return date.toLocaleDateString('zh-CN')
  }

  // Actions
  function createSession(): string {
    const id = crypto.randomUUID()
    const session: Session = {
      id,
      title: '新对话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    sessions.value.unshift(session)
    activeSessionId.value = id
    saveToStorage()
    return id
  }

  function switchSession(id: string) {
    activeSessionId.value = id
    saveToStorage()
  }

  function deleteSession(id: string) {
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (activeSessionId.value === id) {
      activeSessionId.value = sessions.value[0]?.id || null
    }
    saveToStorage()
  }

  function renameSession(id: string, title: string) {
    const session = sessions.value.find((s) => s.id === id)
    if (session) {
      session.title = title
      saveToStorage()
    }
  }

  function addMessage(
    sessionId: string,
    message: Omit<Message, 'id' | 'timestamp'>
  ): string | null {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      const newMessage: Message = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: Date.now()
      }
      session.messages.push(newMessage)
      session.updatedAt = Date.now()

      // Auto-generate title from first user message
      if (session.title === '新对话' && message.role === 'user') {
        session.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
      }

      saveToStorage()
      return newMessage.id
    }
    return null
  }

  function updateMessage(sessionId: string, messageId: string, content: string) {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      const message = session.messages.find((m) => m.id === messageId)
      if (message) {
        message.content = content
        saveToStorage()
      }
    }
  }

  function updateMessageCitations(sessionId: string, messageId: string, citations: RAGCitation[]) {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      const message = session.messages.find((m) => m.id === messageId)
      if (message) {
        message.citations = citations
        saveToStorage()
      }
    }
  }

  function deleteMessage(sessionId: string, messageId: string) {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      session.messages = session.messages.filter((m) => m.id !== messageId)
      saveToStorage()
    }
  }

  function clearSession(sessionId: string) {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      session.messages = []
      session.updatedAt = Date.now()
      saveToStorage()
    }
  }

  function setRole(roleId: string) {
    currentRoleId.value = roleId
    saveToStorage()
  }

  function updateSettings(newSettings: Partial<ChatSettings>) {
    settings.value = { ...settings.value, ...newSettings }
    saveToStorage()
  }

  function setSearchKeyword(keyword: string) {
    searchKeyword.value = keyword
  }

  /**
   * 发送消息并获取 AI 响应（流式）
   */
  async function sendMessage(content: string): Promise<void> {
    const sessionId = activeSessionId.value
    if (!sessionId) return

    const aiClient = getAIClient()
    if (!aiClient) {
      throw new Error('AI Client 未初始化，请先配置 API')
    }

    // Add user message
    addMessage(sessionId, { role: 'user', content })

    // Create assistant message placeholder
    const assistantMsgId = addMessage(sessionId, { role: 'assistant', content: '' })
    if (!assistantMsgId) return

    isStreaming.value = true
    streamingMessageId.value = assistantMsgId

    try {
      // Prepare messages for API
      const session = sessions.value.find((s) => s.id === sessionId)
      if (!session) return

      // Build context with role prompt and file action guidance
      let rolePrompt = currentRole.value.prompt + '\n' + FILE_ACTION_PROMPT
      let citations: RAGCitation[] = []

      // RAG Context Injection
      if (settings.value.useRAG) {
        try {
          const ragRes = await RAGService.query(content)
          if (ragRes.success && ragRes.results && ragRes.results.length > 0) {
            citations = RAGService.mapResultsToCitations(ragRes.results)
            updateMessageCitations(sessionId, assistantMsgId, citations)
            const contextText = citations
              .map(
                (citation, index) => `[source ${index + 1}] ${citation.source}\n${citation.snippet}`
              )
              .join('\n---\n')
            rolePrompt += `\n\nRelevant project knowledge:\n${contextText}\n\nUse this context when it is relevant. Cite the file paths naturally in your answer.`
          }
        } catch (e) {
          console.error('RAG Query Failed:', e)
        }
      }

      const contextMessages = settings.value.enableMemory
        ? session.messages.slice(-(settings.value.contextLength * 2))
        : session.messages.slice(-2)

      const apiMessages: AIMessage[] = [
        { role: 'system', content: rolePrompt },
        ...contextMessages
          .filter((m) => m.id !== assistantMsgId)
          .map((m) => ({ role: m.role, content: m.content }))
      ]

      // Stream response
      await aiClient.chat(apiMessages, {
        onToken: (token: string) => {
          updateMessage(
            sessionId,
            assistantMsgId,
            (session.messages.find((m) => m.id === assistantMsgId)?.content || '') + token
          )
        },
        onError: (error: Error) => {
          updateMessage(sessionId, assistantMsgId, `❌ 错误: ${error.message}`)
        }
      })
    } finally {
      isStreaming.value = false
      streamingMessageId.value = null
      saveToStorage()
    }
  }

  /**
   * 停止当前流式响应
   */
  function stopStreaming() {
    const aiClient = getAIClient()
    if (aiClient) {
      aiClient.abort()
    }
    isStreaming.value = false
    streamingMessageId.value = null
  }

  /**
   * 发送多模态消息（支持图片）
   */
  async function sendMultimodalMessage(content: string, images: ImageInfo[] = []): Promise<void> {
    const sessionId = activeSessionId.value
    if (!sessionId) return

    const aiClient = getAIClient()
    if (!aiClient) {
      throw new Error('AI Client 未初始化，请先配置 API')
    }

    // 构建消息图片
    const messageImages: MessageImage[] = images.map((img) => ({
      url: img.url,
      base64: img.base64,
      type: img.type
    }))

    // 添加用户消息（包含图片）
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
      images: messageImages.length > 0 ? messageImages : undefined
    }
    session.messages.push(userMessage)
    session.updatedAt = Date.now()

    // 更新会话标题
    if (session.title === '新对话') {
      session.title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
    }

    // 创建助手消息占位符
    const assistantMsgId = addMessage(sessionId, { role: 'assistant', content: '' })
    if (!assistantMsgId) return

    isStreaming.value = true
    streamingMessageId.value = assistantMsgId

    try {
      // 构建 API 消息
      let rolePrompt = currentRole.value.prompt + '\n' + FILE_ACTION_PROMPT
      let citations: RAGCitation[] = []

      // RAG 上下文注入
      if (settings.value.useRAG) {
        try {
          const ragRes = await RAGService.query(content)
          if (ragRes.success && ragRes.results && ragRes.results.length > 0) {
            citations = RAGService.mapResultsToCitations(ragRes.results)
            updateMessageCitations(sessionId, assistantMsgId, citations)
            const contextText = citations
              .map(
                (citation, index) => `[source ${index + 1}] ${citation.source}\n${citation.snippet}`
              )
              .join('\n---\n')
            rolePrompt += `\n\nRelevant project knowledge:\n${contextText}\n\nUse this context when it is relevant. Cite the file paths naturally in your answer.`
          }
        } catch (e) {
          console.error('RAG Query Failed:', e)
        }
      }

      // 获取上下文消息
      const contextMessages = settings.value.enableMemory
        ? session.messages.slice(-(settings.value.contextLength * 2))
        : session.messages.slice(-2)

      // 构建 API 消息（支持多模态）
      const apiMessages: AIMessage[] = [{ role: 'system', content: rolePrompt }]

      for (const m of contextMessages) {
        if (m.id === assistantMsgId) continue

        if (m.images && m.images.length > 0) {
          // 多模态消息：包含图片
          const contentParts: ContentPart[] = [{ type: 'text', text: m.content }]
          for (const img of m.images) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:${img.type};base64,${img.base64}` }
            })
          }
          apiMessages.push({ role: m.role, content: contentParts })
        } else {
          // 普通文本消息
          apiMessages.push({ role: m.role, content: m.content })
        }
      }

      // 执行流式请求
      await aiClient.chat(apiMessages, {
        onToken: (token: string) => {
          updateMessage(
            sessionId,
            assistantMsgId,
            (session.messages.find((m) => m.id === assistantMsgId)?.content || '') + token
          )
        },
        onError: (error: Error) => {
          updateMessage(sessionId, assistantMsgId, `❌ 错误: ${error.message}`)
        }
      })
    } finally {
      isStreaming.value = false
      streamingMessageId.value = null
      saveToStorage()
    }
  }

  function saveToStorage() {
    const snapshot: ChatSnapshot = {
      version: 1,
      sessions: sessions.value,
      activeSessionId: activeSessionId.value,
      currentRoleId: currentRoleId.value,
      settings: settings.value
    }
    saveChatSnapshot(snapshot)
  }

  function loadFromStorage() {
    const snapshot = loadChatSnapshot({
      defaultRoleId: ROLE_MODES[0].id,
      defaultSettings: DEFAULT_CHAT_SETTINGS,
      validRoleIds: ROLE_MODES.map((role) => role.id)
    })

    if (snapshot) {
      sessions.value = snapshot.sessions
      activeSessionId.value = snapshot.activeSessionId
      currentRoleId.value = snapshot.currentRoleId
      settings.value = snapshot.settings
    }

    if (sessions.value.length === 0) {
      createSession()
    } else if (!activeSessionId.value) {
      activeSessionId.value = sessions.value[0].id
      saveToStorage()
    }
  }

  return {
    sessions,
    activeSessionId,
    isStreaming,
    streamingMessageId,
    currentRoleId,
    settings,
    searchKeyword,
    activeSession,
    currentRole,
    filteredSessions,
    sessionStats,
    createSession,
    switchSession,
    deleteSession,
    renameSession,
    addMessage,
    updateMessage,
    updateMessageCitations,
    deleteMessage,
    clearSession,
    setRole,
    updateSettings,
    setSearchKeyword,
    sendMessage,
    sendMultimodalMessage,
    stopStreaming,
    loadFromStorage
  }
})
