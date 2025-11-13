// 关于页面组件
export class AboutPage {
  constructor(container) {
    this.container = container;
    this.init();
  }

  init() {
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="about-page">
        <div class="about-card">
          <div class="about-header">
            <div class="about-icon">🤖</div>
            <h1 class="about-title">AI工具箱</h1>
            <p class="about-version">版本 1.0.0</p>
          </div>
          
          <div class="about-content">
            <div class="about-section">
              <h2>关于</h2>
              <p>AI工具箱是一个功能强大的桌面应用程序，集成了多种AI服务，帮助您更高效地完成各种任务。</p>
            </div>
            
            <div class="about-section">
              <h2>主要功能</h2>
              <ul class="about-features">
                <li>💬 <strong>智能对话</strong> - 与AI助手进行自然语言对话</li>
                <li>🛠️ <strong>AI工具集</strong> - 图像生成、代码助手、翻译、写作等</li>
                <li>⚙️ <strong>API配置</strong> - 灵活配置多种AI服务提供商</li>
                <li>🔑 <strong>密钥管理</strong> - 安全地管理多个API密钥</li>
              </ul>
            </div>
            
            <div class="about-section">
              <h2>技术栈</h2>
              <ul class="about-tech">
                <li>Electron - 跨平台桌面应用框架</li>
                <li>原生JavaScript - 轻量级，无依赖</li>
                <li>LocalStorage - 本地数据存储</li>
              </ul>
            </div>
            
            <div class="about-section">
              <h2>隐私与安全</h2>
              <p>您的所有数据（包括API密钥和对话记录）都存储在本地，不会上传到任何服务器。我们重视您的隐私和安全。</p>
            </div>
            
            <div class="about-footer">
              <p>© 2025 AI工具箱. 保留所有权利.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  destroy() {
    // 清理资源
  }
}

