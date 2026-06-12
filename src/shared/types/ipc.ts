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

export interface ChatSnapshotDocument {
  version: 3
  sessions: Array<{
    id: string
    projectId?: string
    title: string
    messages: Array<{
      id: string
      role: 'user' | 'assistant' | 'system'
      content: string
      timestamp: number
      images?: Array<{ url: string; base64: string; type: string }>
      citations?: Array<{
        source: string
        path?: string
        relativePath?: string
        snippet: string
        score?: number
        projectId: string
        lineStart: number
        lineEnd: number
        symbol?: string
        language?: string
        indexedAt: string
      }>
    }>
    createdAt: number
    updatedAt: number
  }>
  activeSessionId: string | null
  currentRoleId: string
  settings: {
    temperature: number
    contextLength: number
    enableMemory: boolean
    useRAG: boolean
  }
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

export interface RAGQueryPayload {
  projectId: string
  query: string
  config: RAGConfigPayload
  limit?: number
  filters?: {
    paths?: string[]
    languages?: string[]
    symbols?: string[]
  }
}

export interface RAGQueryResult {
  projectId: string
  path: string
  relativePath: string
  lineStart: number
  lineEnd: number
  symbol?: string
  language?: string
  indexedAt: string
  score?: number
  snippet: string
  text?: string
  _distance?: number
}

export interface RAGQueryResponse {
  success: boolean
  results?: RAGQueryResult[]
  message?: string
}

export interface RAGIndexStatus {
  success: boolean
  status: 'idle' | 'indexing' | 'paused' | 'ready' | 'cancelled' | 'error'
  projectId?: string
  rootPath: string
  totalFiles: number
  indexedFiles: number
  totalChunks: number
  currentFile: string
  startedAt: number
  completedAt: number
  message: string
  indexVersion?: number
  embeddingModel?: string
  failedFiles: Array<{ path: string; message: string }>
  paused: boolean
  cancelRequested: boolean
}

export interface WorkspaceProject {
  id: string
  name: string
  rootPath: string
  branch: string | null
  languageStats: Record<string, number>
  indexVersion: number
  lastIndexedAt: string | null
  failedFiles: Array<{ path: string; message: string }>
}

export interface ProjectSymbol {
  id: string
  projectId: string
  path: string
  name: string
  kind: 'function' | 'class' | 'method' | 'variable' | 'component'
  exported: boolean
  lineStart: number
  lineEnd: number
}

export interface ProjectRelation {
  projectId: string
  fromPath: string
  toPath: string
  kind: 'imports' | 'tests'
}

export interface ProjectMap {
  project: WorkspaceProject
  entryFiles: string[]
  symbols: ProjectSymbol[]
  relations: ProjectRelation[]
  testFiles: string[]
  largeFiles: Array<{ path: string; bytes: number }>
  hotspots: Array<{ path: string; score: number; reason: string }>
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
  loadChatSnapshot: () => Promise<ChatSnapshotDocument | null>
  saveChatSnapshot: (snapshot: ChatSnapshotDocument) => Promise<{ success: boolean }>
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
  ragQuery: (payload: RAGQueryPayload) => Promise<RAGQueryResponse>
  ragIndexProject: (payload: {
    projectId: string
    rootPath: string
    extensions: string[]
    excludePatterns?: string[]
    force?: boolean
    config: RAGConfigPayload
  }) => Promise<RAGIndexStatus>
  ragIndexStatus: (projectId?: string) => Promise<RAGIndexStatus>
  ragPauseIndex: (projectId: string) => Promise<{ success: boolean }>
  ragResumeIndex: (projectId: string) => Promise<{ success: boolean }>
  ragCancelIndex: (projectId: string) => Promise<{ success: boolean }>
  listWorkspaceProjects: () => Promise<WorkspaceProject[]>
  registerWorkspaceProject: (rootPath: string) => Promise<WorkspaceProject>
  getActiveWorkspaceProjectId: () => Promise<string | null>
  setActiveWorkspaceProject: (projectId: string) => Promise<{ success: boolean }>
  getProjectMap: (
    projectId: string
  ) => Promise<{ success: boolean; projectMap?: ProjectMap; message?: string }>
  projectHealthCheck: (payload: {
    rootPath: string
  }) => Promise<{ success: boolean; report?: ProjectHealthReport; message?: string }>
  ragClear: () => Promise<{ success: boolean }>
}
