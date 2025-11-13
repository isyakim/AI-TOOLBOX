
// 智能对话页面组件
import { SessionManager } from '../SessionManager.js';

export class ChatPage {
  constructor(container, aiClient, configManager) {
    this.container = container;
    this.aiClient = aiClient;
    this.configManager = configManager;
    this.sessionManager = new SessionManager();
    this.currentSessionId = null;
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.loadOrCreateSession();
    this.restoreSidebarState();
  }

  render() {
    this.container.innerHTML = `
      <div class="chat-container">
        <div class="chat-sidebar" id="chat-sidebar">
          <div class="session-header">
            <button class="btn btn-primary btn-new-session" id="new-session-btn">
              ➕ 新对话
            </button>
          </div>
          <div class="session-list" id="session-list">
            <!-- 会话列表将在这里动态生成 -->
          </div>
        </div>
        <div class="chat-main">
          <button class="chat-sidebar-toggle" id="chat-sidebar-toggle" title="显示/隐藏对话列表">
            <span class="toggle-icon">◀</span>
          </button>
          <div class="chat-header-bar">
            <div class="chat-title">智能对话</div>
            <button class="chat-settings-btn" id="chat-settings-btn" title="对话设置">⚙️</button>
          </div>
          
          <div class="chat-settings-panel" id="chat-settings-panel" style="display: none;">
            <div class="settings-section">
              <label class="setting-label">
                <span>模型选择</span>
                <select class="setting-select" id="model-select">
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="deepseek-chat">DeepSeek Chat</option>
                </select>
              </label>
            </div>
            
            <div class="settings-section">
              <label class="setting-label">
                <span>温度 (Temperature)</span>
                <div class="slider-container">
                  <input type="range" class="setting-slider" id="temperature-slider" min="0" max="2" step="0.1" value="0.7">
                  <span class="slider-value" id="temperature-value">0.7</span>
                </div>
              </label>
            </div>
            
            <div class="settings-section">
              <label class="setting-label">
                <span>上下文长度</span>
                <div class="slider-container">
                  <input type="range" class="setting-slider" id="context-slider" min="1" max="20" step="1" value="10">
                  <span class="slider-value" id="context-value">10</span>
                </div>
              </label>
            </div>
            
            <div class="settings-section">
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
          
          <div class="chat-messages" id="chat-messages">
            <div class="message assistant">
              <strong>AI助手</strong><br>
              你好！我是你的AI助手，可以帮你解答问题、编写代码、翻译文本等。
            </div>
          </div>
          
          <div class="chat-input-container">
            <div class="chat-attachments" id="chat-attachments"></div>
            <div class="chat-input-wrapper">
              <button class="attach-btn" id="attach-btn" title="添加附件">📎</button>
              <textarea class="chat-input" id="chat-input" placeholder="输入你的问题... (Shift+Enter换行)" rows="3"></textarea>
              <button class="send-btn" id="send-btn">发送</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    const newSessionBtn = document.getElementById('new-session-btn');
    const settingsBtn = document.getElementById('chat-settings-btn');
    const attachBtn = document.getElementById('attach-btn');
    const temperatureSlider = document.getElementById('temperature-slider');
    const contextSlider = document.getElementById('context-slider');
    const sidebarToggle = document.getElementById('chat-sidebar-toggle');

    sendBtn?.addEventListener('click', () => this.sendMessage());
    newSessionBtn?.addEventListener('click', () => this.createNewSession());
    
    // 对话列表折叠功能
    sidebarToggle?.addEventListener('click', () => {
      this.toggleSidebar();
    });
    
    // 设置面板切换
    settingsBtn?.addEventListener('click', () => {
      const panel = document.getElementById('chat-settings-panel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
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
  }

  toggleSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    const toggleBtn = document.getElementById('chat-sidebar-toggle');
    const toggleIcon = toggleBtn?.querySelector('.toggle-icon');
    
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      
      // 更新按钮图标
      if (toggleIcon) {
        toggleIcon.textContent = isCollapsed ? '▶' : '◀';
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
      
      if (sidebar) {
        sidebar.classList.add('collapsed');
      }
      if (toggleIcon) {
        toggleIcon.textContent = '▶';
      }
    }
  }

  async sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
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
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = '发送中...';
    }
    
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
    
    // 自动生成标题（如果是第一条消息）
    const session = this.sessionManager.getSession(this.currentSessionId);
    if (session && session.messages.length === 1) {
      this.sessionManager.autoGenerateTitle(this.currentSessionId);
      this.renderSessionList();
    }
    
    try {
      // 根据设置决定使用的上下文长度
      const contextMessages = settings.enableMemory 
        ? session.messages.slice(-settings.contextLength * 2) 
        : session.messages.slice(-2);
      
      // 创建助手消息容器
      const assistantMsg = this.showMessage('assistant', '');
      let fullResponse = '';
      
      // 根据设置使用流式或非流式响应
      if (settings.enableStream) {
        await this.aiClient.sendMessage(contextMessages, (chunk) => {
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
      } else {
        // 非流式响应（如果AI客户端支持）
        fullResponse = await this.aiClient.sendMessageSync?.(contextMessages) || '';
        const contentDiv = assistantMsg.querySelector('.message-content');
        if (contentDiv) {
          contentDiv.innerHTML = this.formatMessage(fullResponse);
        }
      }
      
      // 添加到会话
      const assistantMessage = { role: 'assistant', content: fullResponse };
      this.sessionManager.addMessage(this.currentSessionId, assistantMessage);
      
      // 更新会话列表时间
      this.renderSessionList();
      
    } catch (error) {
      console.error('发送消息失败:', error);
      this.showMessage('assistant', `❌ 错误: ${error.message}`);
    } finally {
      // 恢复发送按钮
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
      }
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
    return {
      model: document.getElementById('model-select')?.value || 'gpt-4',
      temperature: parseFloat(document.getElementById('temperature-slider')?.value || 0.7),
      contextLength: parseInt(document.getElementById('context-slider')?.value || 10),
      enableWeb: document.getElementById('enable-web')?.checked || false,
      enableMemory: document.getElementById('enable-memory')?.checked || false,
      enableStream: document.getElementById('enable-stream')?.checked || true,
    };
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
      messagesContainer.innerHTML = '';
      
      if (session.messages.length === 0) {
        // 显示欢迎消息
        const welcomeMsg = document.createElement('div');
        welcomeMsg.className = 'message assistant';
        welcomeMsg.innerHTML = '<strong>AI助手</strong><br>你好！我是你的AI助手，可以帮你解答问题、编写代码、翻译文本等。';
        messagesContainer.appendChild(welcomeMsg);
      } else {
        // 渲染历史消息
        session.messages.forEach(msg => {
          this.showMessage(msg.role, msg.content);
        });
      }
    }
    
    // 更新会话列表高亮
    this.renderSessionList();
  }

  createNewSession() {
    const session = this.sessionManager.createSession();
    this.loadSession(session.id);
  }

  renderSessionList() {
    const sessionList = document.getElementById('session-list');
    if (!sessionList) return;
    
    const sessions = this.sessionManager.getSessions();
    
    if (sessions.length === 0) {
      sessionList.innerHTML = '<div class="session-empty">暂无会话</div>';
      return;
    }
    
    sessionList.innerHTML = sessions.map(session => {
      const isActive = session.id === this.currentSessionId;
      const date = new Date(session.updatedAt);
      const timeStr = this.formatTime(date);
      
      return `
        <div class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
          <div class="session-title">${this.escapeHtml(session.title)}</div>
          <div class="session-info">
            <span class="session-time">${timeStr}</span>
            <span class="session-count">${session.messages.length}条消息</span>
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
    // 清理事件监听器等
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    
    if (sendBtn) {
      sendBtn.replaceWith(sendBtn.cloneNode(true));
    }
    if (chatInput) {
      chatInput.replaceWith(chatInput.cloneNode(true));
    }
  }
}
  
