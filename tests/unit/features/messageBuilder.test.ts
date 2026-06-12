import { describe, expect, it } from 'vitest'
import {
  buildConversationMessages,
  buildSystemPrompt,
  toAIMessage
} from '@/features/chat/services/messageBuilder'
import { ROLE_MODES } from '@/features/chat/roles'
import { DEFAULT_CHAT_SETTINGS, type Message } from '@/features/chat/types'

const message = (overrides: Partial<Message>): Message => ({
  id: crypto.randomUUID(),
  role: 'user',
  content: 'hello',
  timestamp: Date.now(),
  ...overrides
})

describe('messageBuilder', () => {
  it('adds project citations to the system prompt', () => {
    const prompt = buildSystemPrompt(ROLE_MODES[0], [
      {
        source: 'src/main.ts',
        snippet: 'createApp(App)',
        projectId: 'project',
        lineStart: 1,
        lineEnd: 1,
        indexedAt: '2026-06-12T00:00:00.000Z'
      }
    ])

    expect(prompt).toContain('src/main.ts')
    expect(prompt).toContain('createApp(App)')
  })

  it('serializes image messages for vision models', () => {
    const result = toAIMessage(
      message({ images: [{ url: 'blob:test', base64: 'abc', type: 'image/png' }] })
    )

    expect(result.content).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }
    ])
  })

  it('excludes the assistant placeholder and applies the memory limit', () => {
    const messages = [
      message({ id: 'old', content: 'old' }),
      message({ id: 'recent', content: 'recent' }),
      message({ id: 'assistant', role: 'assistant', content: '' })
    ]
    const result = buildConversationMessages({
      role: ROLE_MODES[0],
      citations: [],
      messages,
      assistantMessageId: 'assistant',
      settings: { ...DEFAULT_CHAT_SETTINGS, enableMemory: false }
    })

    expect(result).toHaveLength(2)
    expect(result[1]).toEqual({ role: 'user', content: 'recent' })
  })
})
