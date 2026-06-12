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

export interface RAGConfigPayload {
  apiKey: string
  baseUrl: string
  model?: string
  embeddingModel?: string
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
