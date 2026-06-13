import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '@/stores/chat'

describe('chat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(localStorage.setItem).mockClear()
    vi.mocked(window.api.saveChatSnapshot).mockClear()
  })

  it('creates, renames, and deletes sessions', () => {
    const store = useChatStore()
    const id = store.createSession()

    store.renameSession(id, 'Architecture review')
    expect(store.activeSession?.title).toBe('Architecture review')

    store.deleteSession(id)
    expect(store.sessions).toHaveLength(0)
    expect(store.activeSessionId).toBeNull()
  })

  it('does not persist every streamed token', () => {
    const store = useChatStore()
    const sessionId = store.createSession()
    const messageId = store.addMessage(sessionId, { role: 'assistant', content: '' }, false)
    vi.mocked(localStorage.setItem).mockClear()
    vi.mocked(window.api.saveChatSnapshot).mockClear()

    store.appendMessageToken(sessionId, messageId!, 'one')
    store.appendMessageToken(sessionId, messageId!, ' two')

    expect(store.activeSession?.messages[0].content).toBe('one two')
    expect(window.api.saveChatSnapshot).not.toHaveBeenCalled()
    store.persist()
    expect(window.api.saveChatSnapshot).toHaveBeenCalledTimes(1)
    expect(() =>
      structuredClone(vi.mocked(window.api.saveChatSnapshot).mock.calls[0][0])
    ).not.toThrow()
  })
})
