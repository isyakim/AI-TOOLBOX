// API配置页面组件
export class ConfigPage {
  constructor(container, configManager, onConfigSaved) {
    this.container = container;
    this.configManager = configManager;
    this.onConfigSaved = onConfigSaved;
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.loadCurrentConfig();
  }

  render() {
    this.container.innerHTML = `
      <div class="config-page">
        <div class="config-card">
          <div class="config-header">
            <div class="config-title">API配置</div>
          </div>
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
          <div class="form-group" id="base-url-group">
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
    `;
  }

  bindEvents() {
    // 保存配置
    document.getElementById('save-config')?.addEventListener('click', () => {
      this.saveConfig();
    });
    
    // 测试连接
    document.getElementById('test-connection')?.addEventListener('click', () => {
      this.testConnection();
    });
    
    // 服务商切换
    document.getElementById('provider-select')?.addEventListener('change', (e) => {
      this.updateModelOptions(e.target.value);
    });
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
    const resultDiv = document.getElementById('test-result');
    
    // 禁用按钮并显示测试中
    testBtn.disabled = true;
    testBtn.textContent = '测试中...';
    this.showTestResult('testing', '🔄 正在测试连接...');
    
    try {
      // 发送一个简单的测试请求
      const response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: 'test' }
          ],
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
    
    // 3秒后自动隐藏成功消息
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
      alert('❌ 请输入API密钥');
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
    
    alert('✅ 配置保存成功！');
    
    // 跳转到密钥管理页面
    const event = new CustomEvent('navigate', { detail: { page: 'keys' } });
    window.dispatchEvent(event);
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
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
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

  destroy() {
    // 清理事件监听器
  }
}

