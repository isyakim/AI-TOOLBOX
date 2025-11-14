// 统一设置页面组件 - 合并API配置和密钥管理
export class SettingsPage {
  constructor(container, configManager, onConfigSaved) {
    this.container = container;
    this.configManager = configManager;
    this.onConfigSaved = onConfigSaved;
    this.currentTab = 'api';
    this.providers = [];
    this.filteredProviders = [];
    this.selectedProviderId = '';
    this.customModels = [];
    this.selectedModels = [];
    this.connectionReady = false;
    this.pendingConfig = null;
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.renderProviderList();
    this.selectProvider(this.selectedProviderId);
    this.loadProviders().then(() => {
      this.loadCurrentConfig();
      this.loadKeys();
    }).catch(() => {
      this.loadKeys();
    });
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
            <div class="api-layout">
              <aside class="provider-panel">
                <div class="provider-search">
                  <input type="text" id="provider-search" placeholder="搜索模型平台...">
                </div>
                <div class="provider-list" id="provider-list"></div>
              </aside>
              
              <section class="provider-content" id="provider-content">
                <div class="provider-header">
                  <div>
                    <h3 id="provider-name">服务商</h3>
                    <p id="provider-desc">选择左侧的服务商开始配置</p>
                  </div>
                <div class="provider-actions">
                  <label class="switch">
                    <input type="checkbox" id="provider-enable" checked>
                    <span class="slider"></span>
                  </label>
                  <button class="icon-btn" id="provider-rename" title="编辑名称">✏️</button>
                </div>
              </div>
                
                <div class="api-form-grid">
                  <div class="form-group full">
                    <label class="form-label">API密钥</label>
                    <div class="input-with-actions">
                      <input type="password" id="api-key" placeholder="输入你的API密钥">
                      <button class="icon-btn" id="toggle-key" title="显示/隐藏">👁️</button>
                      <button class="icon-btn" id="copy-key" title="复制密钥">📋</button>
                    </div>
                    <div class="form-hint">密钥仅保存在本地</div>
                  </div>
                  
                  <div class="form-group full">
                    <label class="form-label">API地址</label>
                    <div class="input-with-actions">
                      <input type="text" id="base-url" placeholder="https://api.example.com/v1">
                      <a id="provider-docs" target="_blank" rel="noreferrer">查看文档</a>
                    </div>
                    <div class="form-hint" id="base-url-hint"></div>
                  </div>
                </div>
                
                <div class="models-section">
                  <div class="models-header">
                    <div>
                      <label class="form-label">模型管理</label>
                      <p class="form-hint">可多选需要启用的模型，也可手动添加</p>
                    </div>
                    <div class="models-actions">
                      <input type="text" id="model-search" placeholder="搜索模型...">
                      <button class="btn btn-secondary" id="add-model-btn">＋ 添加模型</button>
                    </div>
                  </div>
                  <div class="models-list" id="models-list"></div>
                </div>
                
                <div class="model-add-form" id="model-add-form">
                  <input type="text" id="new-model-name" placeholder="模型标识，如 claude-4.1">
                  <button class="btn btn-primary" id="confirm-add-model">添加</button>
                </div>
                
                <div class="form-actions">
                  <button class="btn btn-secondary" id="test-connection">测试连接</button>
                  <button class="btn btn-primary" id="save-config">保存配置</button>
                </div>
                
                <div id="test-result" class="test-result"></div>
              </section>
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

  async loadProviders() {
    try {
      const response = await fetch('data/providers.json');
      const data = await response.json();
      this.providers = data;
      this.filteredProviders = [...this.providers];
      this.selectedProviderId = this.providers[0]?.id || 'custom';
      this.renderProviderList();
      this.selectProvider(this.selectedProviderId);
      if (this.pendingConfig) {
        const config = this.pendingConfig;
        this.pendingConfig = null;
        this.applyConfig(config);
      }
    } catch (error) {
      console.error('加载服务商列表失败:', error);
      const fallback = {
        id: 'custom',
        name: '自定义服务',
        desc: '手动配置 API 地址与模型',
        baseURL: '',
        docs: '#',
        endpoint: '/chat/completions',
        models: [],
        custom: true
      };
      this.providers = [fallback];
      this.filteredProviders = [...this.providers];
      this.selectedProviderId = fallback.id;
      this.renderProviderList();
      this.selectProvider(fallback.id);
      if (this.pendingConfig) {
        const config = this.pendingConfig;
        this.pendingConfig = null;
        this.applyConfig(config);
      }
    }
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
    
    document.getElementById('provider-search')?.addEventListener('input', (e) => {
      this.filterProviders(e.target.value);
    });
    
    document.getElementById('model-search')?.addEventListener('input', (e) => {
      this.renderModels(e.target.value);
    });
    
    document.getElementById('add-model-btn')?.addEventListener('click', () => {
      const form = document.getElementById('model-add-form');
      form?.classList.toggle('active');
    });
    
    document.getElementById('confirm-add-model')?.addEventListener('click', () => {
      this.addCustomModel();
    });

    document.getElementById('provider-rename')?.addEventListener('click', () => {
      this.renameProvider();
    });
    
    document.getElementById('toggle-key')?.addEventListener('click', () => {
      const input = document.getElementById('api-key');
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
    
    document.getElementById('copy-key')?.addEventListener('click', () => {
      const input = document.getElementById('api-key');
      if (!input || !input.value) return;
      navigator.clipboard.writeText(input.value).then(() => {
        this.showToast('已复制密钥到剪贴板');
      }).catch(() => {
        this.showToast('复制失败', 'error');
      });
    });

    document.getElementById('api-key')?.addEventListener('input', () => this.markConnectionPending());
    document.getElementById('base-url')?.addEventListener('input', () => this.markConnectionPending());
    document.getElementById('provider-enable')?.addEventListener('change', () => this.markConnectionPending());
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
    if (!config) return;
    if (!this.providers.length) {
      this.pendingConfig = config;
      return;
    }
    this.applyConfig(config);
  }

  async testConnection() {
    const provider = this.selectedProviderId;
    const providerInfo = this.providers.find(p => p.id === provider);
    const apiKey = document.getElementById('api-key').value;
    const baseURL = document.getElementById('base-url').value || this.getDefaultBaseURL(provider);
    const models = this.selectedModels.length > 0 ? this.selectedModels : [providerInfo?.models?.[0]?.value].filter(Boolean);
    
    if (!apiKey) {
      this.showTestResult('error', '❌ 请输入API密钥');
      return;
    }
    
    if (!baseURL) {
      this.showTestResult('error', '❌ 请输入API地址');
      return;
    }
    
    const testBtn = document.getElementById('test-connection');
    
    if (models.length === 0) {
      this.showTestResult('error', '❌ 请至少选择一个模型');
      return;
    }
    testBtn.disabled = true;
    testBtn.textContent = '测试中...';
    
    this.showTestResult('testing', '🔄 正在测试连接...');
    
    const results = [];
    
    try {
      for (const model of models) {
        try {
          const base = baseURL.replace(/\/$/, '');
          const endpoint = providerInfo?.endpoint || '/chat/completions';
          const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'test' }],
              max_tokens: 5
            })
          });
          
          if (response.ok) {
            results.push({ model, success: true });
          } else {
            const errorText = await response.text();
            results.push({ model, success: false, message: errorText.substring(0, 80) });
          }
        } catch (err) {
          results.push({ model, success: false, message: err.message });
        }
      }
      
      const allSuccess = results.every(r => r.success);
      this.connectionReady = allSuccess;
      const message = allSuccess ? '✅ 所有模型连接成功' : '部分模型连接失败';
      this.showTestResult(allSuccess ? 'success' : 'error', this.formatTestResults(results));
      window.dispatchEvent(new CustomEvent('apiConnectionStatus', {
        detail: { ready: allSuccess, status: allSuccess ? 'ready' : 'error', results, message }
      }));
      if (allSuccess) {
        const storeModels = this.selectedModels.length ? this.selectedModels : models;
        localStorage.setItem('ai-toolbox-available-models', JSON.stringify(storeModels));
        window.dispatchEvent(new CustomEvent('availableModelsUpdated', {
          detail: { models: storeModels }
        }));
      }
    } catch (error) {
      this.connectionReady = false;
      this.showTestResult('error', `❌ 连接失败: ${error.message}`);
      window.dispatchEvent(new CustomEvent('apiConnectionStatus', {
        detail: { ready: false, status: 'error', results: [], message: error.message }
      }));
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

  formatTestResults(results) {
    if (!results.length) return '未执行测试';
    return results.map(result => {
      if (result.success) {
        return `✅ ${result.model}`;
      }
      return `❌ ${result.model} - ${result.message || '未知错误'}`;
    }).join('\n');
  }

  saveConfig() {
    const providerInfo = this.providers.find(p => p.id === this.selectedProviderId);
    const provider = providerInfo?.id || 'custom';
    const apiKey = document.getElementById('api-key').value;
    const baseURL = document.getElementById('base-url').value || this.getDefaultBaseURL(provider);
    
    if (!apiKey) {
      this.showTestResult('error', '❌ 请输入API密钥');
      return;
    }
    
    const config = {
      provider,
      apiKey,
      baseURL,
      models: this.selectedModels,
      model: this.selectedModels[0] || '',
      customModels: this.customModels,
      endpoint: providerInfo?.endpoint || '/chat/completions',
      createdAt: new Date().toISOString(),
      connectionReady: this.connectionReady
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
    const match = this.providers.find(p => p.id === provider);
    return match?.baseURL || '';
  }

  renderProviderList() {
    const list = document.getElementById('provider-list');
    if (!list) return;
    if (this.filteredProviders.length === 0) {
      list.innerHTML = '<div class="provider-empty">未找到匹配的服务商</div>';
      return;
    }
    list.innerHTML = this.filteredProviders.map(provider => `
      <button class="provider-item ${provider.id === this.selectedProviderId ? 'active' : ''}" data-provider="${provider.id}">
        <span class="provider-name">${provider.name}</span>
        <span class="provider-desc">${provider.desc}</span>
      </button>
    `).join('');
    
    list.querySelectorAll('.provider-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.provider;
        this.selectProvider(id);
      });
    });
  }

  renameProvider() {
    const provider = this.providers.find(p => p.id === this.selectedProviderId);
    if (!provider || !(provider.custom || provider.id.startsWith('custom'))) return;
    const newName = prompt('输入自定义服务名称', provider.name);
    if (newName && newName.trim()) {
      provider.name = newName.trim();
      provider.custom = true;
      this.renderProviderList();
      this.selectProvider(provider.id, false);
    }
  }

  filterProviders(keyword) {
    const lower = (keyword || '').toLowerCase();
    this.filteredProviders = this.providers.filter(provider => 
      provider.name.toLowerCase().includes(lower) ||
      (provider.desc?.toLowerCase().includes(lower))
    );
    this.renderProviderList();
  }

  selectProvider(providerId, resetSelections = true) {
    const provider = this.providers.find(p => p.id === providerId) || this.providers[0];
    if (!provider) return;
    this.selectedProviderId = provider.id;
    const nameEl = document.getElementById('provider-name');
    const descEl = document.getElementById('provider-desc');
    const baseUrlInput = document.getElementById('base-url');
    const docsLink = document.getElementById('provider-docs');
    const baseHint = document.getElementById('base-url-hint');
    const renameBtn = document.getElementById('provider-rename');
    
    if (nameEl) nameEl.textContent = provider.name;
    if (descEl) descEl.textContent = provider.desc;
    if (baseUrlInput && (!baseUrlInput.value || resetSelections)) {
      baseUrlInput.value = provider.baseURL;
    }
    if (docsLink) docsLink.href = provider.docs || '#';
    if (baseHint) baseHint.textContent = provider.baseURL ? `默认：${provider.baseURL}` : '可配置自定义地址';
    if (renameBtn) {
      renameBtn.style.display = provider.custom || provider.id.startsWith('custom') ? 'inline-flex' : 'none';
    }
    
    const providerModels = provider.models || [];
    if (resetSelections) {
      this.selectedModels = providerModels.slice(0, 1).map(m => m.value);
      this.customModels = [];
      const apiKeyInput = document.getElementById('api-key');
      if (apiKeyInput) apiKeyInput.value = '';
    }
    const addForm = document.getElementById('model-add-form');
    if (addForm) addForm.classList.remove('active');
    const modelSearch = document.getElementById('model-search');
    if (modelSearch) modelSearch.value = '';
    this.renderProviderList();
    this.renderModels();
    this.markConnectionPending();
  }

  renderModels(filterKeyword = '') {
    const list = document.getElementById('models-list');
    if (!list) return;
    const provider = this.providers.find(p => p.id === this.selectedProviderId);
    if (!provider) return;
    const baseModels = provider.models || [];
    const allModels = [...baseModels, ...this.customModels.map(name => ({ value: name, label: name, custom: true }))];
    const keyword = filterKeyword.toLowerCase();
    const filtered = allModels.filter(model => model.label.toLowerCase().includes(keyword));
    
    if (filtered.length === 0) {
      list.innerHTML = '<div class="models-empty">暂无模型，可点击“添加模型”自定义</div>';
      return;
    }
    
    list.innerHTML = filtered.map(model => {
      const checked = this.selectedModels.includes(model.value);
      return `
        <label class="model-chip ${checked ? 'active' : ''}">
          <input type="checkbox" value="${model.value}" ${checked ? 'checked' : ''}>
          <span class="model-name">${model.label}</span>
          ${model.custom ? '<span class="model-tag">自定义</span>' : ''}
        </label>
      `;
    }).join('');
    
    list.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const chip = e.target.closest('.model-chip');
        if (chip) {
          chip.classList.toggle('active', e.target.checked);
        }
        this.toggleModelSelection(e.target.value, e.target.checked);
      });
    });
  }

  toggleModelSelection(modelValue, checked) {
    if (checked) {
      if (!this.selectedModels.includes(modelValue)) {
        this.selectedModels.push(modelValue);
      }
    } else {
      this.selectedModels = this.selectedModels.filter(m => m !== modelValue);
    }
    this.markConnectionPending();
  }

  addCustomModel() {
    const input = document.getElementById('new-model-name');
    if (!input || !input.value.trim()) return;
    const modelName = input.value.trim();
    if (!this.customModels.includes(modelName)) {
      this.customModels.push(modelName);
      this.selectedModels.push(modelName);
      this.renderModels();
    }
    input.value = '';
    document.getElementById('model-add-form')?.classList.remove('active');
    this.markConnectionPending();
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
                <span class="key-value">${(config.models && config.models.length > 0 ? config.models.join(', ') : '未选择')}</span>
              </div>
              <div class="key-field">
                <span class="key-label">创建时间:</span>
                <span class="key-value">${date}</span>
              </div>
            </div>
          </div>
          <div class="key-actions">
            <button class="btn btn-secondary edit-key-btn" data-index="${index}">编辑</button>
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
    keysList.querySelectorAll('.edit-key-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.editKey(index);
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
      'openrouter': 'OpenRouter',
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

  markConnectionPending() {
    if (this.connectionReady) {
      this.connectionReady = false;
      window.dispatchEvent(new CustomEvent('apiConnectionStatus', {
        detail: { ready: false, status: 'waiting', message: '等待测试' }
      }));
    }
  }

  editKey(index) {
    const configs = this.configManager.loadConfigs();
    if (index < 0 || index >= configs.length) return;
    const config = configs[index];
    this.switchTab('api');
    this.selectedProviderId = config.provider || 'custom';
    this.customModels = config.customModels || [];
    this.selectedModels = config.models || (config.model ? [config.model] : []);
    this.connectionReady = !!config.connectionReady;
    if (!this.providers.find(p => p.id === this.selectedProviderId)) {
      this.providers.push({
        id: this.selectedProviderId,
        name: config.provider || '自定义服务',
        desc: '导入的自定义服务',
        baseURL: config.baseURL || '',
        docs: '#',
        models: (config.models || []).map(value => ({ value, label: value, custom: true }))
      });
      this.filteredProviders = [...this.providers];
    }
    this.selectProvider(this.selectedProviderId, false);
    const apiKeyInput = document.getElementById('api-key');
    const baseUrlInput = document.getElementById('base-url');
    if (apiKeyInput) apiKeyInput.value = config.apiKey || '';
    if (baseUrlInput) baseUrlInput.value = config.baseURL || '';
    this.renderModels();
  }

  applyConfig(config) {
    this.customModels = config.customModels || [];
    this.selectedModels = config.models || (config.model ? [config.model] : []);
    this.selectedProviderId = config.provider || this.providers[0]?.id || 'custom';
    if (!this.providers.find(p => p.id === this.selectedProviderId)) {
      this.providers.push({
        id: this.selectedProviderId,
        name: config.provider || '自定义服务',
        desc: '导入的自定义服务',
        baseURL: config.baseURL || '',
        docs: '#',
        endpoint: '/chat/completions',
        models: (this.selectedModels || []).map(value => ({ value, label: value, custom: true })),
        custom: true
      });
      this.filteredProviders = [...this.providers];
    }
    this.selectProvider(this.selectedProviderId, false);
    const apiKeyInput = document.getElementById('api-key');
    const baseUrlInput = document.getElementById('base-url');
    if (apiKeyInput) apiKeyInput.value = config.apiKey || '';
    if (baseUrlInput) baseUrlInput.value = config.baseURL || '';
    this.renderModels();
    this.connectionReady = !!config.connectionReady;
    window.dispatchEvent(new CustomEvent('apiConnectionStatus', {
      detail: { ready: this.connectionReady, status: this.connectionReady ? 'ready' : 'waiting', message: this.connectionReady ? 'API连接已就绪' : '等待测试' }
    }));
    if (this.connectionReady && this.selectedModels.length) {
      localStorage.setItem('ai-toolbox-available-models', JSON.stringify(this.selectedModels));
      window.dispatchEvent(new CustomEvent('availableModelsUpdated', {
        detail: { models: this.selectedModels }
      }));
    }
  }
}
