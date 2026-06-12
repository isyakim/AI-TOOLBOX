<script setup lang="ts">
import { onMounted } from 'vue'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'
import { useConfigStore, useChatStore, useWorkspaceStore } from '@/stores'

const configStore = useConfigStore()
const chatStore = useChatStore()
const workspaceStore = useWorkspaceStore()

onMounted(async () => {
  await configStore.loadFromStorage()
  await workspaceStore.load()
  await chatStore.loadFromStorage()
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
  background: #f3f4f6;
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
  padding: 0;
  margin-left: 232px;
}

.content-area {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 16px;
}
</style>
