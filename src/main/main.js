const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

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
