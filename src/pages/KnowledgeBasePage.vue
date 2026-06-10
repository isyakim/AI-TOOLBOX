<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RAGService } from '@/services/ragService'
import { useConfigStore } from '@/stores'
import type { ProjectHealthReport } from '@/env'

const configStore = useConfigStore()

const extensionOptions = [
  '.md',
  '.txt',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.json',
  '.css',
  '.html'
]
const selectedExtensions = ref<string[]>(['.md', '.ts', '.tsx', '.vue', '.json'])
const projectPath = ref(localStorage.getItem('ai-toolbox-project-path') || '')
const isInitializing = ref(false)
const isIndexing = ref(false)
const isChecking = ref(false)
const indexStatus = ref<Record<string, unknown>>({})
const healthReport = ref<ProjectHealthReport | null>(null)
const log = ref<string[]>([])

const progressPercent = computed(() => {
  const total = Number(indexStatus.value.totalFiles || 0)
  const indexed = Number(indexStatus.value.indexedFiles || 0)
  if (!total) return 0
  return Math.round((indexed / total) * 100)
})

function addLog(message: string) {
  log.value.unshift(`[${new Date().toLocaleTimeString()}] ${message}`)
}

async function initDB() {
  isInitializing.value = true
  try {
    const res = await RAGService.init()
    addLog(res.success ? 'Vector database initialized.' : `Init failed: ${res.message}`)
  } catch (error: any) {
    addLog(`Init error: ${error.message}`)
  } finally {
    isInitializing.value = false
  }
}

async function chooseDirectory() {
  const res = await window.api.selectDirectory()
  if (res.success && res.path) {
    projectPath.value = res.path
    localStorage.setItem('ai-toolbox-project-path', res.path)
    addLog(`Selected project: ${res.path}`)
  }
}

async function refreshStatus() {
  const res = await RAGService.getIndexStatus()
  indexStatus.value = res
}

async function indexProject() {
  if (!projectPath.value) {
    addLog('Select a project directory first.')
    return
  }

  isIndexing.value = true
  await initDB()

  const timer = window.setInterval(refreshStatus, 1000)
  try {
    const res = await RAGService.indexProject({
      rootPath: projectPath.value,
      extensions: selectedExtensions.value
    })
    indexStatus.value = res
    addLog(res.success ? String(res.message || 'Project indexed.') : `Index failed: ${res.message}`)
  } catch (error: any) {
    addLog(`Index error: ${error.message}`)
  } finally {
    window.clearInterval(timer)
    await refreshStatus()
    isIndexing.value = false
  }
}

async function runHealthCheck() {
  if (!projectPath.value) {
    addLog('Select a project directory first.')
    return
  }

  isChecking.value = true
  try {
    const res = await RAGService.runProjectHealthCheck(projectPath.value)
    if (res.success && res.report) {
      healthReport.value = res.report
      addLog(`Health check scanned ${res.report.scannedFiles} files.`)
    } else {
      addLog(`Health check failed: ${res.message}`)
    }
  } catch (error: any) {
    addLog(`Health check error: ${error.message}`)
  } finally {
    isChecking.value = false
  }
}

async function clearDB() {
  if (!confirm('Clear all indexed knowledge base data?')) return
  const res = await window.api.ragClear()
  if (res.success) {
    indexStatus.value = {}
    healthReport.value = null
    addLog('Knowledge base cleared.')
  }
}

function toggleExtension(extension: string) {
  if (selectedExtensions.value.includes(extension)) {
    selectedExtensions.value = selectedExtensions.value.filter((item) => item !== extension)
  } else {
    selectedExtensions.value.push(extension)
  }
}

onMounted(async () => {
  if (projectPath.value) {
    const workspace = await window.api.setWorkspace(projectPath.value)
    if (!workspace.success) {
      projectPath.value = ''
      localStorage.removeItem('ai-toolbox-project-path')
      addLog(`Stored workspace is unavailable: ${workspace.message}`)
    }
  }

  if (configStore.isReady) {
    await initDB()
    await refreshStatus()
  } else {
    addLog('Configure an API key before indexing. Embeddings require an active provider.')
  }
})
</script>

