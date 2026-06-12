import { contextBridge, ipcRenderer } from 'electron'
import type {
  AIToolboxAPI,
  AIChatStartPayload,
  FileActionPayload,
  PluginDocument,
  ProviderSaveInput,
  RAGConfigPayload,
  RAGQueryPayload
} from '../../src/shared/types/ipc'

// Custom APIs for renderer
const api: AIToolboxAPI = {
  // 配置存储
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: unknown) => ipcRenderer.invoke('config:set', key, value),

  // 应用控制
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // 系统信息
  platform: process.platform,

  listProviderConfigs: () => ipcRenderer.invoke('providers:list'),
  saveProviderConfig: (input: ProviderSaveInput) => ipcRenderer.invoke('providers:save', input),
  deleteProviderConfig: (id: string) => ipcRenderer.invoke('providers:delete', id),
  setActiveProviderConfig: (id: string) => ipcRenderer.invoke('providers:set-active', id),
  testProvider: (input: ProviderSaveInput) => ipcRenderer.invoke('ai:test-provider', input),
  startAIChat: (payload: AIChatStartPayload) => ipcRenderer.invoke('ai:chat:start', payload),
  abortAIChat: (requestId: string) => ipcRenderer.invoke('ai:chat:abort', requestId),
  onAIChatEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) =>
      callback(payload)
    ipcRenderer.on('ai:chat:event', listener)
    return () => ipcRenderer.removeListener('ai:chat:event', listener)
  },
  loadChatSnapshot: () => ipcRenderer.invoke('chat:snapshot:get'),
  saveChatSnapshot: (snapshot) => ipcRenderer.invoke('chat:snapshot:set', snapshot),

  // 文件操作
  fileAction: (payload: FileActionPayload) => ipcRenderer.invoke('file:action', payload),
  previewFileAction: (payload: FileActionPayload) =>
    ipcRenderer.invoke('file:preview-action', payload),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  setWorkspace: (rootPath: string) => ipcRenderer.invoke('workspace:set', rootPath),

  // Plugin file storage
  listPlugins: () => ipcRenderer.invoke('plugins:list'),
  savePluginFile: (plugin: PluginDocument) => ipcRenderer.invoke('plugins:save', plugin),
  deletePluginFile: (pluginId: string) => ipcRenderer.invoke('plugins:delete', pluginId),
  exportPluginFile: (plugin: PluginDocument) => ipcRenderer.invoke('plugins:export', plugin),
  importPluginFile: () => ipcRenderer.invoke('plugins:import-file'),

  // RAG 操作
  ragInit: (config: RAGConfigPayload) => ipcRenderer.invoke('rag:init', config),
  ragQuery: (payload: RAGQueryPayload) => ipcRenderer.invoke('rag:query', payload),
  ragIndexProject: (payload) => ipcRenderer.invoke('rag:index-project', payload),
  ragIndexStatus: (projectId) => ipcRenderer.invoke('rag:index-status', projectId),
  ragPauseIndex: (projectId) => ipcRenderer.invoke('rag:index-pause', projectId),
  ragResumeIndex: (projectId) => ipcRenderer.invoke('rag:index-resume', projectId),
  ragCancelIndex: (projectId) => ipcRenderer.invoke('rag:index-cancel', projectId),
  listWorkspaceProjects: () => ipcRenderer.invoke('workspace-projects:list'),
  registerWorkspaceProject: (rootPath) =>
    ipcRenderer.invoke('workspace-projects:register', rootPath),
  getActiveWorkspaceProjectId: () => ipcRenderer.invoke('workspace-projects:get-active'),
  setActiveWorkspaceProject: (projectId) =>
    ipcRenderer.invoke('workspace-projects:set-active', projectId),
  getProjectMap: (projectId) => ipcRenderer.invoke('project-map:get', projectId),
  projectHealthCheck: (payload) => ipcRenderer.invoke('project:health-check', payload),
  ragClear: () => ipcRenderer.invoke('rag:clear')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
}
