<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useConfigStore } from '@/stores'

const route = useRoute()
const configStore = useConfigStore()

const pageTitle = computed(() => {
  return (route.meta?.title as string) || 'AI工具箱'
})

const statusClass = computed(() => {
  return configStore.isReady ? 'ready' : 'offline'
})

const statusText = computed(() => {
  return configStore.isReady ? '已就绪' : '等待配置'
})
</script>

<template>
  <header class="header">
    <h1 class="header-title">{{ pageTitle }}</h1>
    <div class="header-actions">
      <div class="api-status">
        <span class="status-dot" :class="statusClass"></span>
        <span class="status-text">{{ statusText }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  padding: var(--space-md) var(--space-lg);
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-lg);
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
  color: var(--text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.api-status {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.85rem;
  padding: 4px 12px;
  border-radius: var(--radius-lg);
  background: rgba(0, 0, 0, 0.04);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5f5;
}

.status-dot.ready {
  background: var(--success);
}

.status-dot.offline {
  background: var(--error);
}

.status-text {
  color: var(--text-light);
}
</style>
