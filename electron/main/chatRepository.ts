import { app, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { ChatSnapshotDocument } from '../../src/shared/types/ipc'

const CHAT_FILE = 'chat-snapshot.json'

function snapshotPath(): string {
  return join(app.getPath('userData'), CHAT_FILE)
}

export function setupChatRepositoryHandlers(): void {
  ipcMain.handle('chat:snapshot:get', async () => {
    try {
      const value: unknown = JSON.parse(await fs.readFile(snapshotPath(), 'utf-8'))
      return isChatSnapshot(value) ? value : null
    } catch {
      return null
    }
  })
  ipcMain.handle('chat:snapshot:set', async (_, value: unknown) => {
    if (!isChatSnapshot(value)) throw new Error('Invalid chat snapshot.')
    const tempPath = `${snapshotPath()}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf-8')
    await fs.rename(tempPath, snapshotPath())
    return { success: true }
  })
}

export function isChatSnapshot(value: unknown): value is ChatSnapshotDocument {
  if (!isRecord(value)) return false
  const snapshot = value as Partial<ChatSnapshotDocument>
  return (
    snapshot.version === 3 &&
    Array.isArray(snapshot.sessions) &&
    snapshot.sessions.every(isSession) &&
    (snapshot.activeSessionId === null || typeof snapshot.activeSessionId === 'string') &&
    typeof snapshot.currentRoleId === 'string' &&
    isSettings(snapshot.settings)
  )
}

function isSession(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.messages)) return false
  return (
    typeof value.id === 'string' &&
    (value.projectId === undefined || typeof value.projectId === 'string') &&
    typeof value.title === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    value.messages.every(isMessage)
  )
}

function isMessage(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    ['user', 'assistant', 'system'].includes(String(value.role)) &&
    typeof value.content === 'string' &&
    typeof value.timestamp === 'number' &&
    (value.images === undefined || Array.isArray(value.images)) &&
    (value.citations === undefined || Array.isArray(value.citations))
  )
}

function isSettings(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.temperature === 'number' &&
    typeof value.contextLength === 'number' &&
    typeof value.enableMemory === 'boolean' &&
    typeof value.useRAG === 'boolean'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
