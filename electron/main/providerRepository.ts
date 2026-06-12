import { app, safeStorage } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type {
  ProviderPublicConfig,
  ProviderRuntimeConfig,
  ProviderSaveInput,
  ProviderState
} from '../../src/shared/types/ipc'

const PUBLIC_FILE = 'providers.json'
const CREDENTIAL_FILE = 'provider-credentials.bin'
const LEGACY_FILE = 'secure-config.bin'

interface StoredProviderState {
  configs: ProviderPublicConfig[]
  activeConfigId: string | null
}

function publicPath(): string {
  return join(app.getPath('userData'), PUBLIC_FILE)
}

function credentialPath(): string {
  return join(app.getPath('userData'), CREDENTIAL_FILE)
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}

async function readCredentials(): Promise<Record<string, string>> {
  try {
    const encrypted = await fs.readFile(credentialPath())
    return JSON.parse(safeStorage.decryptString(encrypted)) as Record<string, string>
  } catch {
    return {}
  }
}

async function writeCredentials(credentials: Record<string, string>): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Operating system credential encryption is unavailable.')
  }
  await fs.writeFile(credentialPath(), safeStorage.encryptString(JSON.stringify(credentials)))
}

async function readStoredState(): Promise<StoredProviderState> {
  return readJson(publicPath(), { configs: [], activeConfigId: null })
}

async function writeStoredState(state: StoredProviderState): Promise<void> {
  await fs.writeFile(publicPath(), JSON.stringify(state, null, 2), 'utf-8')
}

export async function migrateLegacyProviders(): Promise<void> {
  const current = await readStoredState()
  if (current.configs.length) return

  try {
    const encrypted = await fs.readFile(join(app.getPath('userData'), LEGACY_FILE))
    const legacyRoot = JSON.parse(safeStorage.decryptString(encrypted)) as Record<string, unknown>
    const legacy = legacyRoot['provider-config'] as
      | { configs?: Array<Record<string, unknown>>; activeConfigId?: string | null }
      | undefined
    if (!legacy?.configs?.length) return

    const credentials: Record<string, string> = {}
    const configs = legacy.configs.map((item): ProviderPublicConfig => {
      const id = String(item.id || crypto.randomUUID())
      const apiKey = typeof item.apiKey === 'string' ? item.apiKey : ''
      if (apiKey) credentials[id] = apiKey
      return {
        id,
        providerId: String(item.providerId || 'openai-compatible'),
        providerName: String(item.providerName || 'OpenAI Compatible'),
        kind: 'openai-compatible',
        baseUrl: String(item.baseUrl || ''),
        models: Array.isArray(item.models) ? item.models.map(String) : [],
        selectedModel: String(item.selectedModel || ''),
        embeddingModel: String(item.embeddingModel || 'text-embedding-3-small'),
        requiresApiKey: true,
        hasCredential: Boolean(apiKey),
        timeoutMs: 120000,
        isActive: item.isActive !== false
      }
    })
    await writeStoredState({
      configs,
      activeConfigId: legacy.activeConfigId || configs[0]?.id || null
    })
    await writeCredentials(credentials)
    delete legacyRoot['provider-config']
    await fs.writeFile(
      join(app.getPath('userData'), LEGACY_FILE),
      safeStorage.encryptString(JSON.stringify(legacyRoot))
    )
  } catch {
    // A missing or unreadable legacy file is not a migration failure.
  }
}

export async function listProviders(): Promise<ProviderState> {
  await migrateLegacyProviders()
  return readStoredState()
}

export async function saveProvider(input: ProviderSaveInput): Promise<ProviderPublicConfig> {
  const state = await readStoredState()
  const credentials = await readCredentials()
  const id = input.id || crypto.randomUUID()
  if (input.apiKey?.trim()) credentials[id] = input.apiKey.trim()

  const config: ProviderPublicConfig = {
    id,
    providerId: input.providerId,
    providerName: input.providerName,
    kind: input.kind,
    baseUrl: input.baseUrl.replace(/\/+$/, ''),
    models: input.models,
    selectedModel: input.selectedModel,
    embeddingModel: input.embeddingModel,
    requiresApiKey: input.requiresApiKey,
    hasCredential: input.requiresApiKey ? Boolean(credentials[id]) : true,
    timeoutMs: input.timeoutMs || 120000,
    isActive: true
  }
  const index = state.configs.findIndex((item) => item.id === id)
  if (index >= 0) state.configs[index] = config
  else state.configs.push(config)
  state.activeConfigId ||= id
  await Promise.all([writeStoredState(state), writeCredentials(credentials)])
  return config
}

export async function deleteProvider(id: string): Promise<ProviderState> {
  const state = await readStoredState()
  const credentials = await readCredentials()
  state.configs = state.configs.filter((item) => item.id !== id)
  delete credentials[id]
  if (state.activeConfigId === id) state.activeConfigId = state.configs[0]?.id || null
  await Promise.all([writeStoredState(state), writeCredentials(credentials)])
  return state
}

export async function setActiveProvider(id: string): Promise<ProviderState> {
  const state = await readStoredState()
  if (!state.configs.some((item) => item.id === id)) throw new Error('Provider not found.')
  state.activeConfigId = id
  await writeStoredState(state)
  return state
}

export async function resolveProvider(id: string): Promise<ProviderRuntimeConfig> {
  const state = await readStoredState()
  const config = state.configs.find((item) => item.id === id)
  if (!config) throw new Error('Provider configuration not found.')
  const apiKey = (await readCredentials())[id] || ''
  if (config.requiresApiKey && !apiKey) throw new Error('Provider API key is missing.')
  return { ...config, apiKey }
}
