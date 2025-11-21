
// 智能对话页面组件
import { SessionManager } from '../SessionManager.js';
import { getFileAccessSettings, addFileActionLog } from '../../utils/fileAccess.js';

export class ChatPage {
  constructor(container, aiClient, configManager) {
    this.container = container;
    this.aiClient = aiClient;
    this.configManager = configManager;
    this.sessionManager = new SessionManager();
    this.contentWrapper = this.container.closest('.content-area');
    this.currentSessionId = null;
    this.roleModes = [
      {
        id: 'roo-helper',
        title: 'Roo · 默认助手',
        desc: '友好万能型，回答清晰有条理。',
        prompt: '你是 Roo，一位沉稳可靠的助手。请以结构清晰、语气友好的方式回答，并在需要时给出可执行的步骤。'
      },
      {
        id: 'roo-coder',
        title: 'Roo · 代码专家',
        desc: '偏工程实现，输出代码与命令。',
        prompt: '你是 Roo 的代码专家。优先输出可运行的代码片段与调试命令，必要时说明风险或性能建议。'
      },
      {
        id: 'roo-product',
        title: 'Roo · 产品参谋',
        desc: '聚焦体验和策略，强调用户价值。',
        prompt: '你是 Roo 的产品参谋。回答需要兼顾用户价值、成功指标与落地建议。'
      },
      {
        id: 'roo-challenger',
        title: 'Roo · 思辨导师',
        desc: '喜欢提问和反思，激发更深层思考。',
        prompt: '你是 Roo 的思辨导师。请通过提问和反例帮助用户更深入地思考问题。'
      }
    ];
    this.currentRoleIndex = 0;
    this.isGenerating = false;
    this.stopRequested = false;
    this.activeAssistantMessage = null;
    this.availableModels = this.getAvailableModelsFromStorage();
    this.fileAccess = getFileAccessSettings();
    const defaults = this.getDefaultModelOptions();
    this.selectedModelValue = this.availableModels[0]?.value || defaults[0]?.value || 'gpt-4o';
    this.handleAvailableModelsUpdate = (event) => {
      const models = event.detail?.models || [];
      this.availableModels = models.map(m => ({ value: m, label: m }));
      if (!this.availableModels.length) {
        this.availableModels = this.getDefaultModelOptions();
      }
      if (!this.availableModels.find(m => m.value === this.selectedModelValue)) {
        this.selectedModelValue = this.availableModels[0]?.value || this.selectedModelValue;
      }
      this.updateModelSelect();
    };
    window.addEventListener('availableModelsUpdated', this.handleAvailableModelsUpdate);
    this.handleFileAccessUpdate = () => {
      this.fileAccess = getFileAccessSettings();
      this.refreshFileAccessSummary();
    };
    window.addEventListener('fileAccessUpdated', this.handleFileAccessUpdate);
    this.sessionKeyword = '';
    this.init();
  }

  init() {
    this.contentWrapper?.classList.add('chat-layout');
    this.render();
    this.bindEvents();
    this.loadOrCreateSession();
    this.restoreSidebarState();
  }

  render() {
    this.fileAccess = getFileAccessSettings();
    const roleOptionsHtml = this.getRoleOptionsHtml();
    this.container.innerHTML = `
      <div class="chat-shell chat-container">
        ${this.getSidebarTemplate(roleOptionsHtml)}
        <button class="chat-sidebar-toggle" id="chat-sidebar-toggle" title="折叠/展开侧栏">
          <span class="toggle-icon">◀</span>
        </button>
        <section class="chat-main">
          <div class="chat-surface glass-panel">
            ${this.getMessagesTemplate()}
            ${this.getComposerTemplate()}
          </div>
        </section>
      </div>
    `;
  }

  getRoleOptionsHtml() {
    return this.roleModes.map(role => `
      <button class="role-option" data-role-id="${role.id}">
        <span class="role-option-title">${this.escapeHtml(role.title)}</span>
        <span class="role-option-desc">${this.escapeHtml(role.desc)}</span>
      </button>
    `).join('');
  }

  getSidebarTemplate(roleOptionsHtml) {
    return `
      <aside class="chat-sidebar glass-panel" id="chat-sidebar">
        <div class="sidebar-tabs">
          <button class="sidebar-tab active" data-tab="sessions">
            <span>🗂 会话</span>
          </button>
          <button class="sidebar-tab" data-tab="overview">
            <span>📊 概览</span>
          </button>
        </div>
        <div class="sidebar-panel active" data-tab-panel="sessions">
          <div class="sidebar-head">
            <div>
              <p class="sidebar-eyebrow">会话集</p>
              <h3>全部对话</h3>
            </div>
            <button class="sidebar-add-btn icon-button" id="new-session-btn" title="新建会话">＋</button>
          </div>
          <div class="sidebar-search">
            <span class="sidebar-search-icon">🔍</span>
            <input type="text" id="session-search" placeholder="搜索会话或关键字">
          </div>
          <div class="session-list" id="session-list"></div>
        </div>
        <div class="sidebar-panel" data-tab-panel="overview">
          ${this.getTopPanelTemplate(roleOptionsHtml)}
        </div>
      </aside>
    `;
  }

  getTopPanelTemplate(roleOptionsHtml) {
    const currentRole = this.roleModes[this.currentRoleIndex] || this.roleModes[0];
    return `
      <div class="chat-top-panel glass-panel">
        <div class="chat-info-grid">
          <div class="info-card info-card-stats">
            <div class="info-label">会话概览</div>
            <div class="info-value" id="chat-session-stats">0 条记录</div>
            <div class="info-hint" id="chat-context-summary">初始化...</div>
          </div>
          <div class="info-card info-card-model">
            <div class="info-label">当前模型</div>
            <div class="info-inline">
              <select class="setting-select" id="model-select">
                ${this.getModelOptionsHtml()}
              </select>
              <button class="icon-button" id="clear-session-btn" title="清空当前会话">🧹</button>
            </div>
          </div>
          <div class="info-card info-card-role">
            <div class="info-label">角色设定</div>
            <div class="role-selector">
              <button class="role-pill" id="role-dropdown-toggle">
                <span id="role-dropdown-label">${this.escapeHtml(currentRole.title)}</span>
                <span class="role-caret">▾</span>
              </button>
              <div class="role-dropdown" id="role-dropdown">
                ${roleOptionsHtml}
              </div>
            </div>
          </div>
          <div class="info-card info-card-mode">
            <div class="info-label">对话模式</div>
            <span class="context-badge" id="chat-mode-label" data-mode="cloud">云端</span>
            <div class="info-hint">输入 “claude ...” 可切换 CLI</div>
          </div>
          ${this.getFileAccessCard()}
        </div>
      </div>
    `;
  }

