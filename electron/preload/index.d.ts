import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getConfig: (key: string) => Promise<unknown>
      setConfig: (key: string, value: unknown) => Promise<void>
      minimize: () => void
      maximize: () => void
      close: () => void
      platform: NodeJS.Platform
      fileAction: (payload: any) => Promise<{ success: boolean; content?: string; message?: string; entries?: string[] }>
      ragInit: (config: any) => Promise<{ success: boolean; message?: string }>
      ragIngest: (payload: any) => Promise<{ success: boolean; message?: string }>
      ragQuery: (payload: any) => Promise<{ success: boolean; results?: any[]; message?: string }>
      ragClear: () => Promise<{ success: boolean }>
    }
  }
}
