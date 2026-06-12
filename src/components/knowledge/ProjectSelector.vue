<script setup lang="ts">
defineProps<{
  projectPath: string
  extensions: string[]
  extensionOptions: string[]
  canIndex: boolean
  isIndexing: boolean
  isChecking: boolean
}>()

const emit = defineEmits<{
  choose: []
  toggleExtension: [extension: string]
  index: []
  healthCheck: []
}>()
</script>

<template>
  <section class="project-panel">
    <div class="path-row">
      <div>
        <span>Project directory</span>
        <strong>{{ projectPath || 'No directory selected' }}</strong>
      </div>
      <button @click="emit('choose')">Choose folder</button>
    </div>

    <div class="filters">
      <span>Indexed file types</span>
      <div>
        <button
          v-for="extension in extensionOptions"
          :key="extension"
          :class="{ active: extensions.includes(extension) }"
          @click="emit('toggleExtension', extension)"
        >
          {{ extension }}
        </button>
      </div>
    </div>

    <footer>
      <button class="primary" :disabled="!canIndex" @click="emit('index')">
        {{ isIndexing ? 'Indexing...' : 'Index project' }}
      </button>
      <button :disabled="isChecking || !projectPath" @click="emit('healthCheck')">
        {{ isChecking ? 'Checking...' : 'Project health check' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.project-panel {
  display: grid;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
}

.path-row,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.path-row > div,
.filters {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.path-row span,
.filters > span {
  color: var(--text-light);
  font-size: 0.76rem;
}

.path-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filters > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

button {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  cursor: pointer;
}

.filters button {
  min-height: 28px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.7rem;
}

button.active,
button.primary {
  border-color: var(--primary);
  background: var(--primary);
  color: #ffffff;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
