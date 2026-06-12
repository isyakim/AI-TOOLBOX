<script setup lang="ts">
import type { WorkspaceProject } from '@/shared/types/ipc'

defineProps<{
  projects: WorkspaceProject[]
  activeProjectId: string | null
  projectPath: string
  extensions: string[]
  excludePatterns: string[]
  extensionOptions: string[]
  canIndex: boolean
  isIndexing: boolean
  isChecking: boolean
}>()

const emit = defineEmits<{
  selectProject: [projectId: string]
  choose: []
  toggleExtension: [extension: string]
  index: []
  rebuild: []
  updateExcludePatterns: [patterns: string[]]
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
      <div class="project-actions">
        <select
          v-if="projects.length"
          :value="activeProjectId || ''"
          aria-label="Active project"
          @change="emit('selectProject', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.name }}{{ project.branch ? ` (${project.branch})` : '' }}
          </option>
        </select>
        <button @click="emit('choose')">Choose folder</button>
      </div>
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

    <label class="exclude-field">
      <span>Additional exclusions</span>
      <textarea
        :value="excludePatterns.join('\n')"
        rows="3"
        placeholder="One gitignore-style pattern per line, for example coverage/"
        @change="
          emit(
            'updateExcludePatterns',
            ($event.target as HTMLTextAreaElement).value
              .split(/\r?\n/)
              .map((value) => value.trim())
              .filter(Boolean)
          )
        "
      />
    </label>

    <footer>
      <button class="primary" :disabled="!canIndex" @click="emit('index')">
        {{ isIndexing ? 'Indexing...' : 'Index project' }}
      </button>
      <button :disabled="!canIndex" @click="emit('rebuild')">Rebuild index</button>
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
.filters,
.exclude-field {
  display: grid;
  min-width: 0;
  gap: 7px;
}

.project-actions {
  display: flex;
  flex-direction: row;
  gap: 8px;
}

.project-actions select {
  max-width: 240px;
  min-height: 34px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
}

.path-row span,
.filters > span,
.exclude-field > span {
  color: var(--text-light);
  font-size: 0.76rem;
}

.exclude-field textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  background: #ffffff;
  color: var(--text);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.72rem;
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
