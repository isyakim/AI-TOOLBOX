import { app, BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'

export interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: unknown
}

export interface UpdateProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

type UpdateEvent =
  | 'update-error'
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'

let mainWindow: BrowserWindow | null = null
let handlersRegistered = false

autoUpdater.logger = log
log.transports.file.level = 'info'
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window
  if (handlersRegistered) return
  handlersRegistered = true

  autoUpdater.on('error', (error) => {
    log.error('Update error:', error)
    sendUpdateMessage('update-error', error.message)
  })
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...')
    sendUpdateMessage('checking-for-update')
  })
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    sendUpdateMessage('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    } satisfies UpdateInfo)
  })
  autoUpdater.on('update-not-available', (info) => {
    log.info('No update available:', info.version)
    sendUpdateMessage('update-not-available', { version: info.version })
  })
  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${progress.percent.toFixed(2)}%`)
    sendUpdateMessage('download-progress', {
      bytesPerSecond: progress.bytesPerSecond,
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    } satisfies UpdateProgress)
  })
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    sendUpdateMessage('update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes
    } satisfies UpdateInfo)
  })

  setupIpcHandlers()
}

function sendUpdateMessage(event: UpdateEvent, data?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-update', { event, data })
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle('check-for-updates', async () => {
    try {
      return { success: true, result: await autoUpdater.checkForUpdates() }
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) }
    }
  })
  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: errorMessage(error) }
    }
  })
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })
  ipcMain.handle('get-app-version', () => app.getVersion())
}

export async function checkForUpdatesOnStartup(): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    log.info('Skipping update check in development mode')
    return
  }

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error: unknown) => {
      log.error('Failed to check for updates on startup:', error)
    })
  }, 3000)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown update error'
}
