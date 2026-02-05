<script setup lang="ts">
const version = '2.0.0'
const techStack = [
  { name: 'Electron 28.3.3', desc: '基于 Chromium 和 Node.js 的跨平台桌面框架' },
  { name: 'Vue 3', desc: '高性能、渐进式 JavaScript 框架，采用 Composition API' },
  { name: 'Vite', desc: '下一代前端构建工具，提供极速的热更新体验' },
  { name: 'TypeScript', desc: '强类型保证，提升代码健壮性与可维护性' },
  { name: 'Pinia', desc: '直观、类型安全的 Vue 状态管理库' }
]

const features = [
  { icon: '💬', title: '智能对话', desc: '支持多角色切换，具备流式响应能力与上下文记忆。' },
  { icon: '🛠️', title: 'AI 工具集', desc: '内置 6 种高频 AI 场景工具，高效解决具体任务。' },
  { icon: '📁', title: '文件操作', desc: 'AI 具备受控的本地文件读写能力，真正赋能开发流程。' },
  { icon: '⚙️', title: '端点配置', desc: '支持 OpenAI 兼容格式，可自由接入 DeepSeek、Anthropic 等主流服务商。' }
]
</script>

<template>
  <div class="about-page">
    <div class="about-container">
      <header class="about-hero">
        <div class="logo">🤖</div>
        <h1>AI Toolbox</h1>
        <p class="tagline">专业级 AI 效率助手</p>
        <span class="version-badge">v{{ version }}</span>
      </header>

      <div class="about-grid">
        <!-- Main Content -->
        <main class="main-content">
          <section class="section">
            <h3>使命与愿景</h3>
            <p>
              AI Toolbox 旨在为开发者提供一个极致简洁、安全且功能强大的本地 AI 工作环境。
              通过深度整合本地文件系统与流式 AI 能力，我们致力于将大模型的生产力真正带入到日常的工作流中。
            </p>
          </section>

          <section class="section">
            <h3>核心优势</h3>
            <div class="features-grid">
              <div v-for="f in features" :key="f.title" class="feature-item">
                <span class="feature-icon">{{ f.icon }}</span>
                <div class="feature-info">
                  <h4>{{ f.title }}</h4>
                  <p>{{ f.desc }}</p>
                </div>
              </div>
            </div>
          </section>
        </main>

        <!-- Sidebar Info -->
        <aside class="side-info">
          <section class="info-block">
            <h3>技术路线</h3>
            <ul class="tech-list">
              <li v-for="tech in techStack" :key="tech.name">
                <span class="tech-name">{{ tech.name }}</span>
                <span class="tech-desc">{{ tech.desc }}</span>
              </li>
            </ul>
          </section>

          <section class="info-block privacy">
            <h3>🔐 隐私与安全</h3>
            <p>
              我们深知数据隐私的重要性。AI Toolbox 的所有配置文件、对话记录和 API 密钥均加密存储在您的本地环境中。
              除了与您配置的 AI 提供商进行必要的 API 通信外，应用本身不会收集或上传任何个人数据。
            </p>
          </section>
        </aside>
      </div>

      <footer class="about-footer">
        <p>© 2026 AI Toolbox Team. Build with ❤️ for Developers.</p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.about-page {
  height: 100%;
  overflow-y: auto;
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
}

.about-container {
  max-width: 1000px;
  margin: 0 auto;
}

.about-hero {
  text-align: center;
  margin-bottom: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.logo {
  font-size: 4rem;
  margin-bottom: 8px;
}

.about-hero h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, var(--primary), #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tagline {
  font-size: 1.1rem;
  color: var(--text-light);
  margin: 0;
}

.version-badge {
  display: inline-block;
  padding: 4px 12px;
  background: var(--secondary);
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--primary);
  margin-top: 12px;
}

.about-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 40px;
}

@media (max-width: 900px) {
  .about-grid {
    grid-template-columns: 1fr;
  }
}

.section {
  margin-bottom: 40px;
}

.section h3 {
  font-size: 1.25rem;
  margin-bottom: 20px;
  color: var(--text);
  border-bottom: 2px solid var(--secondary);
  padding-bottom: 8px;
  display: inline-block;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 600px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
}

.feature-item {
  display: flex;
  gap: 16px;
  background: var(--secondary);
  padding: 20px;
  border-radius: var(--radius-md);
  transition: transform 0.2s;
}

.feature-item:hover {
  transform: translateY(-4px);
}

.feature-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.feature-info h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
}

.feature-info p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-light);
  line-height: 1.5;
}

.info-block {
  margin-bottom: 32px;
}

.info-block h3 {
  font-size: 1.1rem;
  margin-bottom: 16px;
}

.tech-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tech-list li {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tech-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.tech-desc {
  font-size: 0.8rem;
  color: var(--text-light);
}

.privacy {
  padding: 20px;
  background: rgba(34, 197, 94, 0.05);
  border: 1px dashed rgba(34, 197, 94, 0.3);
  border-radius: var(--radius-md);
}

.privacy p {
  font-size: 0.85rem;
  line-height: 1.6;
}

.about-footer {
  margin-top: 60px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
  text-align: center;
  color: var(--text-light);
  font-size: 0.9rem;
}
</style>
