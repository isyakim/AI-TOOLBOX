import { describe, expect, it } from 'vitest'
import {
  loadChatSnapshot,
  saveChatSnapshot,
  type ChatSnapshot
} from '@/features/chat/repositories/chatRepository'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const defaults = {
  temperature: 0.7,
  contextLength: 10,
  enableStream: true,
  enableMemory: true,
  useRAG: false
}

const options = {
  defaultRoleId: 'roo-helper',
  defaultSettings: defaults,
  validRoleIds: ['roo-helper', 'roo-coder']
}

describe('chatRepository', () => {
  it('round-trips a versioned snapshot', () => {
    const storage = new MemoryStorage()
    const snapshot: ChatSnapshot = {
      version: 1,
      sessions: [],
      activeSessionId: null,
      currentRoleId: 'roo-coder',
      settings: defaults
    }

    saveChatSnapshot(snapshot, storage)

    expect(loadChatSnapshot(options, storage)).toEqual(snapshot)
  })

  it('ignores malformed sessions and normalizes invalid preferences', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'ai-toolbox-chat',
      JSON.stringify({
        version: 1,
        sessions: [{ id: 1 }],
        activeSessionId: 'missing',
        currentRoleId: 'unknown',
        settings: { contextLength: 'many', useRAG: true }
      })
    )

    expect(loadChatSnapshot(options, storage)).toEqual({
      version: 1,
      sessions: [],
      activeSessionId: null,
      currentRoleId: 'roo-helper',
      settings: { ...defaults, useRAG: true }
    })
  })

  it('migrates legacy keys into the versioned snapshot', () => {
    const storage = new MemoryStorage()
    storage.setItem('ai-toolbox-sessions', '[]')
    storage.setItem('ai-toolbox-chat-settings', JSON.stringify({ useRAG: true }))
    storage.setItem('ai-toolbox-current-role', 'roo-coder')

    const snapshot = loadChatSnapshot(options, storage)

    expect(snapshot?.currentRoleId).toBe('roo-coder')
    expect(snapshot?.settings.useRAG).toBe(true)
    expect(storage.getItem('ai-toolbox-chat')).not.toBeNull()
    expect(storage.getItem('ai-toolbox-chat-settings')).toBeNull()
  })
})
