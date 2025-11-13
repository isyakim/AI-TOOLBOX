// 会话管理器
export class SessionManager {
  constructor() {
    this.storageKey = 'ai-toolbox-sessions';
    this.currentSessionKey = 'ai-toolbox-current-session';
  }

  // 获取所有会话
  getSessions() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('加载会话失败:', e);
      return [];
    }
  }

  // 保存所有会话
  saveSessions(sessions) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(sessions));
    } catch (e) {
      console.error('保存会话失败:', e);
    }
  }

  // 创建新会话
  createSession(title = '新对话') {
    const session = {
      id: Date.now().toString(),
      title: title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const sessions = this.getSessions();
    sessions.unshift(session);
    this.saveSessions(sessions);
    this.setCurrentSession(session.id);
    
    return session;
  }

  // 获取会话
  getSession(sessionId) {
    const sessions = this.getSessions();
    return sessions.find(s => s.id === sessionId);
  }

  // 更新会话
  updateSession(sessionId, updates) {
    const sessions = this.getSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    
    if (index !== -1) {
      sessions[index] = {
        ...sessions[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveSessions(sessions);
      return sessions[index];
    }
    
    return null;
  }

  // 删除会话
  deleteSession(sessionId) {
    const sessions = this.getSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    this.saveSessions(filtered);
    
    // 如果删除的是当前会话，切换到第一个会话
    if (this.getCurrentSessionId() === sessionId) {
      if (filtered.length > 0) {
        this.setCurrentSession(filtered[0].id);
      } else {
        localStorage.removeItem(this.currentSessionKey);
      }
    }
  }

  // 获取当前会话ID
  getCurrentSessionId() {
    return localStorage.getItem(this.currentSessionKey);
  }

  // 设置当前会话
  setCurrentSession(sessionId) {
    localStorage.setItem(this.currentSessionKey, sessionId);
  }

  // 添加消息到会话
  addMessage(sessionId, message) {
    const session = this.getSession(sessionId);
    if (session) {
      session.messages.push(message);
      this.updateSession(sessionId, { messages: session.messages });
    }
  }

  // 自动生成会话标题（根据第一条消息）
  autoGenerateTitle(sessionId) {
    const session = this.getSession(sessionId);
    if (session && session.messages.length > 0) {
      const firstMessage = session.messages.find(m => m.role === 'user');
      if (firstMessage) {
        const title = firstMessage.content.substring(0, 30) + 
                     (firstMessage.content.length > 30 ? '...' : '');
        this.updateSession(sessionId, { title });
      }
    }
  }
}