<template>
  <div class="knowledge-page">
    <header class="page-header">
      <div>
        <h2>Project Knowledge Base</h2>
        <p>Index a local project so chat can answer with file-level source snippets.</p>
      </div>
      <div class="header-actions">
        <button class="btn secondary" @click="clearDB">Clear</button>
        <button class="btn secondary" :disabled="isInitializing" @click="initDB">
          {{ isInitializing ? 'Initializing...' : 'Init DB' }}
        </button>
      </div>
    </header>

    <section class="project-card">
      <div class="path-row">
        <div class="path-copy">
          <span class="label">Project directory</span>
          <strong>{{ projectPath || 'No directory selected' }}</strong>
        </div>
        <button class="btn secondary" @click="chooseDirectory">Choose Folder</button>
      </div>

      <div class="filter-row">
        <span class="label">File types</span>
        <div class="extension-list">
          <button
            v-for="extension in extensionOptions"
            :key="extension"
            class="extension-chip"
            :class="{ active: selectedExtensions.includes(extension) }"
            @click="toggleExtension(extension)"
          >
            {{ extension }}
          </button>
        </div>
      </div>

      <div class="action-row">
        <button
          class="btn primary"
          :disabled="!configStore.isReady || isIndexing || !projectPath"
          @click="indexProject"
        >
          {{ isIndexing ? 'Indexing...' : 'Index Project' }}
        </button>
        <button
          class="btn secondary"
          :disabled="isChecking || !projectPath"
          @click="runHealthCheck"
        >
          {{ isChecking ? 'Checking...' : 'Project Health Check' }}
        </button>
      </div>
    </section>

    <div class="main-grid">
      <section class="panel">
        <h3>Index Status</h3>
        <div class="status-grid">
          <div>
            <span>Status</span>
            <strong>{{ indexStatus.status || 'idle' }}</strong>
          </div>
          <div>
            <span>Files</span>
            <strong>{{ indexStatus.indexedFiles || 0 }} / {{ indexStatus.totalFiles || 0 }}</strong>
          </div>
          <div>
            <span>Chunks</span>
            <strong>{{ indexStatus.totalChunks || 0 }}</strong>
          </div>
          <div>
            <span>Current</span>
            <strong>{{ indexStatus.currentFile || '-' }}</strong>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-bar" :style="{ width: `${progressPercent}%` }"></div>
        </div>
        <p class="status-message">{{ indexStatus.message || 'No active index job.' }}</p>
      </section>

      <section class="panel">
        <h3>Project Health</h3>
        <div v-if="!healthReport" class="empty">
          Run a health check to inspect README quality, dependencies, tests, and structure.
        </div>
        <div v-else class="health-list">
          <div
            v-for="finding in healthReport.findings"
            :key="finding.title"
            class="health-item"
            :class="finding.status"
          >
            <div>
              <strong>{{ finding.title }}</strong>
              <p>{{ finding.detail }}</p>
            </div>
            <span>{{ finding.status }}</span>
          </div>
        </div>
      </section>
    </div>

    <section class="panel log-panel">
      <h3>Activity Log</h3>
      <div class="log-container">
        <div v-for="(message, index) in log" :key="index" class="log-entry">{{ message }}</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.knowledge-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: var(--space-xl);
  overflow-y: auto;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.page-header,
.path-row,
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header h2,
.panel h3 {
  margin: 0;
}

.page-header p,
.label,
.empty,
.status-message {
  color: var(--text-light);
}

.header-actions,
.extension-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.project-card,
.panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  padding: 20px;
}

.project-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.path-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.path-copy strong {
  word-break: break-all;
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.extension-chip {
  border: 1px solid var(--border);
  background: var(--secondary);
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
}

.extension-chip.active {
  color: #fff;
  border-color: var(--primary);
  background: var(--primary);
}

.main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.status-grid div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--secondary);
  border-radius: var(--radius-md);
  min-width: 0;
}

.status-grid strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-track {
  height: 8px;
  margin-top: 16px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--secondary);
}

.progress-bar {
  height: 100%;
  background: var(--primary);
  transition: width 0.2s ease;
}

.health-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}

.health-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.health-item p {
  margin: 4px 0 0;
  color: var(--text-light);
}

.health-item span {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.health-item.good span {
  color: #10b981;
}
.health-item.watch span {
  color: #f59e0b;
}
.health-item.needs-work span {
  color: #ef4444;
}

.log-panel {
  min-height: 160px;
}

.log-container {
  height: 150px;
  margin-top: 12px;
  overflow-y: auto;
  padding: 12px;
  border-radius: var(--radius-md);
  background: #111827;
  color: #d1d5db;
  font-family: Consolas, monospace;
  font-size: 0.8rem;
}

.log-entry + .log-entry {
  margin-top: 4px;
}

.btn {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 10px 16px;
  font-weight: 700;
  cursor: pointer;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.btn.primary {
  color: #fff;
  border-color: var(--primary);
  background: var(--primary);
}

.btn.secondary {
  color: var(--text);
  background: var(--secondary);
}

@media (max-width: 900px) {
  .main-grid,
  .status-grid {
    grid-template-columns: 1fr;
  }

  .page-header,
  .path-row,
  .action-row {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
