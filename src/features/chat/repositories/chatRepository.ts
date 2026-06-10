import type { ChatSettings, Message, Session } from '@/stores/chat'

const SNAPSHOT_KEY = 'ai-toolbox-chat'
const SNAPSHOT_VERSION = 1

const LEGACY_KEYS = {
  sessions: 'ai-toolbox-sessions',
  activeSessionId: 'ai-toolbox-active-session',
  roleId: 'ai-toolbox-current-role',
  settings: 'ai-toolbox-chat-settings'
} as const

export interface ChatSnapshot {
  version: typeof SNAPSHOT_VERSION
  sessions: Session[]
  activeSessionId: string | null
  currentRoleId: string
  settings: ChatSettings
}

interface LoadOptions {
  defaultRoleId: string
  defaultSettings: ChatSettings
  validRoleIds: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    ['user', 'assistant', 'system'].includes(String(value.role)) &&
    typeof value.content === 'string' &&
    typeof value.timestamp === 'number'
  )
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value) || !Array.isArray(value.messages)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    value.messages.every(isMessage)
  )
}

function normalizeSettings(value: unknown, defaults: ChatSettings): ChatSettings {
  if (!isRecord(value)) return { ...defaults }

  return {
    temperature: typeof value.temperature === 'number' ? value.temperature : defaults.temperature,
    contextLength:
      typeof value.contextLength === 'number' ? value.contextLength : defaults.contextLength,
    enableStream:
      typeof value.enableStream === 'boolean' ? value.enableStream : defaults.enableStream,
    enableMemory:
      typeof value.enableMemory === 'boolean' ? value.enableMemory : defaults.enableMemory,
    useRAG: typeof value.useRAG === 'boolean' ? value.useRAG : defaults.useRAG
  }
}

function parseSessions(value: unknown): Session[] {
  return Array.isArray(value) ? value.filter(isSession) : []
}

function parseJson(value: string | null): unknown {
  if (!value) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

export function saveChatSnapshot(snapshot: ChatSnapshot, storage: Storage = localStorage): void {
  storage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
}

export function loadChatSnapshot(
  options: LoadOptions,
  storage: Storage = localStorage
): ChatSnapshot | null {
  const current = parseJson(storage.getItem(SNAPSHOT_KEY))
  if (isRecord(current) && current.version === SNAPSHOT_VERSION) {
    const sessions = parseSessions(current.sessions)
    const activeSessionId =
      typeof current.activeSessionId === 'string' &&
      sessions.some((session) => session.id === current.activeSessionId)
        ? current.activeSessionId
        : (sessions[0]?.id ?? null)
    const currentRoleId = options.validRoleIds.includes(String(current.currentRoleId))
      ? String(current.currentRoleId)
      : options.defaultRoleId

    return {
      version: SNAPSHOT_VERSION,
      sessions,
      activeSessionId,
      currentRoleId,
      settings: normalizeSettings(current.settings, options.defaultSettings)
    }
  }

  const legacySessions = parseSessions(parseJson(storage.getItem(LEGACY_KEYS.sessions)))
  const hasLegacyData = legacySessions.length > 0 || storage.getItem(LEGACY_KEYS.settings) !== null
  if (!hasLegacyData) return null

  const legacyActiveSessionId = storage.getItem(LEGACY_KEYS.activeSessionId)
  const legacyRoleId = storage.getItem(LEGACY_KEYS.roleId)
  const snapshot: ChatSnapshot = {
    version: SNAPSHOT_VERSION,
    sessions: legacySessions,
    activeSessionId:
      legacyActiveSessionId &&
      legacySessions.some((session) => session.id === legacyActiveSessionId)
        ? legacyActiveSessionId
        : (legacySessions[0]?.id ?? null),
    currentRoleId:
      legacyRoleId && options.validRoleIds.includes(legacyRoleId)
        ? legacyRoleId
        : options.defaultRoleId,
    settings: normalizeSettings(
      parseJson(storage.getItem(LEGACY_KEYS.settings)),
      options.defaultSettings
    )
  }

  saveChatSnapshot(snapshot, storage)
  Object.values(LEGACY_KEYS).forEach((key) => storage.removeItem(key))
  return snapshot
}
