<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useThemeStore } from '@/stores'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()

interface NavItem {
  path: string
  name: string
  icon: string
  title: string
  featured?: boolean
}

const navItems: NavItem[] = [
  { path: '/chat', name: 'Chat', icon: '💬', title: '智能对话' },
  { path: '/tools', name: 'Tools', icon: '🛠️', title: 'AI工具集' },
  { path: '/ui-architect', name: 'UIArchitect', icon: '🏗️', title: 'UI架构师', featured: true },
  { path: '/plugins', name: 'Plugins', icon: '🧩', title: '插件中心' },
  { path: '/knowledge', name: 'Knowledge', icon: '📂', title: '知识库' },
  { path: '/theme', name: 'Theme', icon: '🎨', title: '主题引擎', featured: true },
  { path: '/settings', name: 'Settings', icon: '⚙️', title: '设置' },
  { path: '/about', name: 'About', icon: '📝', title: '关于' }
]

const isActive = (path: string) => route.path === path

function navigateTo(path: string) {
  router.push(path)
}
</script>

<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="logo">
      <h1>AI工具箱</h1>
    </div>

    <!-- Navigation -->
    <nav class="nav-section">
      <a
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path), featured: item.featured }"
        :title="item.title"
        @click="navigateTo(item.path)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-text">{{ item.title }}</span>
        <span v-if="item.featured && !isActive(item.path)" class="featured-badge">NEW</span>
      </a>
    </nav>

    <!-- Theme Selector -->
    <div class="theme-section">
      <span class="theme-label">🎨 主题配色</span>
      <select 
        class="theme-select"
        :value="themeStore.currentTheme"
        @change="(e) => themeStore.setTheme((e.target as HTMLSelectElement).value as any)"
      >
        <option 
          v-for="theme in themeStore.themes" 
          :key="theme.id" 
          :value="theme.id"
        >
          {{ theme.icon }} {{ theme.name }}
        </option>
      </select>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 200px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  background: rgba(255, 255, 255, 0.92);
  border-right: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  padding: var(--space-xl) var(--space-md);
  gap: var(--space-lg);
  z-index: 100;
  overflow-y: auto;
}

.logo {
  text-align: center;
}

.logo h1 {
  font-size: 1.35rem;
  color: var(--primary);
  font-weight: 700;
  margin: 0;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text);
  text-decoration: none;
  border-radius: var(--radius-md);
  gap: 12px;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.8);
}

.nav-item.active {
  background: var(--primary);
  color: #fff;
  box-shadow: 0 12px 20px rgba(0, 122, 255, 0.2);
}

.nav-icon {
  font-size: 1.25rem;
}

.nav-text {
  font-size: 0.95rem;
  font-weight: 500;
}

.theme-section {
  padding-top: var(--space-md);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.theme-label {
  font-size: 0.85rem;
  color: var(--text-light);
}

.theme-select {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--secondary);
  color: var(--text);
  font-size: 0.9rem;
  cursor: pointer;
}

.theme-select:focus {
  outline: none;
  border-color: var(--primary);
}

/* Featured nav item */
.nav-item.featured {
  position: relative;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08));
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.nav-item.featured:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15));
  border-color: rgba(99, 102, 241, 0.4);
}

.nav-item.featured.active {
  background: linear-gradient(135deg, #6366f1, #a855f7);
  border-color: transparent;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
}

.featured-badge {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 6px;
  background: linear-gradient(135deg, #f472b6, #ec4899);
  color: white;
  border-radius: 8px;
  margin-left: auto;
  animation: pulse-badge 2s ease-in-out infinite;
}

@keyframes pulse-badge {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(0.95); }
}
</style>
