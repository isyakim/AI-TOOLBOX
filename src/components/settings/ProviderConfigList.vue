<script setup lang="ts">
import type { APIConfig } from '@/stores/config'

defineProps<{ configs: APIConfig[]; activeConfigId: string | null }>()
const emit = defineEmits<{ activate: [id: string]; delete: [config: APIConfig] }>()
</script>

<template>
  <section class="settings-section">
    <header>
      <p>SAVED</p>
      <h2>Provider configurations</h2>
    </header>

    <div v-if="!configs.length" class="empty">No provider configurations saved.</div>
    <div v-else class="config-list">
      <article
        v-for="config in configs"
        :key="config.id"
        :class="{ active: config.id === activeConfigId }"
      >
        <div>
          <strong>{{ config.providerName }}</strong>
          <span>{{ config.selectedModel }}</span>
          <small>{{ config.baseUrl }}</small>
        </div>
        <div class="actions">
          <button
            v-if="config.id !== activeConfigId"
            title="Activate configuration"
            @click="emit('activate', config.id)"
          >
            Activate
          </button>
          <span v-else class="active-label">Active</span>
          <button class="danger" title="Delete configuration" @click="emit('delete', config)">
            Delete
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.settings-section {
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
}

header p,
header h2 {
  margin: 0;
}

header p {
  color: var(--text-light);
  font-size: 0.68rem;
  font-weight: 700;
}

.empty {
  padding: 48px 10px;
  color: var(--text-light);
  text-align: center;
}

.config-list {
  display: grid;
  gap: 9px;
  margin-top: 18px;
}

article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

article.active {
  border-color: var(--primary);
  background: #f8fbff;
}

article > div:first-child {
  display: grid;
  min-width: 0;
  gap: 3px;
}

article span,
article small {
  overflow: hidden;
  color: var(--text-light);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

button,
.active-label {
  min-height: 32px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  font-size: 0.74rem;
  cursor: pointer;
}

.active-label {
  display: inline-flex;
  align-items: center;
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}

button.danger {
  color: var(--error);
}
</style>
