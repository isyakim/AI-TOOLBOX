// 页面管理器
import { ChatPage } from './pages/ChatPage.js';
import { ToolsPage } from './pages/ToolsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AboutPage } from './pages/AboutPage.js';

export class PageManager {
  constructor(container, aiClient, configManager) {
    this.container = container;
    this.aiClient = aiClient;
    this.configManager = configManager;
    this.currentPage = null;
    this.pages = {};
    this.init();
  }

  init() {
    // 监听导航事件
    window.addEventListener('navigate', (e) => {
      this.switchPage(e.detail.page);
    });
    
    // 监听配置更新事件
    window.addEventListener('configUpdated', (e) => {
      this.handleConfigUpdated(e.detail.config);
    });
    
    // 初始化状态显示
    const config = this.configManager.getCurrentConfig();
    this.updateStatus(config);
  }

  switchPage(pageName) {
    // 销毁当前页面
    if (this.currentPage && this.pages[this.currentPage]) {
      this.pages[this.currentPage].destroy();
      delete this.pages[this.currentPage];
    }
    
    // 创建新页面实例
    this.pages[pageName] = this.createPage(pageName);
    
    // 激活新页面
    this.currentPage = pageName;
    
    // 更新导航状态
    this.updateNavigation(pageName);
    
    // 更新标题
    this.updateTitle(pageName);
  }

  createPage(pageName) {
    let page;
    
    switch (pageName) {
      case 'chat':
        page = new ChatPage(this.container, this.aiClient, this.configManager);
        break;
      case 'tools':
        page = new ToolsPage(this.container);
        break;
      case 'settings':
        page = new SettingsPage(this.container, this.configManager, (config) => {
          this.handleConfigSaved(config);
        });
        break;
      case 'about':
        page = new AboutPage(this.container);
        break;
      default:
        console.error('未知页面:', pageName);
        return null;
    }
    
    return page;
  }

  updateNavigation(pageName) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    const activeNav = document.querySelector(`[data-page="${pageName}"]`);
    activeNav?.classList.add('active');
  }

  updateTitle(pageName) {
    const titles = {
      'chat': '智能对话',
      'tools': 'AI工具集',
      'settings': '设置',
      'about': '关于'
    };
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) {
      headerTitle.textContent = titles[pageName] || pageName;
    }
  }

  handleConfigSaved(config) {
    // 更新AI客户端
    this.updateAIClient(config);
    
    // 更新聊天页面的AI客户端
    if (this.pages['chat']) {
      this.pages['chat'].updateAIClient(this.aiClient);
    }
  }

  handleConfigUpdated(config) {
    // 更新AI客户端
    this.updateAIClient(config);
    
    // 更新所有需要AI客户端的页面
    if (this.pages['chat']) {
      this.pages['chat'].updateAIClient(this.aiClient);
    }
    
    // 刷新设置页面
    if (this.pages['settings']) {
      this.pages['settings'].loadKeys();
    }
  }

  updateAIClient(config) {
    if (config && window.AIClient) {
      this.aiClient = new window.AIClient(config);
    } else {
      this.aiClient = null;
    }
    
    // 更新状态显示
    this.updateStatus(config);
  }

  updateStatus(config) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.api-status span');
    
    if (config) {
      statusDot?.classList.remove('offline');
      if (statusText) statusText.textContent = 'API连接就绪';
    } else {
      statusDot?.classList.add('offline');
      if (statusText) statusText.textContent = '未配置API';
    }
  }
}

