const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs/promises');

const workspaceRoot = path.resolve(process.cwd());

// 开发环境下启用热更新
if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
  try {
    require('electron-reload')(path.join(__dirname, '../'), {
      electron: require('electron'),
      hardResetMethod: 'exit',
      ignore: [
        /node_modules/,
        /\.git/,
        /dist/
      ]
    });
    console.log('✅ 热更新已启用');
  } catch (e) {
    console.log('⚠️ electron-reload 未安装，跳过热更新:', e.message);
  }
}

let mainWindow;
function resolveSafePath(targetPath) {
    if (!targetPath || typeof targetPath !== 'string') {
        throw new Error('无效的文件路径');
    }
    const resolved = path.resolve(workspaceRoot, targetPath);
    if (!resolved.startsWith(workspaceRoot)) {
        throw new Error('越权的文件访问请求');
    }
    return resolved;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '../preload/preload.js')
        }
    });

    // 开发环境下加载本地文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    // 开发工具
    mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

/**
 * 接收渲染进程的 Claude CLI 请求
 */
ipcMain.handle('claude-run', async (_event, { prompt }) => {
    return new Promise((resolve, reject) => {
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            reject(new Error('空的 Claude 提示词'));
            return;
        }

        const child = spawn('claude', [prompt], {
            env: process.env,
            shell: process.platform === 'win32'
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('error', (error) => {
            reject(error);
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(stderr.trim() || `claude 退出，code=${code}`));
            } else {
                resolve(stdout.trim());
            }
        });
    });
});

ipcMain.handle('file-action', async (_event, payload = {}) => {
    const { action, path: targetPath, content = '' } = payload;
    if (!action || !targetPath) {
        throw new Error('缺少必要的文件操作参数');
    }

    const resolvedPath = resolveSafePath(targetPath);

    try {
        if (action === 'read') {
            const stats = await fs.stat(resolvedPath);
            if (stats.isDirectory()) {
                const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
                const formatted = entries.map(entry => {
                    const suffix = entry.isDirectory() ? '/' : '';
                    return `${entry.isDirectory() ? '📁' : '📄'} ${entry.name}${suffix}`;
                });
                return { success: true, entries: formatted };
            }
            const fileContent = await fs.readFile(resolvedPath, 'utf-8');
            return { success: true, content: fileContent };
        }

        if (action === 'write' || action === 'edit' || action === 'save') {
            await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
            await fs.writeFile(resolvedPath, content ?? '', 'utf-8');
            return { success: true };
        }

        if (action === 'delete' || action === 'remove') {
            await fs.rm(resolvedPath, { force: true });
            return { success: true };
        }

        throw new Error(`未知的文件操作类型: ${action}`);
    } catch (error) {
        return { success: false, message: error.message };
    }
});
