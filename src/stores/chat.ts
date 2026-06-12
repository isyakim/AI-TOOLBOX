import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  loadChatSnapshot,
  saveChatSnapshot,
  type ChatSnapshot
} from '@/features/chat/repositories/chatRepository'
import { ROLE_MODES } from '@/features/chat/roles'
import {
  DEFAULT_CHAT_SETTINGS,
  type ChatSettings,
  type Message,
  type Session
} from '@/features/chat/types'
import type { RAGCitation } from '@/services/ragService'

export { ROLE_MODES } from '@/features/chat/roles'
export type { ChatSettings, Message, MessageImage, RoleMode, Session } from '@/features/chat/types'

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<Session[]>([])
  const activeSessionId = ref<string | null>(null)
  const isStreaming = ref(false)
  const streamingMessageId = ref<string | null>(null)
  const currentRoleId = ref(ROLE_MODES[0].id)
  const settings = ref<ChatSettings>({ ...DEFAULT_CHAT_SETTINGS })
  const searchKeyword = ref('')

  const activeSession = computed(
    () => sessions.value.find((session) => session.id === activeSessionId.value) ?? null
  )
  const currentRole = computed(
    () => ROLE_MODES.find((role) => role.id === currentRoleId.value) ?? ROLE_MODES[0]
  )
  const filteredSessions = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    return sessions.value
      .filter(
        (session) =>
          !keyword ||
          session.title.toLowerCase().includes(keyword) ||
          session.messages.some((message) => message.content.toLowerCase().includes(keyword))
      )
      .sort((left, right) => right.updatedAt - left.updatedAt)
  })
  const sessionStats = computed(() => ({
    count: activeSession.value?.messages.length ?? 0,
    time: activeSession.value ? formatRelativeTime(activeSession.value.updatedAt) : ''
  }))

  function persist() {
    const snapshot: ChatSnapshot = {
      version: 2,
      sessions: sessions.value,
      activeSessionId: activeSessionId.value,
      currentRoleId: currentRoleId.value,
      settings: settings.value
    }
    saveChatSnapshot(snapshot)
  }

  function createSession(): string {
    const now = Date.now()
    const session: Session = {
      id: crypto.randomUUID(),
      title: 'New conversation',
      messages: [],
      createdAt: now,
      updatedAt: now
    }
    sessions.value.unshift(session)
    activeSessionId.value = session.id
    persist()
    return session.id
  }

  function switchSession(id: string) {
    if (!sessions.value.some((session) => session.id === id)) return
    activeSessionId.value = id
    persist()
  }

  function deleteSession(id: string) {
    sessions.value = sessions.value.filter((session) => session.id !== id)
    if (activeSessionId.value === id) activeSessionId.value = sessions.value[0]?.id ?? null
    persist()
  }

  function renameSession(id: string, title: string) {
    const session = findSession(id)
    if (!session || !title.trim()) return
    session.title = title.trim()
    session.updatedAt = Date.now()
    persist()
  }

  function addMessage(
    sessionId: string,
    message: Omit<Message, 'id' | 'timestamp'>,
    shouldPersist = true
  ): string | null {
    const session = findSession(sessionId)
    if (!session) return null

    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    }
    session.messages.push(newMessage)
    touchSession(session, message.role === 'user' ? message.content : undefined)
    if (shouldPersist) persist()
    return newMessage.id
  }

  function updateMessage(
    sessionId: string,
    messageId: string,
    content: string,
    shouldPersist = true
  ) {
    const session = findSession(sessionId)
    const message = session?.messages.find((item) => item.id === messageId)
    if (!session || !message) return
    message.content = content
    session.updatedAt = Date.now()
    if (shouldPersist) persist()
  }

  function appendMessageToken(sessionId: string, messageId: string, token: string) {
    const session = findSession(sessionId)
    const message = session?.messages.find((item) => item.id === messageId)
    if (!session || !message) return
    message.content += token
    session.updatedAt = Date.now()
  }

  function updateMessageCitations(sessionId: string, messageId: string, citations: RAGCitation[]) {
    const session = findSession(sessionId)
    const message = session?.messages.find((item) => item.id === messageId)
    if (!message) return
    message.citations = citations
  }

  function deleteMessage(sessionId: string, messageId: string) {
    const session = findSession(sessionId)
    if (!session) return
    session.messages = session.messages.filter((message) => message.id !== messageId)
    session.updatedAt = Date.now()
    persist()
  }

  function clearSession(sessionId: string) {
    const session = findSession(sessionId)
    if (!session) return
    session.messages = []
    session.updatedAt = Date.now()
    persist()
  }

  function setRole(roleId: string) {
    if (!ROLE_MODES.some((role) => role.id === roleId)) return
    currentRoleId.value = roleId
    persist()
  }

  function updateSettings(updates: Partial<ChatSettings>) {
    settings.value = { ...settings.value, ...updates }
    persist()
  }

  function setSearchKeyword(keyword: string) {
    searchKeyword.value = keyword
  }

  function setStreaming(messageId: string | null) {
    streamingMessageId.value = messageId
    isStreaming.value = messageId !== null
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
    if (!sessions.value.length) createSession()
    else if (!activeSessionId.value) {
      activeSessionId.value = sessions.value[0].id
      persist()
    }
  }

  function findSession(id: string) {
    return sessions.value.find((session) => session.id === id)
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
    appendMessageToken,
    updateMessageCitations,
    deleteMessage,
    clearSession,
    setRole,
    updateSettings,
    setSearchKeyword,
    setStreaming,
    persist,
    loadFromStorage
  }
})

function touchSession(session: Session, userContent?: string) {
  session.updatedAt = Date.now()
  if (session.title !== 'New conversation' || !userContent?.trim()) return
  session.title = `${userContent.slice(0, 30)}${userContent.length > 30 ? '...' : ''}`
}

function formatRelativeTime(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(timestamp).toLocaleDateString()
}
