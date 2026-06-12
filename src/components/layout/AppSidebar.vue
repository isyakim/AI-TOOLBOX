<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

interface NavItem {
  path: string
  title: string
  key: string
}

const navItems: NavItem[] = [
  { path: '/chat', title: 'Chat', key: 'CH' },
  { path: '/knowledge', title: 'Knowledge', key: 'KB' },
  { path: '/project-map', title: 'Project Map', key: 'MAP' },
  { path: '/plugins', title: 'Plugins', key: 'PL' },
  { path: '/settings', title: 'Settings', key: 'CFG' },
  { path: '/about', title: 'About', key: 'i' }
]

const isActive = (path: string) => route.path === path

function navigateTo(path: string) {
  router.push(path)
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">AI</div>
      <div>
        <h1>AI Toolbox</h1>
        <p>Developer Workbench</p>
      </div>
    </div>

    <nav class="nav-section" aria-label="Primary">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        @click="navigateTo(item.path)"
      >
        <span class="nav-key">{{ item.key }}</span>
        <span class="nav-text">{{ item.title }}</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <span class="footer-label">Local-first</span>
      <span class="footer-copy">RAG | Plugins | Diff approval</span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  width: 232px;
  padding: 16px 12px;
  background: #101827;
  border-right: 1px solid #1f2937;
  color: #d1d5db;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-mark {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid #334155;
  border-radius: 6px;
  background: #172033;
  color: #f9fafb;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.8rem;
  font-weight: 700;
}

.brand h1 {
  margin: 0;
  color: #f9fafb;
  font-size: 0.96rem;
  font-weight: 650;
}

.brand p {
  margin: 1px 0 0;
  color: #8b97aa;
  font-size: 0.74rem;
}

.nav-section {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  padding-top: 14px;
}

.nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #b8c1d1;
  cursor: pointer;
  text-align: left;
}

.nav-item:hover {
  background: #172033;
  color: #f9fafb;
}

.nav-item.active {
  background: #1d4ed8;
  color: #ffffff;
}

.nav-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 22px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.68rem;
  color: inherit;
  opacity: 0.9;
}

.nav-text {
  font-weight: 560;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 8px 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.footer-label {
  color: #f9fafb;
  font-size: 0.78rem;
  font-weight: 650;
}

.footer-copy {
  color: #8b97aa;
  font-size: 0.72rem;
  line-height: 1.35;
}
</style>
