import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
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
  fileAction: (payload: any) => ipcRenderer.invoke('file:action', payload),

  // RAG 操作
  ragInit: (config: any) => ipcRenderer.invoke('rag:init', config),
  ragIngest: (payload: any) => ipcRenderer.invoke('rag:ingest', payload),
  ragQuery: (payload: any) => ipcRenderer.invoke('rag:query', payload),
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
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
