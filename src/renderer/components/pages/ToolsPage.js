// AI工具集页面组件
export class ToolsPage {
  constructor(container) {
    this.container = container;
    this.currentTool = null;
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="tools-container">
        <div class="tools-grid" id="tools-grid">
          <div class="tool-card" data-tool="translate">
            <div class="tool-icon">🌐</div>
            <div class="tool-name">文本翻译</div>
            <div class="tool-desc">支持多种语言智能翻译</div>
          </div>
          <div class="tool-card" data-tool="summary">
            <div class="tool-icon">📝</div>
            <div class="tool-name">文本摘要</div>
            <div class="tool-desc">快速生成文章摘要</div>
          </div>
          <div class="tool-card" data-tool="code">
            <div class="tool-icon">💻</div>
            <div class="tool-name">代码助手</div>
            <div class="tool-desc">代码生成、解释和优化</div>
          </div>
          <div class="tool-card" data-tool="writing">
            <div class="tool-icon">✍️</div>
            <div class="tool-name">写作助手</div>
            <div class="tool-desc">文章写作和内容润色</div>
          </div>
          <div class="tool-card" data-tool="grammar">
            <div class="tool-icon">✅</div>
            <div class="tool-name">语法检查</div>
            <div class="tool-desc">检查并纠正语法错误</div>
          </div>
          <div class="tool-card" data-tool="explain">
            <div class="tool-icon">💡</div>
            <div class="tool-name">概念解释</div>
            <div class="tool-desc">解释复杂概念和术语</div>
          </div>
        </div>
        
        <div class="tool-workspace" id="tool-workspace" style="display: none;">
          <div class="tool-workspace-header">
            <h3 id="tool-workspace-title">工具名称</h3>
            <button class="btn btn-secondary" id="back-to-tools">返回</button>
          </div>
          <div class="tool-workspace-content" id="tool-workspace-content">
            <!-- 工具内容将动态加载到这里 -->
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const toolCards = this.container.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
      card.addEventListener('click', () => {
        const tool = card.dataset.tool;
        this.openTool(tool);
      });
    });

    const backBtn = this.container.querySelector('#back-to-tools');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.closeToolWorkspace());
    }
  }

  openTool(toolName) {
    this.currentTool = toolName;
    
    const toolsGrid = this.container.querySelector('#tools-grid');
    const workspace = this.container.querySelector('#tool-workspace');
    const title = this.container.querySelector('#tool-workspace-title');
    const content = this.container.querySelector('#tool-workspace-content');
    
    if (toolsGrid) toolsGrid.style.display = 'none';
    if (workspace) workspace.style.display = 'block';
    
    const toolConfig = this.getToolConfig(toolName);
    if (title) title.textContent = toolConfig.title;
    if (content) content.innerHTML = toolConfig.html;
    
    this.bindToolEvents(toolName);
  }

  closeToolWorkspace() {
    const toolsGrid = this.container.querySelector('#tools-grid');
    const workspace = this.container.querySelector('#tool-workspace');
    
    if (toolsGrid) toolsGrid.style.display = 'grid';
    if (workspace) workspace.style.display = 'none';
    
    this.currentTool = null;
  }

  getToolConfig(toolName) {
    const configs = {
      translate: {
        title: '🌐 文本翻译',
        html: `
          <div class="tool-form">
            <div class="form-group">
              <label class="form-label">源语言</label>
              <select class="form-input" id="source-lang">
                <option value="auto">自动检测</option>
                <option value="zh">中文</option>
                <option value="en">英语</option>
                <option value="ja">日语</option>
                <option value="ko">韩语</option>
                <option value="fr">法语</option>
                <option value="de">德语</option>
                <option value="es">西班牙语</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">目标语言</label>
              <select class="form-input" id="target-lang">
                <option value="zh">中文</option>
                <option value="en">英语</option>
                <option value="ja">日语</option>
                <option value="ko">韩语</option>
                <option value="fr">法语</option>
                <option value="de">德语</option>
                <option value="es">西班牙语</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">输入文本</label>
              <textarea class="form-input" id="translate-input" rows="6" placeholder="请输入要翻译的文本..."></textarea>
            </div>
            <button class="btn btn-primary" id="translate-btn">翻译</button>
            <div class="tool-result" id="translate-result"></div>
          </div>
        `
      },
      summary: {
        title: '📝 文本摘要',
        html: `
          <div class="tool-form">
            <div class="form-group">
              <label class="form-label">输入文本</label>
              <textarea class="form-input" id="summary-input" rows="10" placeholder="请输入要生成摘要的文本..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">摘要长度</label>
              <select class="form-input" id="summary-length">
                <option value="short">简短</option>
                <option value="medium" selected>中等</option>
                <option value="long">详细</option>
              </select>
            </div>
            <button class="btn btn-primary" id="summary-btn">生成摘要</button>
            <div class="tool-result" id="summary-result"></div>
          </div>
        `
      },
      code: {
        title: '💻 代码助手',
        html: `
          <div class="tool-form">
            <div class="form-group">
              <label class="form-label">选择操作</label>
              <select class="form-input" id="code-action">
                <option value="generate">生成代码</option>
                <option value="explain">解释代码</option>
                <option value="optimize">优化代码</option>
                <option value="debug">调试代码</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">编程语言</label>
              <select class="form-input" id="code-lang">
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" id="code-input-label">描述需求或粘贴代码</label>
              <textarea class="form-input" id="code-input" rows="10" placeholder="请输入..."></textarea>
            </div>
            <button class="btn btn-primary" id="code-btn">执行</button>
            <div class="tool-result" id="code-result"></div>
          </div>
        `
      },
      writing: {
        title: '✍️ 写作助手',
        html: `
          <div class="tool-form">
            <div class="form-group">
              <label class="form-label">写作类型</label>
              <select class="form-input" id="writing-type">
                <option value="article">文章</option>
                <option value="email">邮件</option>
                <option value="report">报告</option>
                <option value="creative">创意写作</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">主题或大纲</label>
              <textarea class="form-input" id="writing-input" rows="6" placeholder="请输入写作主题或大纲..."></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">字数要求</label>
              <select class="form-input" id="writing-length">
                <option value="300">约300字</option>
                <option value="500" selected>约500字</option>
                <option value="1000">约1000字</option>
                <option value="2000">约2000字</option>
              </select>
            </div>
            <button class="btn btn-primary" id="writing-btn">开始写作</button>
            <div class="tool-result" id="writing-result"></div>
          </div>
        `
      },
      grammar: {
        title: '✅ 语法检查',
        html: `
          <div class="tool-form">
            <div class="form-group">
              <label class="form-label">输入文本</label>
              <textarea class="form-input" id="grammar-input" rows="10" placeholder="请输入要检查的文本..."></textarea>
            </div>
            <button class="btn btn-primary" id="grammar-btn">检查语法</button>
            <div class="tool-result" id="grammar-result"></div>
          </div>
        `
      },
      explain: {
        title: '💡 概念解释',
        html: `
          <div class="tool-form">
            <div class="form-group">
              <label class="form-label">概念或术语</label>
              <input type="text" class="form-input" id="explain-input" placeholder="请输入要解释的概念或术语...">
            </div>
            <div class="form-group">
              <label class="form-label">解释详细程度</label>
              <select class="form-input" id="explain-level">
                <option value="simple">简单解释</option>
                <option value="medium" selected>适中</option>
                <option value="detailed">详细解释</option>
              </select>
            </div>
            <button class="btn btn-primary" id="explain-btn">解释</button>
            <div class="tool-result" id="explain-result"></div>
          </div>
        `
      }
    };
    
    return configs[toolName] || { title: '未知工具', html: '<p>工具配置错误</p>' };
  }

  bindToolEvents(toolName) {
    const handlers = {
      translate: () => this.handleTranslate(),
      summary: () => this.handleSummary(),
      code: () => this.handleCode(),
      writing: () => this.handleWriting(),
      grammar: () => this.handleGrammar(),
      explain: () => this.handleExplain()
    };

    const btnId = `${toolName}-btn`;
    const btn = this.container.querySelector(`#${btnId}`);
    if (btn && handlers[toolName]) {
      btn.addEventListener('click', handlers[toolName].bind(this));
    }

    if (toolName === 'code') {
      const actionSelect = this.container.querySelector('#code-action');
      if (actionSelect) {
        actionSelect.addEventListener('change', (e) => {
          const label = this.container.querySelector('#code-input-label');
          const input = this.container.querySelector('#code-input');
          if (e.target.value === 'generate') {
            if (label) label.textContent = '描述需求';
            if (input) input.placeholder = '请描述你想生成的代码功能...';
          } else {
            if (label) label.textContent = '粘贴代码';
            if (input) input.placeholder = '请粘贴代码...';
          }
        });
      }
    }
  }

  async handleTranslate() {
    const sourceLang = this.container.querySelector('#source-lang')?.value || 'auto';
    const targetLang = this.container.querySelector('#target-lang')?.value || 'zh';
    const input = this.container.querySelector('#translate-input')?.value || '';
    const result = this.container.querySelector('#translate-result');
    
    if (!input.trim()) {
      if (result) result.innerHTML = '<div class="error-message">请输入要翻译的文本</div>';
      return;
    }
    
    const prompt = `请将以下文本翻译成${targetLang}，只返回翻译结果：\n\n${input}`;
    await this.executeWithAI(prompt, result);
  }

  async handleSummary() {
    const input = this.container.querySelector('#summary-input')?.value || '';
    const length = this.container.querySelector('#summary-length')?.value || 'medium';
    const result = this.container.querySelector('#summary-result');
    
    if (!input.trim()) {
      if (result) result.innerHTML = '<div class="error-message">请输入要生成摘要的文本</div>';
      return;
    }
    
    const lengthMap = { short: '简短', medium: '中等长度', long: '详细' };
    const prompt = `请为以下文本生成一个${lengthMap[length]}的摘要：\n\n${input}`;
    await this.executeWithAI(prompt, result);
  }

  async handleCode() {
    const action = this.container.querySelector('#code-action')?.value || 'generate';
    const lang = this.container.querySelector('#code-lang')?.value || 'javascript';
    const input = this.container.querySelector('#code-input')?.value || '';
    const result = this.container.querySelector('#code-result');
    
    if (!input.trim()) {
      if (result) result.innerHTML = '<div class="error-message">请输入内容</div>';
      return;
    }
    
    const actionMap = {
      generate: `请用${lang}生成以下功能的代码：\n\n${input}`,
      explain: `请解释以下${lang}代码：\n\n${input}`,
      optimize: `请优化以下${lang}代码：\n\n${input}`,
      debug: `请调试以下${lang}代码：\n\n${input}`
    };
    
    await this.executeWithAI(actionMap[action], result);
  }

  async handleWriting() {
    const type = this.container.querySelector('#writing-type')?.value || 'article';
    const input = this.container.querySelector('#writing-input')?.value || '';
    const length = this.container.querySelector('#writing-length')?.value || '500';
    const result = this.container.querySelector('#writing-result');
    
    if (!input.trim()) {
      if (result) result.innerHTML = '<div class="error-message">请输入写作主题</div>';
      return;
    }
    
    const typeMap = { article: '文章', email: '邮件', report: '报告', creative: '创意作品' };
    const prompt = `请写一篇${typeMap[type]}，字数约${length}字：\n\n${input}`;
    await this.executeWithAI(prompt, result);
  }

  async handleGrammar() {
    const input = this.container.querySelector('#grammar-input')?.value || '';
    const result = this.container.querySelector('#grammar-result');
    
    if (!input.trim()) {
      if (result) result.innerHTML = '<div class="error-message">请输入要检查的文本</div>';
      return;
    }
    
    const prompt = `请检查以下文本的语法错误：\n\n${input}`;
    await this.executeWithAI(prompt, result);
  }

  async handleExplain() {
    const input = this.container.querySelector('#explain-input')?.value || '';
    const level = this.container.querySelector('#explain-level')?.value || 'medium';
    const result = this.container.querySelector('#explain-result');
    
    if (!input.trim()) {
      if (result) result.innerHTML = '<div class="error-message">请输入要解释的概念</div>';
      return;
    }
    
    const levelMap = { simple: '简单', medium: '适中', detailed: '详细' };
    const prompt = `请${levelMap[level]}地解释：${input}`;
    await this.executeWithAI(prompt, result);
  }

  async executeWithAI(prompt, resultElement) {
    if (!resultElement) return;
    
    const configManager = window.app?.configManager;
    if (!configManager) {
      resultElement.innerHTML = '<div class="error-message">配置管理器未初始化</div>';
      return;
    }
    
    const config = configManager.getCurrentConfig();
    if (!config || !window.AIClient) {
      resultElement.innerHTML = '<div class="error-message">⚠️ 请先配置API</div>';
      return;
    }
    
    const aiClient = new window.AIClient(config);
    resultElement.innerHTML = '<div class="loading-message">🤔 处理中...</div>';
    
    try {
      let fullResponse = '';
      await aiClient.sendMessage([{ role: 'user', content: prompt }], (chunk) => {
        fullResponse += chunk;
        resultElement.innerHTML = `<div class="success-message">${this.formatMessage(fullResponse)}</div>`;
      });
    } catch (error) {
      resultElement.innerHTML = `<div class="error-message">❌ 错误: ${error.message}</div>`;
    }
  }

  formatMessage(content) {
    return content
      .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  destroy() {
    // 清理
  }
}
