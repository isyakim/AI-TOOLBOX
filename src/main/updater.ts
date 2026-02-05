/**
 * 自动更新服务
 * 使用 electron-updater 实现静默差量更新
 */

import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain, app } from 'electron'
import log from 'electron-log'

// 配置日志
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'

// 配置更新选项
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

export interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes: string
}

export interface UpdateProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

let mainWindow: BrowserWindow | null = null

/**
 * 初始化自动更新
 */
export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window

  // 检查更新错误
  autoUpdater.on('error', (error) => {
    log.error('Update error:', error)
    sendUpdateMessage('update-error', error.message)
  })

  // 检查更新中
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...')
    sendUpdateMessage('checking-for-update')
  })

  // 有可用更新
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    sendUpdateMessage('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    })
  })

  // 没有可用更新
  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available, current version is latest')
    sendUpdateMessage('update-not-available', {
      version: info.version
    })
  })

  // 下载进度
  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${progress.percent.toFixed(2)}%`)
    sendUpdateMessage('download-progress', {
      bytesPerSecond: progress.bytesPerSecond,
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  // 下载完成
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    sendUpdateMessage('update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })

  // 设置 IPC 处理器
  setupIpcHandlers()
}

/**
 * 发送更新消息到渲染进程
 */
function sendUpdateMessage(event: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-update', { event, data })
  }
}

/**
 * 设置 IPC 处理器
 */
function setupIpcHandlers() {
  // 检查更新
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, result }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 下载更新
  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 安装更新并重启
  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true)
    return { success: true }
  })

  // 获取当前版本
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })
}

/**
 * 检查更新（可在应用启动时调用）
 */
export async function checkForUpdatesOnStartup() {
  // 开发模式下不检查更新
  if (process.env.NODE_ENV === 'development') {
    log.info('Skipping update check in development mode')
    return
  }

  // 延迟 3 秒检查，避免影响启动
  setTimeout(async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      log.error('Failed to check for updates on startup:', error)
    }
  }, 3000)
}
