// 密钥管理页面组件
export class KeysPage {
  constructor(container, configManager) {
    this.container = container;
    this.configManager = configManager;
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.loadKeys();
  }

  render() {
    this.container.innerHTML = `
      <div class="config-page">
        <div class="config-card">
          <div class="config-header">
            <div class="config-title">密钥管理</div>
            <button class="btn btn-primary" id="add-key-btn">添加密钥</button>
          </div>
          <div class="keys-list" id="keys-list">
            <!-- 密钥列表将在这里动态生成 -->
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    document.getElementById('add-key-btn')?.addEventListener('click', () => {
      this.showAddKeyModal();
    });
  }

  loadKeys() {
    const configs = this.configManager.loadConfigs();
    const keysList = document.getElementById('keys-list');
    
    if (!keysList) return;
    
    if (configs.length === 0) {
      keysList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-light);">
          <div style="font-size: 2rem; margin-bottom: 12px;">🔑</div>
          <div>暂无保存的密钥配置</div>
          <div style="font-size: 0.875rem; margin-top: 8px;">点击"添加密钥"按钮开始配置</div>
        </div>
      `;
      return;
    }
    
    keysList.innerHTML = configs.map((config, index) => {
      const isCurrent = index === 0;
      const maskedKey = this.maskKey(config.apiKey);
      const date = new Date(config.createdAt).toLocaleString('zh-CN');
      
      return `
        <div class="key-item ${isCurrent ? 'current' : ''}" data-index="${index}">
          <div class="key-info">
            <div class="key-header">
              <span class="key-provider">${this.getProviderName(config.provider)}</span>
              ${isCurrent ? '<span class="key-badge">当前使用</span>' : ''}
            </div>
            <div class="key-details">
              <div class="key-field">
                <span class="key-label">密钥:</span>
                <span class="key-value">${maskedKey}</span>
              </div>
              <div class="key-field">
                <span class="key-label">模型:</span>
                <span class="key-value">${config.model}</span>
              </div>
              <div class="key-field">
                <span class="key-label">创建时间:</span>
                <span class="key-value">${date}</span>
              </div>
            </div>
          </div>
          <div class="key-actions">
            ${!isCurrent ? `<button class="btn btn-secondary use-key-btn" data-index="${index}">使用</button>` : ''}
            <button class="btn btn-secondary delete-key-btn" data-index="${index}">删除</button>
          </div>
        </div>
      `;
    }).join('');
    
    // 绑定操作按钮事件
    keysList.querySelectorAll('.use-key-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.useKey(index);
      });
    });
    
    keysList.querySelectorAll('.delete-key-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.deleteKey(index);
      });
    });
  }

  maskKey(key) {
    if (!key || key.length < 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }

  getProviderName(provider) {
    const names = {
      'openai': 'OpenAI',
      'deepseek': 'DeepSeek',
      'azure': 'Azure OpenAI',
      'custom': '自定义服务'
    };
    return names[provider] || provider;
  }

  showAddKeyModal() {
    // 跳转到API配置页面添加新密钥
    // 可以通过事件通知主应用切换页面
    const event = new CustomEvent('navigate', { detail: { page: 'config' } });
    window.dispatchEvent(event);
  }

  useKey(index) {
    const configs = this.configManager.loadConfigs();
    if (index >= 0 && index < configs.length) {
      // 将选中的配置移到最前面
      const config = configs[index];
      configs.splice(index, 1);
      configs.unshift(config);
      localStorage.setItem(this.configManager.storageKey, JSON.stringify(configs));
      
      // 触发配置更新事件
      const event = new CustomEvent('configUpdated', { detail: { config } });
      window.dispatchEvent(event);
      
      this.loadKeys();
      alert('✅ 已切换到该密钥配置');
    }
  }

  deleteKey(index) {
    if (!confirm('确定要删除这个密钥配置吗？')) return;
    
    const configs = this.configManager.loadConfigs();
    if (index >= 0 && index < configs.length) {
      configs.splice(index, 1);
      localStorage.setItem(this.configManager.storageKey, JSON.stringify(configs));
      
      // 如果删除的是当前使用的配置，触发配置更新事件
      if (index === 0 && configs.length > 0) {
        const event = new CustomEvent('configUpdated', { detail: { config: configs[0] } });
        window.dispatchEvent(event);
      } else if (configs.length === 0) {
        const event = new CustomEvent('configUpdated', { detail: { config: null } });
        window.dispatchEvent(event);
      }
      
      this.loadKeys();
      alert('✅ 密钥配置已删除');
    }
  }

  destroy() {
    // 清理事件监听器
  }
}

