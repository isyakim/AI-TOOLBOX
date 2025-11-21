const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 这里可以添加需要的原生功能
    platform: process.platform,

    runClaude(prompt) {
        return ipcRenderer.invoke('claude-run', { prompt });
    },

    fileAction(payload) {
        return ipcRenderer.invoke('file-action', payload);
    }
});
