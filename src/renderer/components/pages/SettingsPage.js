// 统一设置页面组件 - 合并API配置和密钥管理
export class SettingsPage {
  constructor(container, configManager, onConfigSaved) {
    this.container = container;
    this.configManager = configManager;
    this.onConfigSaved = onConfigSaved;
    this.currentTab = 'api';
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.loadCurrentConfig();
    this.loadKeys();
  }

  render() {
    this.container.innerHTML = `
      <div class="settings-page">
        <div class="settings-header">
          <h2>设置</h2>
          <p class="settings-subtitle">配置API密钥和管理应用设置</p>
        </div>
        
        <div class="settings-tabs">
          <button class="settings-tab active" data-tab="api">
            <i>🔑</i>
            <span>API配置</span>
          </button>
          <button class="settings-tab" data-tab="keys">
            <i>📋</i>
            <span>密钥管理</span>
          </button>
        </div>
        
        <div class="settings-content">
          <!-- API配置标签页 -->
          <div class="settings-tab-content active" id="api-tab">
            <div class="settings-section">
              <h3>API配置</h3>
              <p class="section-desc">配置AI服务提供商的API密钥和参数</p>
              
              <div class="form-group">
                <label class="form-label">选择服务商</label>
                <select class="form-input" id="provider-select">
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="azure">Azure OpenAI</option>
                  <option value="custom">自定义服务</option>
                </select>
              </div>
              
              <div class="form-group">
                <label class="form-label">API密钥</label>
                <input type="password" class="form-input" id="api-key" placeholder="输入你的API密钥">
                <div class="form-hint">密钥仅存储在本地，不会上传到任何服务器</div>
              </div>
              
              <div class="form-group">
                <label class="form-label">API地址 (可选)</label>
                <input type="text" class="form-input" id="base-url" placeholder="https://api.openai.com/v1">
                <div class="form-hint">留空将使用默认地址</div>
              </div>
              
              <div class="form-group">
                <label class="form-label">默认模型</label>
                <select class="form-input" id="model-select">
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
              
              <div class="form-actions">
                <button class="btn btn-secondary" id="test-connection">测试连接</button>
                <button class="btn btn-primary" id="save-config">保存配置</button>
              </div>
              
              <div id="test-result" class="test-result"></div>
            </div>
          </div>
          
          <!-- 密钥管理标签页 -->
          <div class="settings-tab-content" id="keys-tab">
            <div class="settings-section">
              <h3>密钥管理</h3>
              <p class="section-desc">管理已保存的API密钥配置</p>
              
              <div class="keys-list" id="keys-list">
                <!-- 密钥列表将在这里动态生成 -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    // 标签切换
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // API配置相关
    document.getElementById('save-config')?.addEventListener('click', () => {
      this.saveConfig();
    });
    
    document.getElementById('test-connection')?.addEventListener('click', () => {
      this.testConnection();
    });
    
    document.getElementById('provider-select')?.addEventListener('change', (e) => {
      this.updateModelOptions(e.target.value);
    });
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    
    // 更新标签样式
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // 更新内容区域
    document.querySelectorAll('.settings-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
    
    // 如果切换到密钥管理，重新加载列表
    if (tabName === 'keys') {
      this.loadKeys();
    }
  }

  loadCurrentConfig() {
    const config = this.configManager.getCurrentConfig();
    if (config) {
      const providerSelect = document.getElementById('provider-select');
      const apiKeyInput = document.getElementById('api-key');
      const baseUrlInput = document.getElementById('base-url');
      const modelSelect = document.getElementById('model-select');
      
      if (providerSelect) providerSelect.value = config.provider || 'openai';
      if (apiKeyInput) apiKeyInput.value = config.apiKey || '';
      if (baseUrlInput) baseUrlInput.value = config.baseURL || '';
      if (modelSelect) modelSelect.value = config.model || 'gpt-4';
      
      this.updateModelOptions(config.provider || 'openai');
    }
  }

  async testConnection() {
    const provider = document.getElementById('provider-select').value;
    const apiKey = document.getElementById('api-key').value;
    const baseURL = document.getElementById('base-url').value || this.getDefaultBaseURL(provider);
    const model = document.getElementById('model-select').value;
    
    if (!apiKey) {
      this.showTestResult('error', '❌ 请输入API密钥');
      return;
    }
    
    if (!baseURL) {
      this.showTestResult('error', '❌ 请输入API地址');
      return;
    }
    
    const testBtn = document.getElementById('test-connection');
    
    testBtn.disabled = true;
    testBtn.textContent = '测试中...';
    this.showTestResult('testing', '🔄 正在测试连接...');
    
    try {
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5
        })
      });
      
      if (response.ok) {
        this.showTestResult('success', '✅ 连接成功！API配置有效');
      } else {
        const errorText = await response.text();
        let errorMsg = `❌ 连接失败 (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMsg += `: ${errorJson.error.message}`;
          }
        } catch (e) {
          errorMsg += `: ${errorText.substring(0, 100)}`;
        }
        this.showTestResult('error', errorMsg);
      }
    } catch (error) {
      this.showTestResult('error', `❌ 连接失败: ${error.message}`);
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
    }
  }

  showTestResult(type, message) {
    const resultDiv = document.getElementById('test-result');
    if (!resultDiv) return;
    
    resultDiv.className = `test-result test-result-${type}`;
    resultDiv.textContent = message;
    resultDiv.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        if (resultDiv.textContent === message) {
          resultDiv.style.display = 'none';
        }
      }, 3000);
    }
  }

  saveConfig() {
    const provider = document.getElementById('provider-select').value;
    const apiKey = document.getElementById('api-key').value;
    const baseURL = document.getElementById('base-url').value || this.getDefaultBaseURL(provider);
    const model = document.getElementById('model-select').value;
    
    if (!apiKey) {
      this.showTestResult('error', '❌ 请输入API密钥');
      return;
    }
    
    const config = {
      provider,
      apiKey,
      baseURL,
      model,
      createdAt: new Date().toISOString()
    };
    
    this.configManager.saveConfig(config);
    
    if (this.onConfigSaved) {
      this.onConfigSaved(config);
    }
    
    this.showTestResult('success', '✅ 配置保存成功！');
    
    // 切换到密钥管理标签页
    setTimeout(() => {
      this.switchTab('keys');
    }, 1000);
  }

  getDefaultBaseURL(provider) {
    const urls = {
      'openai': 'https://api.openai.com/v1',
      'deepseek': 'https://api.deepseek.com/v1',
      'azure': '',
      'custom': ''
    };
    return urls[provider] || '';
  }

  updateModelOptions(provider) {
    const modelSelect = document.getElementById('model-select');
    const models = {
      'openai': [
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
      ],
      'deepseek': [
        { value: 'deepseek-chat', label: 'DeepSeek Chat' }
      ],
      'azure': [
        { value: 'gpt-4', label: 'GPT-4' }
      ]
    };
    
    const options = models[provider] || models['openai'];
    if (modelSelect) {
      modelSelect.innerHTML = options
        .map(opt => `<option value="${opt.value}">${opt.label}</option>`)
        .join('');
    }
  }

  loadKeys() {
    const configs = this.configManager.loadConfigs();
    const keysList = document.getElementById('keys-list');
    
    if (!keysList) return;
    
    if (configs.length === 0) {
      keysList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔑</div>
          <div class="empty-title">暂无保存的密钥配置</div>
          <div class="empty-desc">切换到"API配置"标签页添加新的密钥</div>
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

  useKey(index) {
    const configs = this.configManager.loadConfigs();
    if (index >= 0 && index < configs.length) {
      const config = configs[index];
      configs.splice(index, 1);
      configs.unshift(config);
      localStorage.setItem(this.configManager.storageKey, JSON.stringify(configs));
      
      const event = new CustomEvent('configUpdated', { detail: { config } });
      window.dispatchEvent(event);
      
      this.loadKeys();
      this.showToast('✅ 已切换到该密钥配置', 'success');
    }
  }

  deleteKey(index) {
    if (!confirm('确定要删除这个密钥配置吗？')) return;
    
    const configs = this.configManager.loadConfigs();
    if (index >= 0 && index < configs.length) {
      configs.splice(index, 1);
      localStorage.setItem(this.configManager.storageKey, JSON.stringify(configs));
      
      if (index === 0 && configs.length > 0) {
        const event = new CustomEvent('configUpdated', { detail: { config: configs[0] } });
        window.dispatchEvent(event);
      } else if (configs.length === 0) {
        const event = new CustomEvent('configUpdated', { detail: { config: null } });
        window.dispatchEvent(event);
      }
      
      this.loadKeys();
      this.showToast('✅ 密钥配置已删除', 'success');
    }
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  destroy() {
    // 清理事件监听器
  }
}