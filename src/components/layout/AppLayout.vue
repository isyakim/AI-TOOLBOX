<script setup lang="ts">
import { onMounted } from 'vue'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import { useThemeStore, useConfigStore, useChatStore } from '@/stores'

const themeStore = useThemeStore()
const configStore = useConfigStore()
const chatStore = useChatStore()

onMounted(() => {
  themeStore.initTheme()
  configStore.loadFromStorage()
  chatStore.loadFromStorage()
})
</script>

<template>
  <div class="app-container">
    <div class="app-shell">
      <AppSidebar />
      <main class="main-content">
        <AppHeader />
        <div class="content-area">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
}

.app-shell {
  display: flex;
  width: 100%;
  height: 100%;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--space-xl);
  gap: var(--space-lg);
  margin-left: 200px;
  transition: margin-left 0.3s ease;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  border-radius: var(--radius-lg);
}
</style>
