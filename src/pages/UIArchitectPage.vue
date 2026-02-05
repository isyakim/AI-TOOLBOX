<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConfigStore } from '@/stores'
import UIArchitectTool from '@/components/tools/UIArchitectTool.vue'

const configStore = useConfigStore()
const showWelcome = ref(true)

onMounted(() => {
  // 首次显示欢迎动画
  setTimeout(() => {
    showWelcome.value = false
  }, 2000)
})
</script>

<template>
  <div class="ui-architect-page">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="gradient-orb orb-3"></div>
      <div class="grid-pattern"></div>
    </div>

    <!-- 欢迎动画 -->
    <Transition name="welcome">
      <div v-if="showWelcome" class="welcome-overlay">
        <div class="welcome-content">
          <div class="welcome-icon">🎨</div>
          <h1 class="welcome-title">AI UI Architect</h1>
          <p class="welcome-subtitle">从创意到代码，瞬间实现</p>
          <div class="loading-bar">
            <div class="loading-progress"></div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo-badge">
            <span class="logo-icon">🎨</span>
          </div>
          <div class="header-text">
            <h1>AI UI Architect</h1>
            <p>Vision 驱动的智能代码生成</p>
          </div>
        </div>
        <div class="header-right">
          <div class="status-badge" :class="{ ready: configStore.isReady }">
            <span class="status-dot"></span>
            {{ configStore.isReady ? 'AI 已就绪' : 'AI 未配置' }}
          </div>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="page-main">
      <UIArchitectTool :is-ready="configStore.isReady" />
    </main>

    <!-- 功能亮点 -->
    <footer class="page-footer">
      <div class="features-bar">
        <div class="feature-chip">
          <span class="chip-icon">👁</span>
          <span>Vision AI 识别</span>
        </div>
        <div class="feature-chip">
          <span class="chip-icon">⚡</span>
          <span>多技术栈</span>
        </div>
        <div class="feature-chip">
          <span class="chip-icon">🔥</span>
          <span>实时预览</span>
        </div>
        <div class="feature-chip">
          <span class="chip-icon">💾</span>
          <span>一键脚手架</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.ui-architect-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
}

/* ===== 背景装饰 ===== */
.bg-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: float 20s ease-in-out infinite;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  top: -100px;
  right: -100px;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #06b6d4, #22d3ee);
  bottom: -50px;
  left: -50px;
  animation-delay: -7s;
}

.orb-3 {
  width: 250px;
  height: 250px;
  background: linear-gradient(135deg, #f472b6, #ec4899);
  top: 50%;
  right: 20%;
  animation-delay: -14s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}

/* ===== 欢迎动画 ===== */
.welcome-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f172a, #1e293b);
}

.welcome-content {
  text-align: center;
  color: white;
}

.welcome-icon {
  font-size: 5rem;
  margin-bottom: 20px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.welcome-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 10px;
  background: linear-gradient(135deg, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-subtitle {
  font-size: 1.1rem;
  color: #94a3b8;
  margin: 0 0 32px;
}

.loading-bar {
  width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin: 0 auto;
}

.loading-progress {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #6366f1, #a855f7, #6366f1);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.welcome-enter-active,
.welcome-leave-active {
  transition: all 0.6s ease;
}

.welcome-leave-to {
  opacity: 0;
  transform: scale(1.1);
}

/* ===== 页面头部 ===== */
.page-header {
  position: relative;
  z-index: 10;
  padding: 20px 32px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-badge {
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
}

.logo-icon {
  font-size: 1.8rem;
}

.header-text h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
}

.header-text p {
  margin: 4px 0 0;
  font-size: 0.9rem;
  color: var(--text-light);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 30px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-light);
  box-shadow: var(--shadow-card);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--error);
}

.status-badge.ready .status-dot {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}

.status-badge.ready {
  color: var(--success);
  border-color: var(--success);
}

/* ===== 主内容区 ===== */
.page-main {
  flex: 1;
  position: relative;
  z-index: 10;
  padding: 0 32px;
  min-height: 0;
}

/* ===== 页脚 ===== */
.page-footer {
  position: relative;
  z-index: 10;
  padding: 16px 32px;
}

.features-bar {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.feature-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text);
  backdrop-filter: blur(8px);
  transition: all 0.2s;
}

.feature-chip:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.15);
}

.chip-icon {
  font-size: 1rem;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .page-header,
  .page-main,
  .page-footer {
    padding-left: 16px;
    padding-right: 16px;
  }
  
  .header-text h1 {
    font-size: 1.25rem;
  }
  
  .feature-chip {
    font-size: 0.75rem;
    padding: 6px 12px;
  }
}
</style>