  getFileAccessCard() {
    const settings = this.fileAccess || getFileAccessSettings();
    const enabled = !!settings?.enabled;
    const autoExecute = !!settings?.autoExecute;
    const directories = settings?.directories || [];
    const scopeText = this.getFileAccessScopeText(directories);
    return `
      <div class="info-card info-card-access" id="file-access-card">
        <div class="info-label">文件权限</div>
        <div class="access-pill-row">
          <span class="pill ${enabled ? 'pill-success' : 'pill-muted'}" id="file-access-enabled">
            ${enabled ? '已启用' : '未开启'}
          </span>
          <span class="pill pill-muted" id="file-access-mode">
            ${autoExecute ? '自动执行' : '手动确认'}
          </span>
        </div>
        <div class="info-hint" id="file-access-scope">${scopeText}</div>
        <button class="ghost-btn open-access-btn" id="open-access-settings">管理权限</button>
      </div>
    `;
  }

  getMessagesTemplate() {
    return `<div class="chat-messages" id="chat-messages">${this.getEmptyStateHtml()}</div>`;
  }

  getComposerTemplate() {
    return `
      <div class="chat-composer">
        <div class="composer-toolbar">
          <div class="composer-buttons">
            <button class="icon-btn" id="attach-btn" title="添加附件">📎</button>
            <button class="icon-btn" id="voice-btn" title="语音输入 (敬请期待)" disabled>🎤</button>
            <button class="icon-btn" id="prompt-hint-btn" title="AI 建议提示">✨</button>
          </div>
          <div class="composer-meta">
            <span>⌘ + Enter 发送 · Shift + Enter 换行</span>
            <button class="ghost-btn" id="toggle-input-settings" title="显示/隐藏对话参数">调参</button>
          </div>
        </div>
        <div class="composer-body">
          <textarea class="chat-input" id="chat-input" rows="3" placeholder="输入你的问题… 支持 claude 指令、代码、产品思路"></textarea>
          <div class="composer-actions">
            <button class="chat-stop-btn" id="stop-btn" style="display: none;">暂停</button>
            <button class="chat-send-btn" id="send-btn" title="发送">
              <span class="send-icon">⮚</span>
            </button>
          </div>
        </div>
        <div class="chat-input-settings collapsed" id="chat-input-settings">
          <div class="input-setting">
            <label class="setting-label">
              <span>温度 (Temperature)</span>
              <div class="slider-container">
                <input type="range" class="setting-slider" id="temperature-slider" min="0" max="2" step="0.1" value="0.7">
                <span class="slider-value" id="temperature-value">0.7</span>
              </div>
            </label>
          </div>
          <div class="input-setting">
            <label class="setting-label">
              <span>上下文长度</span>
              <div class="slider-container">
                <input type="range" class="setting-slider" id="context-slider" min="1" max="20" step="1" value="10">
                <span class="slider-value" id="context-value">10</span>
              </div>
            </label>
          </div>
          <div class="input-setting toggles">
            <label class="setting-checkbox">
              <input type="checkbox" id="enable-web">
              <span>🌐 启用联网搜索</span>
            </label>
            <label class="setting-checkbox">
              <input type="checkbox" id="enable-memory" checked>
              <span>🧠 启用上下文记忆</span>
            </label>
            <label class="setting-checkbox">
              <input type="checkbox" id="enable-stream" checked>
              <span>⚡ 启用流式响应</span>
            </label>
          </div>
        </div>
        <div class="chat-attachments" id="chat-attachments"></div>
      </div>
    `;
  }

  getEmptyStateHtml() {
    return `
      <div class="chat-empty-state" id="chat-empty-state">
        <div class="empty-icon">💬</div>
        <h3>开始新的讨论</h3>
        <p>描述你的需求，或直接输入 “claude …” 使用本地 CLI。</p>
      </div>
    `;
  }

  updateEmptyState(hasMessages) {
    const emptyState = document.getElementById('chat-empty-state');
    if (!emptyState) return;
    emptyState.style.display = hasMessages ? 'none' : 'flex';
  }

