const { contextBridge } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 这里可以添加需要的原生功能
    platform: process.platform
});
