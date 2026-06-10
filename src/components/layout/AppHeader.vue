<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useConfigStore } from '@/stores'

const route = useRoute()
const configStore = useConfigStore()

const pageTitle = computed(() => (route.meta?.title as string) || 'AI Toolbox')
const statusText = computed(() => (configStore.isReady ? 'API connected' : 'Configure API'))
</script>

<template>
  <header class="header">
    <div>
      <h1 class="header-title">{{ pageTitle }}</h1>
    </div>
    <div class="api-status" :class="{ ready: configStore.isReady }">
      <span class="status-dot"></span>
      <span>{{ statusText }}</span>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 18px;
  background: #ffffff;
  border-bottom: 1px solid var(--border);
}

.header-title {
  margin: 0;
  color: var(--text);
  font-size: 0.98rem;
  font-weight: 650;
}

.api-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #f8fafc;
  color: var(--text-light);
  font-size: 0.78rem;
  font-weight: 560;
}

.api-status.ready {
  color: #166534;
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--error);
}

.api-status.ready .status-dot {
  background: var(--success);
}
</style>
