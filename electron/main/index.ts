import { app, shell, BrowserWindow, ipcMain, dialog, safeStorage } from 'electron'
import { basename, dirname, join } from 'path'
import { promises as fs } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createTwoFilesPatch } from 'diff'
import { setupRAGHandlers } from './rag'
import { resolveWorkspacePath } from './workspace'
import type { FileActionPayload, PluginDocument } from '../../src/shared/types/ipc'

let activeWorkspaceRoot: string | null = null

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

function isPluginDocument(value: unknown): value is PluginDocument {
  if (!value || typeof value !== 'object') return false
  const plugin = value as Partial<PluginDocument>
  return Boolean(
    plugin.id &&
    plugin.name &&
    plugin.version &&
    plugin.systemPrompt &&
    Array.isArray(plugin.fields)
  )
}

function isFileActionPayload(value: unknown): value is FileActionPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<FileActionPayload>
  return Boolean(
    payload.path &&
    payload.action &&
    ['read', 'write', 'save', 'edit', 'delete', 'remove'].includes(payload.action)
  )
}

async function readSecureConfig(): Promise<Record<string, unknown>> {
  try {
    const encrypted = await fs.readFile(join(app.getPath('userData'), 'secure-config.bin'))
    return JSON.parse(safeStorage.decryptString(encrypted)) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function writeSecureConfig(config: Record<string, unknown>): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Operating system credential encryption is unavailable.')
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(config))
  await fs.writeFile(join(app.getPath('userData'), 'secure-config.bin'), encrypted)
}

function buildLineDiff(path: string, before: string, after: string): string {
  return createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after, 'before', 'after', {
    context: 3
  })
}

function pluginFileName(id: string) {
  return `${id.replace(/[^a-zA-Z0-9._-]/g, '-')}.json`
}

async function getPluginsDir() {
  const dir = join(app.getPath('userData'), 'plugins')
  await fs.mkdir(dir, { recursive: true })
  return dir
}

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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const protocol = new URL(details.url).protocol
    if (protocol === 'https:' || protocol === 'http:') {
      void shell.openExternal(details.url)
    }
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
  electronApp.setAppUserModelId('com.isyakim.ai-toolbox')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handlers
  ipcMain.handle('plugins:list', async () => {
    try {
      const dir = await getPluginsDir()
      const entries = await fs.readdir(dir)
      const plugins = []

      for (const entry of entries.filter((name) => name.endsWith('.json'))) {
        const filePath = join(dir, entry)
        const raw = await fs.readFile(filePath, 'utf-8')
        plugins.push({ ...JSON.parse(raw), filePath })
      }

      return { success: true, plugins }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error), plugins: [] }
    }
  })

  ipcMain.handle('config:get', async (_, key: unknown) => {
    if (typeof key !== 'string') return undefined
    const config = await readSecureConfig()
    return config[key]
  })

  ipcMain.handle('config:set', async (_, key: unknown, value: unknown) => {
    try {
      if (typeof key !== 'string') return { success: false, message: 'Invalid config key.' }
      const config = await readSecureConfig()
      config[key] = value
      await writeSecureConfig(config)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('plugins:save', async (_, plugin: unknown) => {
    try {
      if (!isPluginDocument(plugin)) return { success: false, message: 'Invalid plugin document.' }
      const dir = await getPluginsDir()
      const filePath = join(dir, pluginFileName(plugin.id))
      await fs.writeFile(filePath, JSON.stringify(plugin, null, 2), 'utf-8')
      return { success: true, path: filePath }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('plugins:delete', async (_, pluginId: string) => {
    try {
      const dir = await getPluginsDir()
      await fs.unlink(join(dir, pluginFileName(pluginId)))
      return { success: true }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('plugins:export', async (_, plugin: unknown) => {
    try {
      if (!isPluginDocument(plugin)) return { success: false, message: 'Invalid plugin document.' }
      const result = await dialog.showSaveDialog({
        title: 'Export plugin',
        defaultPath: pluginFileName(plugin.id),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      if (result.canceled || !result.filePath) return { success: false }
      await fs.writeFile(result.filePath, JSON.stringify(plugin, null, 2), 'utf-8')
      return { success: true, path: result.filePath }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('plugins:import-file', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Import plugin',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      if (result.canceled || result.filePaths.length === 0) return { success: false }
      const filePath = result.filePaths[0]
      const raw = await fs.readFile(filePath, 'utf-8')
      const plugin: unknown = JSON.parse(raw)
      if (!isPluginDocument(plugin))
        return { success: false, message: 'The selected JSON is not a valid plugin.' }
      return { success: true, plugin: { ...plugin, importedFrom: basename(filePath) } }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select project directory'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false }
    }

    activeWorkspaceRoot = await fs.realpath(result.filePaths[0])
    return { success: true, path: activeWorkspaceRoot }
  })

  ipcMain.handle('workspace:set', async (_, rootPath: unknown) => {
    try {
      if (typeof rootPath !== 'string' || !rootPath)
        return { success: false, message: 'Invalid workspace path.' }
      const realPath = await fs.realpath(rootPath)
      const stats = await fs.stat(realPath)
      if (!stats.isDirectory()) return { success: false, message: 'Workspace must be a directory.' }
      activeWorkspaceRoot = realPath
      return { success: true, path: realPath }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })

  // 初始化 RAG (延迟初始化或根据配置，这里先做基础设置)
  setupRAGHandlers()

  // 文件操作 IPC 处理程序
  ipcMain.handle('file:action', async (_, rawPayload: unknown) => {
    try {
      if (!activeWorkspaceRoot)
        return { success: false, message: 'Select a workspace before running file actions.' }
      if (!isFileActionPayload(rawPayload))
        return { success: false, message: 'Invalid file action payload.' }
      const { action, path, content } = rawPayload
      const targetPath = await resolveWorkspacePath(activeWorkspaceRoot, path)
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
        const dir = dirname(targetPath)
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(targetPath, content || '', 'utf-8')
        return { success: true }
      } else if (action === 'delete' || action === 'remove') {
        await fs.unlink(targetPath)
        return { success: true }
      }
      return { success: false, message: `未知操作: ${action}` }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle('file:preview-action', async (_, rawPayload: unknown) => {
    try {
      if (!activeWorkspaceRoot)
        return { success: false, message: 'Select a workspace before previewing file actions.' }
      if (!isFileActionPayload(rawPayload))
        return { success: false, message: 'Invalid file action payload.' }
      const { action, path, content } = rawPayload
      const targetPath = await resolveWorkspacePath(activeWorkspaceRoot, path)
      const existingContent = await fs.readFile(targetPath, 'utf-8').catch(() => '')
      const nextContent = action === 'delete' || action === 'remove' ? '' : content || ''

      return {
        success: true,
        exists: existingContent.length > 0,
        existingContent,
        nextContent,
        diff: buildLineDiff(path, existingContent, nextContent)
      }
    } catch (error: unknown) {
      return { success: false, message: errorMessage(error) }
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
