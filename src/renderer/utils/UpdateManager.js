// 自动更新管理器
export class UpdateManager {
  constructor() {
    this.updateUrl = 'https://api.github.com/repos/your-repo/ai-toolbox/releases/latest';
    this.currentVersion = '1.0.0';
    this.checkInterval = 24 * 60 * 60 * 1000; // 24小时
    this.lastCheckKey = 'ai-toolbox-last-update-check';
  }

  // 获取当前版本
  getCurrentVersion() {
    return this.currentVersion;
  }

  // 检查更新
  async checkForUpdates() {
    try {
      const response = await fetch(this.updateUrl);
      if (!response.ok) {
        throw new Error('无法获取更新信息');
      }

      const data = await response.json();
      const latestVersion = data.tag_name.replace('v', '');
      
      return {
        hasUpdate: this.compareVersions(latestVersion, this.currentVersion) > 0,
        latestVersion: latestVersion,
        currentVersion: this.currentVersion,
        releaseNotes: data.body,
        downloadUrl: data.html_url,
        publishedAt: data.published_at
      };
    } catch (error) {
      console.error('检查更新失败:', error);
      return null;
    }
  }

  // 比较版本号
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }
    
    return 0;
  }

  // 是否需要检查更新
  shouldCheckForUpdates() {
    const lastCheck = localStorage.getItem(this.lastCheckKey);
    if (!lastCheck) return true;
    
    const lastCheckTime = parseInt(lastCheck);
    const now = Date.now();
    
    return (now - lastCheckTime) > this.checkInterval;
  }

  // 记录检查时间
  recordCheck() {
    localStorage.setItem(this.lastCheckKey, Date.now().toString());
  }

  // 自动检查更新
  async autoCheckForUpdates() {
    if (!this.shouldCheckForUpdates()) {
      return null;
    }

    const updateInfo = await this.checkForUpdates();
    this.recordCheck();
    
    return updateInfo;
  }

  // 显示更新通知
  showUpdateNotification(updateInfo) {
    if (!updateInfo || !updateInfo.hasUpdate) return;

    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
      <div class="update-notification-content">
        <div class="update-notification-header">
          <span class="update-icon">🎉</span>
          <span class="update-title">发现新版本 v${updateInfo.latestVersion}</span>
          <button class="update-close" id="update-close">✕</button>
        </div>
        <div class="update-notification-body">
          <p>当前版本: v${updateInfo.currentVersion}</p>
          <p>最新版本: v${updateInfo.latestVersion}</p>
        </div>
        <div class="update-notification-actions">
          <button class="btn btn-secondary" id="update-later">稍后提醒</button>
          <button class="btn btn-primary" id="update-download">立即更新</button>
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // 绑定事件
    document.getElementById('update-close')?.addEventListener('click', () => {
      notification.remove();
    });

    document.getElementById('update-later')?.addEventListener('click', () => {
      notification.remove();
    });

    document.getElementById('update-download')?.addEventListener('click', () => {
      window.open(updateInfo.downloadUrl, '_blank');
      notification.remove();
    });

    // 5秒后自动关闭
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }

  // 初始化自动更新检查
  async init() {
    // 启动时检查更新
    const updateInfo = await this.autoCheckForUpdates();
    if (updateInfo && updateInfo.hasUpdate) {
      this.showUpdateNotification(updateInfo);
    }

    // 定期检查更新
    setInterval(async () => {
      const info = await this.autoCheckForUpdates();
      if (info && info.hasUpdate) {
        this.showUpdateNotification(info);
      }
    }, this.checkInterval);
  }

  // 手动检查更新
  async manualCheck() {
    const updateInfo = await this.checkForUpdates();
    this.recordCheck();
    
    if (!updateInfo) {
      return {
        success: false,
        message: '检查更新失败，请稍后重试'
      };
    }

    if (updateInfo.hasUpdate) {
      this.showUpdateNotification(updateInfo);
      return {
        success: true,
        message: `发现新版本 v${updateInfo.latestVersion}`,
        updateInfo
      };
    } else {
      return {
        success: true,
        message: '当前已是最新版本',
        updateInfo
      };
    }
  }
}

// 版本信息显示
export class VersionInfo {
  static getVersionString() {
    return '1.0.0';
  }

  static getBuildDate() {
    return '2024-01-01';
  }

  static getFullInfo() {
    return {
      version: this.getVersionString(),
      buildDate: this.getBuildDate(),
      platform: navigator.platform,
      userAgent: navigator.userAgent
    };
  }
}