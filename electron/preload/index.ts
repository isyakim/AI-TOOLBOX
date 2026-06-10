import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AIToolboxAPI,
  FileActionPayload,
  PluginDocument,
  RAGConfigPayload,
  RAGIngestPayload,
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
  ragIngest: (payload: RAGIngestPayload) => ipcRenderer.invoke('rag:ingest', payload),
  ragQuery: (payload: RAGQueryPayload) => ipcRenderer.invoke('rag:query', payload),
  ragIndexProject: (payload) => ipcRenderer.invoke('rag:index-project', payload),
  ragIndexStatus: () => ipcRenderer.invoke('rag:index-status'),
  projectHealthCheck: (payload) => ipcRenderer.invoke('project:health-check', payload),
  ragClear: () => ipcRenderer.invoke('rag:clear')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
