export type FileActionName = 'read' | 'write' | 'save' | 'edit' | 'delete' | 'remove'

export interface FileActionPayload {
  action: FileActionName
  path: string
  content?: string
}

export interface FileActionResult {
  success: boolean
  content?: string
  message?: string
  entries?: string[]
}

export interface FilePreviewResult extends FileActionResult {
  exists?: boolean
  existingContent?: string
  nextContent?: string
  diff?: string
}

export interface PluginDocument {
  id: string
  name: string
  version: string
  systemPrompt: string
  fields: unknown[]
}

export type ProviderKind = 'openai-compatible' | 'ollama'

export interface ProviderPublicConfig {
  id: string
  providerId: string
  providerName: string
  kind: ProviderKind
  baseUrl: string
  models: string[]
  selectedModel: string
  embeddingModel: string
  requiresApiKey: boolean
  hasCredential: boolean
  timeoutMs: number
  isActive: boolean
}

export interface ProviderRuntimeConfig extends ProviderPublicConfig {
  apiKey: string
}

export interface ProviderSaveInput extends Omit<ProviderPublicConfig, 'id' | 'hasCredential'> {
  id?: string
  apiKey?: string
}

export interface ProviderState {
  configs: ProviderPublicConfig[]
  activeConfigId: string | null
}

export interface ProviderConnectionResult {
  success: boolean
  message: string
  models: string[]
}

export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export interface APIError {
  code: string
  message: string
  details?: unknown
}

export interface AIChatStartPayload {
  providerId: string
  messages: ChatMessage[]
  temperature?: number
}

export type AIChatEvent =
  | { requestId: string; type: 'token'; token: string }
  | { requestId: string; type: 'complete'; text: string; aborted?: boolean }
  | { requestId: string; type: 'error'; error: APIError }

export interface RAGConfigPayload {
  providerId: string
}

export interface RAGIngestPayload {
  chunks: Array<{ text: string; metadata: Record<string, unknown> }>
  config: RAGConfigPayload
}

export interface RAGQueryPayload {
  query: string
  config: RAGConfigPayload
  limit?: number
}

export interface RAGQueryResult {
  text?: string
  _distance?: number
  metadata?: {
    source?: string
    path?: string
    relativePath?: string
    snippet?: string
    [key: string]: unknown
  }
}

export interface RAGQueryResponse {
  success: boolean
  results?: RAGQueryResult[]
  message?: string
}

export interface RAGIndexStatus {
  success: boolean
  status: 'idle' | 'indexing' | 'ready' | 'error'
  rootPath: string
  totalFiles: number
  indexedFiles: number
  totalChunks: number
  currentFile: string
  startedAt: number
  completedAt: number
  message: string
  projectId?: string
  indexVersion?: number
  embeddingModel?: string
}

export interface ProjectHealthFinding {
  title: string
  status: 'good' | 'watch' | 'needs-work' | string
  detail: string
}

export interface ProjectHealthReport {
  rootPath: string
  scannedFiles: number
  findings: ProjectHealthFinding[]
  generatedAt: string
}

export interface AIToolboxAPI {
  getConfig: (key: string) => Promise<unknown>
  setConfig: (key: string, value: unknown) => Promise<{ success: boolean; message?: string }>
  minimize: () => void
  maximize: () => void
  close: () => void
  platform: NodeJS.Platform
  listProviderConfigs: () => Promise<ProviderState>
  saveProviderConfig: (input: ProviderSaveInput) => Promise<ProviderPublicConfig>
  deleteProviderConfig: (id: string) => Promise<ProviderState>
  setActiveProviderConfig: (id: string) => Promise<ProviderState>
  testProvider: (input: ProviderSaveInput) => Promise<ProviderConnectionResult>
  startAIChat: (
    payload: AIChatStartPayload
  ) => Promise<{ success: boolean; requestId?: string; error?: APIError }>
  abortAIChat: (requestId: string) => Promise<{ success: boolean }>
  onAIChatEvent: (callback: (event: AIChatEvent) => void) => () => void
  fileAction: (payload: FileActionPayload) => Promise<FileActionResult>
  previewFileAction: (payload: FileActionPayload) => Promise<FilePreviewResult>
  selectDirectory: () => Promise<{ success: boolean; path?: string; message?: string }>
  setWorkspace: (rootPath: string) => Promise<{ success: boolean; path?: string; message?: string }>
  listPlugins: () => Promise<{ success: boolean; plugins: PluginDocument[]; message?: string }>
  savePluginFile: (
    plugin: PluginDocument
  ) => Promise<{ success: boolean; path?: string; message?: string }>
  deletePluginFile: (pluginId: string) => Promise<{ success: boolean; message?: string }>
  exportPluginFile: (
    plugin: PluginDocument
  ) => Promise<{ success: boolean; path?: string; message?: string }>
  importPluginFile: () => Promise<{ success: boolean; plugin?: PluginDocument; message?: string }>
  ragInit: (config: RAGConfigPayload) => Promise<{ success: boolean; message?: string }>
  ragIngest: (
    payload: RAGIngestPayload
  ) => Promise<{ success: boolean; message?: string; chunks?: number }>
  ragQuery: (payload: RAGQueryPayload) => Promise<RAGQueryResponse>
  ragIndexProject: (payload: {
    rootPath: string
    extensions: string[]
    config: RAGConfigPayload
  }) => Promise<RAGIndexStatus>
  ragIndexStatus: () => Promise<RAGIndexStatus>
  projectHealthCheck: (payload: {
    rootPath: string
  }) => Promise<{ success: boolean; report?: ProjectHealthReport; message?: string }>
  ragClear: () => Promise<{ success: boolean }>
}