  bindEvents() {
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    const newSessionBtn = document.getElementById('new-session-btn');
    const attachBtn = document.getElementById('attach-btn');
    const temperatureSlider = document.getElementById('temperature-slider');
    const contextSlider = document.getElementById('context-slider');
    const sidebarToggle = document.getElementById('chat-sidebar-toggle');
    const modelSelect = document.getElementById('model-select');
    const clearSessionBtn = document.getElementById('clear-session-btn');
    const toggleInputSettingsBtn = document.getElementById('toggle-input-settings');
    const inputSettingsPanel = document.getElementById('chat-input-settings');
    const roleDropdownToggle = document.getElementById('role-dropdown-toggle');
    const roleDropdown = document.getElementById('role-dropdown');
    const stopBtn = document.getElementById('stop-btn');
    const sessionSearch = document.getElementById('session-search');
    const accessSettingsBtn = document.getElementById('open-access-settings');
    const sidebarTabs = this.container.querySelectorAll('.sidebar-tab');
    const sidebarPanels = this.container.querySelectorAll('.sidebar-panel');

    sendBtn?.addEventListener('click', () => this.sendMessage());
    newSessionBtn?.addEventListener('click', () => this.createNewSession());
    clearSessionBtn?.addEventListener('click', () => this.clearCurrentSession());
    stopBtn?.addEventListener('click', () => this.requestStopGeneration());
    
    // 对话列表折叠功能
    sidebarToggle?.addEventListener('click', () => {
      this.toggleSidebar();
    });
    
    // 温度滑块
    temperatureSlider?.addEventListener('input', (e) => {
      const value = e.target.value;
      const valueDisplay = document.getElementById('temperature-value');
      if (valueDisplay) {
        valueDisplay.textContent = value;
      }
    });
    
    // 上下文长度滑块
    contextSlider?.addEventListener('input', (e) => {
      const value = e.target.value;
      const valueDisplay = document.getElementById('context-value');
      if (valueDisplay) {
        valueDisplay.textContent = value;
      }
    });

    // 附件上传
    attachBtn?.addEventListener('click', () => this.handleAttachment());
    
    chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    chatInput?.addEventListener('input', () => this.updateModeIndicator());
    chatInput?.addEventListener('paste', (e) => this.handlePaste(e));
    modelSelect?.addEventListener('change', () => {
      this.selectedModelValue = modelSelect.value;
      this.updateModeIndicator();
    });
    sessionSearch?.addEventListener('input', (e) => {
      this.sessionKeyword = e.target.value.trim().toLowerCase();
      this.renderSessionList();
    });
    accessSettingsBtn?.addEventListener('click', () => this.openFileAccessSettings());
    sidebarTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        sidebarTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        sidebarPanels.forEach(panel => {
          panel.classList.toggle('active', panel.dataset.tabPanel === target);
        });
      });
    });

    toggleInputSettingsBtn?.addEventListener('click', () => {
      if (!inputSettingsPanel) return;
      inputSettingsPanel.classList.toggle('collapsed');
      toggleInputSettingsBtn.textContent = inputSettingsPanel.classList.contains('collapsed') ? '调参' : '收起';
    });

    roleDropdownToggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      roleDropdown?.classList.toggle('open');
    });

    roleDropdown?.querySelectorAll('.role-option').forEach(option => {
      option.addEventListener('click', () => {
        this.selectRole(option.dataset.roleId);
        roleDropdown?.classList.remove('open');
      });
    });
    roleDropdown?.addEventListener('click', (event) => event.stopPropagation());

    document.addEventListener('click', () => {
      roleDropdown?.classList.remove('open');
    });

    this.updateRoleUI();
    this.updateModeIndicator();
    this.refreshFileAccessSummary();
  }

  toggleSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    const toggleBtn = document.getElementById('chat-sidebar-toggle');
    const toggleIcon = toggleBtn?.querySelector('.toggle-icon');
    const chatContainer = this.container.querySelector('.chat-container');
    
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      
      // 更新按钮图标
      if (toggleIcon) {
        toggleIcon.textContent = isCollapsed ? '▶' : '◀';
      }
      if (chatContainer) {
        chatContainer.classList.toggle('sidebar-collapsed', isCollapsed);
      }
      
      // 保存状态到localStorage
      localStorage.setItem('chat-sidebar-collapsed', isCollapsed);
    }
  }

  restoreSidebarState() {
    const isCollapsed = localStorage.getItem('chat-sidebar-collapsed') === 'true';
    if (isCollapsed) {
      const sidebar = document.getElementById('chat-sidebar');
      const toggleBtn = document.getElementById('chat-sidebar-toggle');
      const toggleIcon = toggleBtn?.querySelector('.toggle-icon');
      const chatContainer = this.container.querySelector('.chat-container');

      if (sidebar) {
        sidebar.classList.add('collapsed');
      }
      if (toggleIcon) {
        toggleIcon.textContent = '▶';
      }
      if (chatContainer) {
        chatContainer.classList.add('sidebar-collapsed');
      }
    }
  }

  updateModeIndicator() {
    const label = document.getElementById('chat-mode-label');
    if (!label) return;
    const input = document.getElementById('chat-input');
    const modelSelect = document.getElementById('model-select');
    const value = input?.value.trim() || '';

    if (value.startsWith('claude ')) {
      label.textContent = 'Claude CLI 模式';
      label.dataset.mode = 'cli';
    } else {
      const modelValue = modelSelect?.value || 'gpt-4';
      const modelLabel = modelSelect?.selectedOptions?.[0]?.textContent || modelValue;
      label.textContent = `云端：${modelLabel}`;
      label.dataset.mode = 'cloud';
    }
  }

  refreshFileAccessSummary() {
    const settings = getFileAccessSettings();
    this.fileAccess = settings;
    const enabledEl = document.getElementById('file-access-enabled');
    const modeEl = document.getElementById('file-access-mode');
    const scopeEl = document.getElementById('file-access-scope');
    if (!enabledEl || !modeEl || !scopeEl) return;
    enabledEl.textContent = settings.enabled ? '已启用' : '未开启';
    enabledEl.classList.toggle('pill-success', settings.enabled);
    enabledEl.classList.toggle('pill-muted', !settings.enabled);
    modeEl.textContent = settings.autoExecute ? '自动执行' : '手动确认';
    scopeEl.textContent = this.getFileAccessScopeText(settings.directories || []);
  }

  getFileAccessScopeText(directories) {
    if (!directories || !directories.length) return '未配置授权范围';
    if (directories.length === 1) return directories[0];
    const preview = directories.slice(0, 2).join('、');
    return directories.length > 2 ? `${preview} 等` : preview;
  }

  openFileAccessSettings() {
    const settingsNav = document.querySelector('.nav-item[data-page="settings"]');
    settingsNav?.click();
    setTimeout(() => {
      const filesTab = document.querySelector('.settings-tab[data-tab="files"]');
      filesTab?.click();
    }, 200);
  }

  selectRole(roleId) {
    const index = this.roleModes.findIndex(role => role.id === roleId);
    if (index === -1) return;
    this.currentRoleIndex = index;
    this.updateRoleUI();
  }

  updateRoleUI() {
    const role = this.roleModes[this.currentRoleIndex];
    const label = document.getElementById('role-dropdown-label');
    const chatInput = document.getElementById('chat-input');
    if (label && role) {
      label.textContent = role.title;
    }
    if (chatInput && role) {
      chatInput.placeholder = `【${role.title}】输入你的问题... (输入 claude + 内容 可走 Claude CLI，Shift+Enter换行)`;
    }
  }

  getBaseSystemPrompt() {
    return [
      '你正在使用一个具备文件读写能力的桌面 IDE 助理。你拥有名为 file-action 的工具，可以直接读取/修改/删除本地文件、列出目录，无需也禁止要求用户手动粘贴内容。',
      '只要用户提到“读取/查看/编辑/删除/列出目录”等需求，你必须使用该工具，不得声称“无法访问本地文件”。',
      '请按照如下格式输出指令：',
      '```file-action',
      '{',
      '  "action": "read|write|delete",',
      '  "path": "相对于项目根目录的路径（例如 src/app.js）",',
      '  "content": "当 action 为 write/edit 时必填的新内容"',
      '}',
      '```',
      '若 action=read 且 path 指向目录，则视为列出该目录。',
      '一次可以包含多个 file-action 代码块。等待工具执行结果后再继续回答。'
    ].join('\n');
  }

  extractFileActions(rawText) {
    if (!rawText) return [];
    const regex = /```file-action\s*([\s\S]+?)```/gi;
    const actions = [];
    let match;
    while ((match = regex.exec(rawText)) !== null) {
      try {
        const payload = JSON.parse(match[1]);
        if (payload && payload.action && payload.path) {
          actions.push(payload);
        }
      } catch (error) {
        console.warn('无法解析 file-action：', error);
      }
    }
    return actions;
  }

  attachFileActions(messageEl, content) {
    const actions = this.extractFileActions(content);
    if (!actions.length) return;
    const panel = document.createElement('div');
    panel.className = 'file-action-panel';
    if (this.fileAccess?.showSteps === false) {
      panel.classList.add('compact');
    }
    actions.forEach((action, index) => {
      const item = document.createElement('div');
      item.className = 'file-action-item';
      item.innerHTML = `
        <div class="file-action-title">文件操作 ${index + 1}</div>
        <div class="file-action-desc">${this.describeFileAction(action)}</div>
        <div class="file-action-status" data-status="pending">等待确认</div>
      `;
      const btnRow = document.createElement('div');
      btnRow.className = 'file-action-actions';
      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = '执行';
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.addEventListener('click', () => this.confirmFileAction(action, item));
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '忽略';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.addEventListener('click', () => item.remove());
      if (this.fileAccess?.autoExecute) {
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = '取消';
        this.executeFileAction(action, item);
      } else {
        btnRow.appendChild(confirmBtn);
        btnRow.appendChild(cancelBtn);
      }
      item.appendChild(btnRow);
      panel.appendChild(item);
    });
    const messageContent = messageEl.querySelector('.message-content');
    if (messageContent) {
      messageContent.parentElement?.appendChild(panel);
    } else {
      messageEl.appendChild(panel);
    }
  }

  describeFileAction(action) {
    const base = `操作：${action.action} | 路径：${action.path}`;
    if ((action.action === 'write' || action.action === 'edit') && action.content) {
      return `${base}<br>内容预览：${this.escapeHtml(action.content.slice(0, 120))}${action.content.length > 120 ? '...' : ''}`;
    }
    return base;
  }

  async confirmFileAction(action, container) {
    if (!this.fileAccess?.autoExecute && !window.confirm(`是否允许 AI 执行 ${action.action} - ${action.path}?`)) {
      return;
    }
    await this.executeFileAction(action, container);
  }

  async executeFileAction(action, container) {
    if (!window.electronAPI?.fileAction) {
      alert('当前环境未暴露文件操作能力。');
      return;
    }
    this.fileAccess = getFileAccessSettings();
    const fileSettings = this.fileAccess;
    if (!fileSettings.enabled) {
      alert('当前未启用 AI 文件操作，请前往设置开启。');
      return;
    }
    if (!this.isPathAllowed(action.path, fileSettings.directories)) {
      alert(`路径 ${action.path} 未被授权访问。`);
      return;
    }
    const statusEl = container.querySelector('.file-action-status');
    if (statusEl) {
      statusEl.textContent = '执行中...';
      statusEl.dataset.status = 'running';
    }
    try {
      let previousContent = '';
      if ((action.action === 'write' || action.action === 'edit' || action.action === 'save' || action.action === 'delete') && action.path) {
        try {
          const backup = await window.electronAPI.fileAction({ action: 'read', path: action.path });
          if (backup?.success) {
            previousContent = backup.content || '';
          }
        } catch (error) {
          console.warn('读取备份失败:', error);
        }
      }
      const result = await window.electronAPI.fileAction(action);
      if (!result?.success) {
        throw new Error(result?.message || '未知错误');
      }
      if (action.action !== 'read') {
        addFileActionLog({
          id: `${Date.now()}-${Math.random()}`,
          action: action.action,
          path: action.path,
          timestamp: new Date().toISOString(),
          previousContent: previousContent || null,
          newContent: action.content ?? null,
          status: 'done'
        });
      }
      if (statusEl) {
        statusEl.textContent = '✅ 操作成功';
        statusEl.dataset.status = 'success';
      }
      const resultBox = document.createElement('pre');
      resultBox.className = 'file-action-result';
      resultBox.textContent = this.formatFileActionSummary(action, result);
      container.appendChild(resultBox);
      if (this.fileAccess?.autoExecute) {
        this.sendToolResultToAI(this.formatFileActionSummary(action, result));
      } else {
        const sendBtn = document.createElement('button');
        sendBtn.textContent = '将结果发送给AI';
        sendBtn.className = 'btn btn-secondary';
        sendBtn.addEventListener('click', () => {
          this.populateInputWithFileResult(this.formatFileActionSummary(action, result));
        });
        container.querySelector('.file-action-actions')?.appendChild(sendBtn);
      }
    } catch (error) {
      console.error('文件操作失败:', error);
      if (statusEl) {
        statusEl.textContent = `❌ 失败：${error.message}`;
        statusEl.dataset.status = 'error';
      }
    }
  }

  formatFileActionSummary(action, result) {
    if (action.action === 'read') {
      if (result.entries) {
        return [
          `目录读取成功: ${action.path}`,
          '',
          result.entries.join('\n')
        ].join('\n');
      }
      return [
        `文件读取成功: ${action.path}`,
        '',
        result.content || ''
      ].join('\n');
    }
    if (action.action === 'write' || action.action === 'edit' || action.action === 'save') {
      return `文件已更新: ${action.path}`;
    }
    if (action.action === 'delete' || action.action === 'remove') {
      return `文件已删除: ${action.path}`;
    }
    return `操作完成: ${action.action} - ${action.path}`;
  }

  populateInputWithFileResult(summary) {
    const input = document.getElementById('chat-input');
    if (!input) return;
    input.value = `文件操作结果：\n${summary}\n\n请继续。`;
    input.focus();
  }

  isPathAllowed(targetPath, allowedDirs = []) {
    if (!targetPath) return false;
    const normalized = targetPath.replace(/\\/g, '/');
    if (!allowedDirs || allowedDirs.length === 0) return false;
    return allowedDirs.some(dir => {
      const normalizedDir = dir.replace(/\\/g, '/').replace(/^\.\//, '');
      if (!normalizedDir) return true;
      return normalized.startsWith(normalizedDir);
    });
  }

  sendToolResultToAI(summary) {
    this.pendingToolResults = this.pendingToolResults || [];
    this.pendingToolResults.push({
      role: 'system',
      content: `文件操作结果:\n${summary}`
    });
    if (this.fileAccess?.autoExecute) {
      this.continueWithToolResults();
    }
  }

  beginGeneration() {
    this.isGenerating = true;
    this.stopRequested = false;
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.classList.add('sending');
    }
    if (stopBtn) {
      stopBtn.style.display = 'inline-flex';
      stopBtn.disabled = false;
      stopBtn.textContent = '暂停';
    }
  }

  endGeneration() {
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    this.isGenerating = false;
    this.stopRequested = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.classList.remove('sending');
    }
    if (stopBtn) {
      stopBtn.style.display = 'none';
      stopBtn.disabled = false;
      stopBtn.textContent = '暂停';
    }
  }

  requestStopGeneration() {
    if (!this.isGenerating) return;
    this.stopRequested = true;
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
      stopBtn.disabled = true;
      stopBtn.textContent = '暂停中...';
    }
  }


  updateSessionStats() {
    const statsEl = document.getElementById('chat-session-stats');
    if (!statsEl) return;
    if (!this.currentSessionId) {
      statsEl.textContent = '0 条记录';
      this.updateContextSummary();
      return;
    }
    const session = this.sessionManager.getSession(this.currentSessionId);
    const count = session?.messages?.length || 0;
    statsEl.textContent = `${count} 条记录`;
    this.updateContextSummary();
  }

  updateContextSummary() {
    const summaryEl = document.getElementById('chat-context-summary');
    if (!summaryEl) return;
    if (!this.currentSessionId) {
      summaryEl.textContent = '等待输入';
      return;
    }
    const session = this.sessionManager.getSession(this.currentSessionId);
    if (!session) {
      summaryEl.textContent = '等待输入';
      return;
    }

    const count = session.messages?.length || 0;
    if (count === 0) {
      summaryEl.textContent = '空白上下文';
      return;
    }
    const dateValue = session.updatedAt || session.createdAt;
    const date = dateValue ? new Date(dateValue) : new Date();
    const readable = Number.isNaN(date.getTime()) ? '刚刚' : this.formatTime(date);
    summaryEl.textContent = `${count} 条消息 · ${readable}`;
  }

  clearCurrentSession() {
    if (!this.currentSessionId) {
      this.showToast('暂无可清空的会话', 'error');
      return;
    }

    if (!confirm('确定要清空当前会话的所有消息吗？')) return;

    this.sessionManager.clearSessionMessages(this.currentSessionId);
    this.loadSession(this.currentSessionId);
    this.showToast('当前会话已清空', 'success');
  }

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;

    if (message.startsWith('claude ')) {
      const cliPrompt = message
        .slice('claude '.length)
        .trim()
        .replace(/^"|"$/g, '');

      await this.handleClaudeCliMessage(message, cliPrompt, input);
      return;
    }
    
    if (!this.aiClient) {
      this.showMessage('assistant', '⚠️ 请先在"API配置"页面设置API密钥');
      return;
    }
    
    if (!this.currentSessionId) {
      this.showMessage('assistant', '⚠️ 会话未初始化');
      return;
    }
    
    // 获取当前设置
    const settings = this.getSettings();
    const attachments = this.getAttachments();
    
    // 清空输入框并禁用发送按钮
    input.value = '';
    this.updateModeIndicator();
    this.beginGeneration();
    
    // 显示用户消息（包含附件信息）
    let displayMessage = message;
    if (attachments.length > 0) {
      displayMessage += `\n\n📎 附件 (${attachments.length}):`;
      attachments.forEach(file => {
        displayMessage += `\n• ${file.name}`;
      });
    }
    this.showMessage('user', displayMessage);
    
    // 清空附件容器
    this.clearAttachments();
    
    // 添加到会话
    const userMessage = { 
      role: 'user', 
      content: message,
      attachments: attachments.map(f => ({ name: f.name, size: f.size, type: f.type }))
    };
    this.sessionManager.addMessage(this.currentSessionId, userMessage);
    this.updateSessionStats();
    
    // 自动生成标题（如果是第一条消息）
    const session = this.sessionManager.getSession(this.currentSessionId);
    if (session && session.messages.length === 1) {
      this.sessionManager.autoGenerateTitle(this.currentSessionId);
      this.renderSessionList();
    }
    
    try {
      // 根据设置决定使用的上下文长度
      const baseMessages = settings.enableMemory 
        ? session.messages.slice(-settings.contextLength * 2) 
        : session.messages.slice(-2);
      const toolMessages = this.pendingToolResults || [];
      this.pendingToolResults = [];
      const finalMessages = this.prependRoleInstruction([...baseMessages, ...toolMessages]);
      
      // 创建助手消息容器
      const assistantMsg = this.showMessage('assistant', '');
      this.activeAssistantMessage = assistantMsg;
      let fullResponse = '';
      
      // 根据设置使用流式或非流式响应
      if (settings.enableStream) {
        await this.aiClient.sendMessage(finalMessages, (chunk) => {
          if (this.stopRequested) return;
          fullResponse += chunk;
          const contentDiv = assistantMsg.querySelector('.message-content');
          if (contentDiv) {
            contentDiv.innerHTML = this.formatMessage(fullResponse);
          }
          // 自动滚动到底部
          const messagesContainer = document.getElementById('chat-messages');
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        });
        if (this.stopRequested) {
          throw new Error('响应已停止');
        }
      } else {
        // 非流式响应（如果AI客户端支持）
        fullResponse = await this.aiClient.sendMessageSync?.(finalMessages) || '';
        if (this.stopRequested) {
          throw new Error('响应已停止');
        }
        const contentDiv = assistantMsg.querySelector('.message-content');
        if (contentDiv) {
          contentDiv.innerHTML = this.formatMessage(fullResponse);
        }
      }
      
      // 添加到会话
      const assistantMessage = { role: 'assistant', content: fullResponse };
      this.sessionManager.addMessage(this.currentSessionId, assistantMessage);
      this.updateSessionStats();
      
      // 更新会话列表时间
      this.renderSessionList();
      
    } catch (error) {
      console.error('发送消息失败:', error);
      const contentDiv = assistantMsg.querySelector('.message-content');
      const stoppedByUser = error.message === '响应已停止';
      const errorText = stoppedByUser ? '⚠️ 输出已停止' : `❌ 错误: ${error.message}`;
      if (contentDiv) {
        contentDiv.innerHTML = this.formatMessage(errorText);
      }
      this.sessionManager.addMessage(this.currentSessionId, { role: 'assistant', content: errorText });
      this.updateSessionStats();
    } finally {
      this.endGeneration();
    }
  }

  async continueWithToolResults() {
    if (!this.pendingToolResults?.length) return;
    if (this.isGenerating) return;
    if (!this.aiClient) {
      this.showMessage('assistant', '⚠️ 请先在"API配置"页面设置API密钥');
      this.pendingToolResults = [];
      return;
    }
    if (!this.currentSessionId) {
      this.showMessage('assistant', '⚠️ 会话未初始化');
      this.pendingToolResults = [];
      return;
    }
    const session = this.sessionManager.getSession(this.currentSessionId);
    if (!session) {
      this.pendingToolResults = [];
      return;
    }
    const settings = this.getSettings();
    const baseMessages = settings.enableMemory 
      ? session.messages.slice(-settings.contextLength * 2) 
      : session.messages.slice(-2);
    const extra = this.pendingToolResults;
    this.pendingToolResults = [];
    const finalMessages = this.prependRoleInstruction([...baseMessages, ...extra]);
    try {
      this.beginGeneration();
      const assistantMsg = this.showMessage('assistant', '');
      let fullResponse = '';
      if (settings.enableStream) {
        await this.aiClient.sendMessage(finalMessages, (chunk) => {
          if (this.stopRequested) return;
          fullResponse += chunk;
          const contentDiv = assistantMsg.querySelector('.message-content');
          if (contentDiv) {
            contentDiv.innerHTML = this.formatMessage(fullResponse);
          }
          const messagesContainer = document.getElementById('chat-messages');
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        });
      } else {
        fullResponse = await this.aiClient.sendMessageSync?.(finalMessages) || '';
        const contentDiv = assistantMsg.querySelector('.message-content');
        if (contentDiv) {
          contentDiv.innerHTML = this.formatMessage(fullResponse);
        }
      }
      const assistantMessage = { role: 'assistant', content: fullResponse };
      this.sessionManager.addMessage(this.currentSessionId, assistantMessage);
      this.renderSessionList();
    } catch (error) {
      console.error('发送消息失败:', error);
      this.showMessage('assistant', `❌ 错误: ${error.message}`);
    } finally {
      this.endGeneration();
      if (this.pendingToolResults?.length) {
        this.continueWithToolResults();
      }
    }
  }

  /**
   * 通过本地 Claude CLI 处理消息
   */
  async handleClaudeCliMessage(rawMessage, cliPrompt, inputEl) {
    this.showMessage('user', rawMessage);

    if (inputEl) {
      inputEl.value = '';
      this.updateModeIndicator();
    }
    this.beginGeneration();

    if (!window.electronAPI || typeof window.electronAPI.runClaude !== 'function') {
      this.showMessage('assistant', '❌ 当前应用未启用 Claude CLI 集成');
      this.endGeneration();
      return;
    }

    const assistantMsg = this.showMessage('assistant', '⏳ 正在通过 Claude CLI 处理...');
    this.activeAssistantMessage = assistantMsg;

    try {
      const result = await window.electronAPI.runClaude(cliPrompt);
      if (this.stopRequested) {
        throw new Error('响应已停止');
      }
      const contentDiv = assistantMsg.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.innerHTML = this.formatMessage(result || '(Claude CLI 未返回内容)');
      }
    } catch (error) {
      console.error('Claude CLI 调用失败:', error);
      const contentDiv = assistantMsg.querySelector('.message-content');
      const stoppedByUser = error.message === '响应已停止';
      const text = stoppedByUser ? '⚠️ 输出已停止' : `❌ Claude CLI 调用失败: ${error.message}`;
      if (contentDiv) {
        contentDiv.innerHTML = this.formatMessage(text);
      }
    } finally {
      this.endGeneration();
    }
  }

  handleAttachment() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.txt,.doc,.docx';
    
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => this.addAttachment(file));
    };
    
    input.click();
  }

  handlePaste(event) {
    if (!event.clipboardData || !event.clipboardData.files?.length) return;
    const files = Array.from(event.clipboardData.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    event.preventDefault();
    imageFiles.forEach(file => this.addAttachment(file));
  }

  addAttachment(file) {
    const attachmentsContainer = document.getElementById('chat-attachments');
    if (!attachmentsContainer) return;
    
    // 检查文件大小（限制10MB）
    if (file.size > 10 * 1024 * 1024) {
      this.showToast('文件大小不能超过10MB', 'error');
      return;
    }
    
    const attachmentEl = document.createElement('div');
    attachmentEl.className = 'attachment-item';
    
    // 获取文件图标
    const icon = this.getFileIcon(file.type);
    
    attachmentEl.innerHTML = `
      <span class="attachment-icon">${icon}</span>
      <span class="attachment-name">${this.escapeHtml(file.name)}</span>
      <span class="attachment-size">${this.formatFileSize(file.size)}</span>
      <button class="attachment-remove" title="移除">✕</button>
    `;
    
    // 存储文件对象
    attachmentEl.dataset.fileName = file.name;
    attachmentEl._fileObject = file;
    
    // 绑定移除按钮
    const removeBtn = attachmentEl.querySelector('.attachment-remove');
    removeBtn?.addEventListener('click', () => {
      attachmentEl.remove();
      this.showToast('已移除附件', 'success');
    });
    
    attachmentsContainer.appendChild(attachmentEl);
    this.showToast('已添加附件', 'success');
  }

  getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('text')) return '📝';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📃';
    return '📎';
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getSettings() {
    const modelSelect = document.getElementById('model-select');
    if (modelSelect && modelSelect.value) {
      this.selectedModelValue = modelSelect.value;
    }
    return {
      model: this.selectedModelValue || 'gpt-4o',
      temperature: parseFloat(document.getElementById('temperature-slider')?.value || 0.7),
      contextLength: parseInt(document.getElementById('context-slider')?.value || 10),
      enableWeb: document.getElementById('enable-web')?.checked || false,
      enableMemory: document.getElementById('enable-memory')?.checked || false,
      enableStream: document.getElementById('enable-stream')?.checked || true,
    };
  }

  prependRoleInstruction(messages) {
    const systemPrompts = [];
    const basePrompt = this.getBaseSystemPrompt();
    if (basePrompt) {
      systemPrompts.push({ role: 'system', content: basePrompt });
    }
    const role = this.roleModes[this.currentRoleIndex];
    if (role?.prompt) {
      systemPrompts.push({ role: 'system', content: role.prompt });
    }
    return [...systemPrompts, ...messages];
  }

  getAttachments() {
    const attachmentsContainer = document.getElementById('chat-attachments');
    if (!attachmentsContainer) return [];
    
    const attachmentItems = attachmentsContainer.querySelectorAll('.attachment-item');
    return Array.from(attachmentItems).map(item => item._fileObject).filter(f => f);
  }

  clearAttachments() {
    const attachmentsContainer = document.getElementById('chat-attachments');
    if (attachmentsContainer) {
      attachmentsContainer.innerHTML = '';
    }
  }

  showMessage(role, content) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    messageEl.dataset.messageId = `msg-${Date.now()}-${Math.random()}`;
    
    if (role === 'user') {
      messageEl.innerHTML = `
        <div class="message-content">${this.escapeHtml(content)}</div>
        <div class="message-actions">
          <button class="message-action-btn copy-btn" title="复制">📋</button>
          <button class="message-action-btn delete-btn" title="删除">🗑️</button>
        </div>
      `;
    } else {
      messageEl.innerHTML = `
        <div class="message-header">
          <strong>AI助手</strong>
          <span class="message-time">${this.getCurrentTime()}</span>
        </div>
        <div class="message-content">${this.formatMessage(content)}</div>
        <div class="message-actions">
          <button class="message-action-btn copy-btn" title="复制">📋</button>
          <button class="message-action-btn delete-btn" title="删除">🗑️</button>
        </div>
      `;
    }
    
    messagesContainer.appendChild(messageEl);
    this.bindMessageActions(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    this.updateEmptyState(true);
    
    if (role === 'assistant') {
      setTimeout(() => this.attachFileActions(messageEl, content), 50);
    }

    return messageEl;
  }

  bindMessageActions(messageEl) {
    const copyBtn = messageEl.querySelector('.copy-btn');
    const deleteBtn = messageEl.querySelector('.delete-btn');
    
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const content = messageEl.querySelector('.message-content')?.textContent || '';
        this.copyToClipboard(content);
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.deleteMessage(messageEl);
      });
    }
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('已复制到剪贴板', 'success');
    }).catch(err => {
      console.error('复制失败:', err);
      this.showToast('复制失败', 'error');
    });
  }

  deleteMessage(messageEl) {
    if (confirm('确定要删除这条消息吗？')) {
      messageEl.remove();
      this.showToast('消息已删除', 'success');
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

  getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  formatMessage(content) {
    // 简单的markdown渲染：代码块
    return content
      .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  loadOrCreateSession() {
    // 获取当前会话ID
    let sessionId = this.sessionManager.getCurrentSessionId();
    
    // 如果没有当前会话，检查是否有旧的对话历史需要迁移
    if (!sessionId) {
      const oldHistory = this.migrateOldHistory();
      if (oldHistory && oldHistory.length > 0) {
        // 创建会话并添加旧历史
        const session = this.sessionManager.createSession('历史对话');
        oldHistory.forEach(msg => {
          this.sessionManager.addMessage(session.id, msg);
        });
        sessionId = session.id;
      } else {
        // 创建新会话
        const session = this.sessionManager.createSession();
        sessionId = session.id;
      }
    }
    
    this.loadSession(sessionId);
    this.renderSessionList();
  }

  migrateOldHistory() {
    try {
      const saved = localStorage.getItem('ai-conversation-history');
      if (saved) {
        const history = JSON.parse(saved);
        localStorage.removeItem('ai-conversation-history'); // 删除旧数据
        return history;
      }
    } catch (e) {
      console.error('迁移旧历史失败:', e);
    }
    return null;
  }

  loadSession(sessionId) {
    this.currentSessionId = sessionId;
    this.sessionManager.setCurrentSession(sessionId);
    
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;
    
    // 清空并重新渲染消息
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = this.getEmptyStateHtml();
      if (session.messages.length > 0) {
        session.messages.forEach(msg => {
          this.showMessage(msg.role, msg.content);
        });
        this.updateEmptyState(true);
      } else {
        this.updateEmptyState(false);
      }
    }
    
    // 更新会话列表高亮
    this.renderSessionList();
    this.updateSessionStats();
  }

  createNewSession() {
    const session = this.sessionManager.createSession();
    this.loadSession(session.id);
  }

  renderSessionList() {
    const sessionList = document.getElementById('session-list');
    if (!sessionList) return;
    
    const sessions = this.sessionManager.getSessions();
    const keyword = this.sessionKeyword || '';
    const normalizedKeyword = keyword.toLowerCase();
    const filtered = keyword
      ? sessions.filter(session => {
          const title = (session.title || '').toLowerCase();
          const snippet = this.getSessionSnippet(session).toLowerCase();
          return title.includes(normalizedKeyword) || snippet.includes(normalizedKeyword);
        })
      : sessions;
    
    if (filtered.length === 0) {
      sessionList.innerHTML = '<div class="session-empty">暂无会话</div>';
      return;
    }
    
    sessionList.innerHTML = filtered.map(session => {
      const isActive = session.id === this.currentSessionId;
      const timestamp = session.updatedAt || session.createdAt || Date.now();
      const date = new Date(timestamp);
      const timeStr = Number.isNaN(date.getTime()) ? '刚刚' : this.formatTime(date);
      const safeTitle = this.escapeHtml(session.title || '未命名会话');
      const snippet = this.escapeHtml(this.getSessionSnippet(session));
      const messageCount = session.messages?.length || 0;
      
      return `
        <div class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
          <div class="session-title-row">
            <span class="session-indicator ${isActive ? 'active' : ''}"></span>
            <span class="session-title">${safeTitle}</span>
          </div>
          <div class="session-subtitle">${snippet}</div>
          <div class="session-info">
            <span class="session-time">${timeStr}</span>
            <span class="session-count">${messageCount} 条</span>
          </div>
          <button class="session-delete" data-session-id="${session.id}" title="删除会话">🗑️</button>
        </div>
      `;
    }).join('');
    
    // 绑定会话点击事件
    sessionList.querySelectorAll('.session-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('session-delete')) {
          const sessionId = item.dataset.sessionId;
          this.loadSession(sessionId);
        }
      });
    });
    
    // 绑定删除按钮事件
    sessionList.querySelectorAll('.session-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = btn.dataset.sessionId;
        this.deleteSession(sessionId);
      });
    });
  }

  getSessionSnippet(session) {
    const lastMessage = session.messages?.[session.messages.length - 1]?.content || '尚无内容';
    const normalized = lastMessage
      .replace(/```[\s\S]*?```/g, '[代码]')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) return '尚无内容';
    return normalized.length > 40 ? `${normalized.slice(0, 40)}…` : normalized;
  }

  deleteSession(sessionId) {
    if (!confirm('确定要删除这个会话吗？')) return;
    
    this.sessionManager.deleteSession(sessionId);
    
    // 如果删除的是当前会话，加载另一个会话或创建新会话
    if (sessionId === this.currentSessionId) {
      const sessions = this.sessionManager.getSessions();
      if (sessions.length > 0) {
        this.loadSession(sessions[0].id);
      } else {
        this.createNewSession();
      }
    } else {
      this.renderSessionList();
    }
    
    this.updateSessionStats();
  }

  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    return date.toLocaleDateString('zh-CN');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateAIClient(aiClient) {
    this.aiClient = aiClient;
  }

  destroy() {
    window.removeEventListener('availableModelsUpdated', this.handleAvailableModelsUpdate);
    window.removeEventListener('fileAccessUpdated', this.handleFileAccessUpdate);
    // 清理事件监听器等
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    
    if (sendBtn) {
      sendBtn.replaceWith(sendBtn.cloneNode(true));
    }
    if (chatInput) {
      chatInput.replaceWith(chatInput.cloneNode(true));
    }
    this.contentWrapper?.classList.remove('chat-layout');
  }

  getDefaultModelOptions() {
    return [
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      { value: 'deepseek-chat', label: 'DeepSeek Chat' }
    ];
  }

  getAvailableModelsFromStorage() {
    try {
      const saved = localStorage.getItem('ai-toolbox-available-models');
      if (!saved) return [];
      const models = JSON.parse(saved);
      if (!Array.isArray(models)) return [];
      return models.map(value => ({ value, label: value }));
    } catch (error) {
      console.warn('解析可用模型失败:', error);
      return [];
    }
  }

  getModelOptionsHtml() {
    const options = this.availableModels.length ? this.availableModels : this.getDefaultModelOptions();
    if (!this.selectedModelValue && options.length) {
      this.selectedModelValue = options[0].value;
    }
    return options.map(opt => `
      <option value="${opt.value}" ${this.selectedModelValue === opt.value ? 'selected' : ''}>${this.escapeHtml(opt.label)}</option>
    `).join('');
  }

  updateModelSelect() {
    const modelSelect = document.getElementById('model-select');
    if (!modelSelect) return;
    const optionsHtml = this.getModelOptionsHtml();
    modelSelect.innerHTML = optionsHtml;
    if (this.selectedModelValue) {
      modelSelect.value = this.selectedModelValue;
    }
    this.updateModeIndicator();
  }

  getCurrentModelLabel() {
    const options = this.availableModels.length ? this.availableModels : this.getDefaultModelOptions();
    const match = options.find(opt => opt.value === this.selectedModelValue);
    return match?.label || this.selectedModelValue || '未配置';
  }
}
  
