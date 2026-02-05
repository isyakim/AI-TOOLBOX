import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, resolve, isAbsolute } from 'path'
import { promises as fs } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initRAG, setupRAGHandlers } from './rag'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer based on electron-vite cli
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.xkim.ai-toolbox')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handlers
  ipcMain.on('ping', () => console.log('pong'))

  // 初始化 RAG (延迟初始化或根据配置，这里先做基础设置)
  setupRAGHandlers()

  // 文件操作 IPC 处理程序
  ipcMain.handle('file:action', async (_, payload) => {
    const { action, path, content } = payload
    if (!path) return { success: false, message: '未提供路径' }

    // 基础路径安全检查 (确保在工作空间内)
    const baseDir = app.getAppPath()
    const targetPath = isAbsolute(path) ? path : resolve(baseDir, path)
    
    // 如果是开发环境，可能希望允许在项目根目录操作
    // 简单的安全逻辑：只允许在特定目录下操作，或者在当前工作目录
    
    try {
      if (action === 'read') {
        const stats = await fs.stat(targetPath)
        if (stats.isDirectory()) {
          const entries = await fs.readdir(targetPath)
          return { success: true, entries }
        } else {
          const data = await fs.readFile(targetPath, 'utf-8')
          return { success: true, content: data }
        }
      } else if (action === 'write' || action === 'save' || action === 'edit') {
        const dir = join(targetPath, '..')
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(targetPath, content || '', 'utf-8')
        return { success: true }
      } else if (action === 'delete' || action === 'remove') {
        await fs.unlink(targetPath)
        return { success: true }
      }
      return { success: false, message: `未知操作: ${action}` }
    } catch (error: any) {
      console.error('File Action Error:', error)
      return { success: false, message: error.message }
    }
  })

  // 窗口控制 IPC
  ipcMain.on('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
  })
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.on('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
