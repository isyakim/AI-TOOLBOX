<script setup lang="ts">
import type { ChatSettings } from '@/features/chat/types'

defineProps<{ settings: ChatSettings }>()
const emit = defineEmits<{ update: [settings: Partial<ChatSettings>] }>()
</script>

<template>
  <section class="parameters-panel">
    <label>
      <span
        >Temperature <strong>{{ settings.temperature }}</strong></span
      >
      <input
        type="range"
        min="0"
        max="2"
        step="0.1"
        :value="settings.temperature"
        @input="emit('update', { temperature: Number(($event.target as HTMLInputElement).value) })"
      />
    </label>
    <label>
      <span
        >Context turns <strong>{{ settings.contextLength }}</strong></span
      >
      <input
        type="range"
        min="1"
        max="20"
        step="1"
        :value="settings.contextLength"
        @input="
          emit('update', { contextLength: Number(($event.target as HTMLInputElement).value) })
        "
      />
    </label>
    <label class="checkbox">
      <input
        type="checkbox"
        :checked="settings.enableMemory"
        @change="emit('update', { enableMemory: ($event.target as HTMLInputElement).checked })"
      />
      Keep conversation memory
    </label>
  </section>
</template>

<style scoped>
.parameters-panel {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto;
  gap: 18px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: #f8fafc;
}

label {
  display: grid;
  gap: 6px;
  color: var(--text-light);
  font-size: 0.76rem;
}

label span {
  display: flex;
  justify-content: space-between;
}

.checkbox {
  display: flex;
  align-items: center;
  flex-direction: row;
}

@media (max-width: 760px) {
  .parameters-panel {
    grid-template-columns: 1fr;
  }
}
</style>
