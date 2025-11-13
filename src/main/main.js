const { app, BrowserWindow } = require('electron');
const path = require('path');

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
