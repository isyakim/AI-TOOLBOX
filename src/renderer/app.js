import { ThemeManager } from './utils/ThemeManager.js';
import { UpdateManager } from './utils/UpdateManager.js';

// 配置管理器
class ConfigManager {
  constructor() {
    this.storageKey = 'ai-toolbox-configs';
  }
  
  loadConfigs() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('加载配置失败:', e);
      return [];
    }
  }
  
  saveConfig(config) {
    const configs = this.loadConfigs();
    configs.unshift(config); // 新配置放在最前
    localStorage.setItem(this.storageKey, JSON.stringify(configs));
    return config;
  }
  
  getCurrentConfig() {
    const configs = this.loadConfigs();
    return configs[0] || null;
  }
}

// AI客户端
class AIClient {
  constructor(config) {
    this.config = config;
  }
  
  async sendMessage(messages, onChunk = null) {
    if (!this.config) {
      throw new Error('请先配置API');
    }
    
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        stream: !!onChunk
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }
    
    // 如果支持流式响应
    if (onChunk && response.body) {
      return this.handleStreamResponse(response, onChunk);
    }
    
    // 普通响应
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  async handleStreamResponse(response, onChunk) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content;
            if (content) {
              fullContent += content;
              onChunk(content);
            }
          } catch (e) {
            console.error('解析流数据失败:', e);
          }
        }
      }
    }
    
    return fullContent;
  }
}

// 将AIClient暴露到全局，供PageManager使用
window.AIClient = AIClient;

// 主应用类
class AIApp {
  constructor() {
    this.configManager = new ConfigManager();
    this.themeManager = new ThemeManager();
    this.updateManager = new UpdateManager();
    this.aiClient = null;
    this.pageManager = null;
    
    this.init();
  }
  
  init() {
    // 初始化主题
    this.themeManager.init();
    
    // 初始化更新检查
    this.updateManager.init();
    
    // 初始化AI客户端
    this.updateAIClient();
    
    // 绑定主题切换按钮
    this.bindThemeToggle();
    
    // 绑定侧边栏折叠功能
    this.bindSidebarToggle();
    
    // 获取页面容器
    const container = document.getElementById('page-container');
    if (!container) {
      console.error('找不到页面容器');
      return;
    }
    
    // 初始化页面管理器
    import('./components/PageManager.js').then(module => {
      const { PageManager } = module;
      this.pageManager = new PageManager(container, this.aiClient, this.configManager);
      
      // PageManager加载完成后再绑定导航事件
      this.bindNavigationEvents();
      
      // 默认显示聊天页面
      this.pageManager.switchPage('chat');
    }).catch(error => {
      console.error('加载页面管理器失败:', error);
    });
  }
  
  bindNavigationEvents() {
    // 导航切换
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) {
          this.pageManager.switchPage(page);
        }
      });
    });
  }
  
  bindThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        this.themeManager.toggleTheme();
      });
    }
  }
  
  bindSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    
    if (sidebar && toggleBtn) {
      // 从本地存储恢复折叠状态
      const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
      if (isCollapsed) {
        sidebar.classList.add('collapsed');
      }
      
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        const collapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar-collapsed', collapsed);
      });
    }
  }
  
  updateAIClient() {
    const config = this.configManager.getCurrentConfig();
    
    if (config) {
      this.aiClient = new AIClient(config);
    } else {
      this.aiClient = null;
    }
    
    // 更新页面管理器的AI客户端
    if (this.pageManager) {
      this.pageManager.updateAIClient(config);
    }
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AIApp();
});
