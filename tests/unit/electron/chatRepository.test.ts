import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn() },
  ipcMain: { handle: vi.fn() }
}))

import { isChatSnapshot } from '../../../electron/main/chatRepository'

describe('main-process chat snapshots', () => {
  it('validates the complete persisted shape', () => {
    expect(
      isChatSnapshot({
        version: 3,
        sessions: [],
        activeSessionId: null,
        currentRoleId: 'assistant',
        settings: {
          temperature: 0.7,
          contextLength: 10,
          enableMemory: true,
          useRAG: false
        }
      })
    ).toBe(true)
    expect(
      isChatSnapshot({
        version: 3,
        sessions: [{ id: 'broken', messages: 'not-an-array' }],
        activeSessionId: null,
        currentRoleId: 'assistant',
        settings: {}
      })
    ).toBe(false)
  })
})
