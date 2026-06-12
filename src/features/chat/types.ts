import type { RAGCitation } from '@/services/ragService'

export interface MessageImage {
  url: string
  base64: string
  type: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  images?: MessageImage[]
  citations?: RAGCitation[]
}

export interface Session {
  id: string
  projectId?: string
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
  enableMemory: boolean
  useRAG: boolean
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  temperature: 0.7,
  contextLength: 10,
  enableMemory: true,
  useRAG: false
}
