import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  abort: vi.fn(),
  chat: vi.fn(),
  query: vi.fn()
}))

vi.mock('@/services/aiClient', () => ({
  getAIClient: () => ({ abort: mocks.abort, chat: mocks.chat }),
  createAIClient: vi.fn(),
  destroyAIClient: vi.fn()
}))

vi.mock('@/services/ragService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/ragService')>()
  return {
    ...original,
    RAGService: {
      ...original.RAGService,
      query: mocks.query,
      mapResultsToCitations: vi.fn(() => [])
    }
  }
})

import { useChatConversation } from '@/features/chat/composables/useChatConversation'
import { useChatStore } from '@/stores/chat'
import { useConfigStore } from '@/stores/config'

describe('useChatConversation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.abort.mockReset()
    mocks.chat.mockReset()
    mocks.query.mockReset()
    vi.mocked(window.api.saveChatSnapshot).mockClear()
    const config = useConfigStore()
    config.configs.push({
      id: 'provider',
      providerId: 'openai',
      providerName: 'OpenAI',
      baseUrl: 'https://api.example.com/v1',
      kind: 'openai-compatible',
      models: ['model'],
      selectedModel: 'model',
      embeddingModel: 'embed-model',
      requiresApiKey: true,
      hasCredential: true,
      timeoutMs: 120000,
      isActive: true
    })
    config.activeConfigId = 'provider'
  })

  it('streams tokens in memory and persists the completed response', async () => {
    mocks.chat.mockImplementation(async (_messages, callbacks) => {
      callbacks.onToken?.('Hello')
      callbacks.onToken?.(' world')
      return 'Hello world'
    })
    const store = useChatStore()
    store.createSession()
    vi.mocked(localStorage.setItem).mockClear()
    vi.mocked(window.api.saveChatSnapshot).mockClear()

    await useChatConversation().send('Hi')

    expect(store.activeSession?.messages.at(-1)?.content).toBe('Hello world')
    expect(store.isStreaming).toBe(false)
    expect(window.api.saveChatSnapshot).toHaveBeenCalledTimes(1)
  })

  it('records failures in the assistant message and supports stopping', async () => {
    mocks.chat.mockRejectedValueOnce(new Error('Network unavailable'))
    const store = useChatStore()
    store.createSession()
    const conversation = useChatConversation()

    await conversation.send('Hi')
    expect(store.activeSession?.messages.at(-1)?.content).toContain('Network unavailable')

    store.setStreaming('assistant')
    conversation.stop()
    expect(mocks.abort).toHaveBeenCalledOnce()
    expect(store.isStreaming).toBe(false)
  })
})
