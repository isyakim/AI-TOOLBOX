import { computed, onBeforeUnmount, ref } from 'vue'
import { RAGService } from '@/services/ragService'
import type { ProjectHealthReport, RAGIndexStatus } from '@/shared/types/ipc'
import { useConfigStore } from '@/stores/config'

const CONFIG_KEY = 'knowledge-workspace'
export const KNOWLEDGE_EXTENSIONS = [
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
const DEFAULT_EXTENSIONS = ['.md', '.ts', '.tsx', '.vue', '.json']

const emptyStatus = (): RAGIndexStatus => ({
  success: true,
  status: 'idle',
  rootPath: '',
  totalFiles: 0,
  indexedFiles: 0,
  totalChunks: 0,
  currentFile: '',
  startedAt: 0,
  completedAt: 0,
  message: ''
})

export function useKnowledgeWorkspace() {
  const configStore = useConfigStore()
  const projectPath = ref('')
  const selectedExtensions = ref([...DEFAULT_EXTENSIONS])
  const isInitializing = ref(false)
  const isIndexing = ref(false)
  const isChecking = ref(false)
  const indexStatus = ref<RAGIndexStatus>(emptyStatus())
  const healthReport = ref<ProjectHealthReport | null>(null)
  const activityLog = ref<string[]>([])
  let pollTimer: number | null = null

  const progressPercent = computed(() => {
    if (!indexStatus.value.totalFiles) return 0
    return Math.round((indexStatus.value.indexedFiles / indexStatus.value.totalFiles) * 100)
  })
  const canIndex = computed(() =>
    Boolean(projectPath.value && configStore.isReady && !isIndexing.value)
  )

  function addLog(message: string) {
    activityLog.value.unshift(`[${new Date().toLocaleTimeString()}] ${message}`)
  }

  async function initialize() {
    if (!configStore.activeConfig) {
      addLog('Configure an active provider before initializing embeddings.')
      return false
    }
    isInitializing.value = true
    try {
      const result = await RAGService.init(configStore.activeConfig)
      addLog(
        result.success ? 'Vector database initialized.' : `Initialization failed: ${result.message}`
      )
      return result.success
    } catch (error: unknown) {
      addLog(`Initialization failed: ${errorMessage(error)}`)
      return false
    } finally {
      isInitializing.value = false
    }
  }

  async function chooseDirectory() {
    const result = await window.api.selectDirectory()
    if (!result.success || !result.path) return
    projectPath.value = result.path
    healthReport.value = null
    await persistPreferences()
    addLog(`Selected project: ${result.path}`)
  }

  async function refreshStatus() {
    try {
      indexStatus.value = await RAGService.getIndexStatus()
    } catch (error: unknown) {
      addLog(`Status refresh failed: ${errorMessage(error)}`)
    }
  }

  async function indexProject() {
    if (!projectPath.value || !configStore.activeConfig) {
      addLog('Select a project and configure an active provider first.')
      return
    }
    isIndexing.value = true
    if (!(await initialize())) {
      isIndexing.value = false
      return
    }

    startPolling()
    try {
      indexStatus.value = await RAGService.indexProject(
        { rootPath: projectPath.value, extensions: selectedExtensions.value },
        configStore.activeConfig
      )
      addLog(
        indexStatus.value.success
          ? indexStatus.value.message || 'Project indexed.'
          : `Index failed: ${indexStatus.value.message}`
      )
      await persistPreferences()
    } catch (error: unknown) {
      addLog(`Index failed: ${errorMessage(error)}`)
    } finally {
      stopPolling()
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
      const result = await RAGService.runProjectHealthCheck(projectPath.value)
      if (result.success && result.report) {
        healthReport.value = result.report
        addLog(`Health check scanned ${result.report.scannedFiles} files.`)
      } else addLog(`Health check failed: ${result.message}`)
    } catch (error: unknown) {
      addLog(`Health check failed: ${errorMessage(error)}`)
    } finally {
      isChecking.value = false
    }
  }

  async function clearKnowledge() {
    stopPolling()
    const result = await window.api.ragClear()
    if (result.success) {
      indexStatus.value = emptyStatus()
      healthReport.value = null
      addLog('Knowledge base cleared.')
    } else addLog('Knowledge base could not be cleared.')
  }

  async function toggleExtension(extension: string) {
    selectedExtensions.value = selectedExtensions.value.includes(extension)
      ? selectedExtensions.value.filter((item) => item !== extension)
      : [...selectedExtensions.value, extension]
    await persistPreferences()
  }

  async function restore() {
    const stored = await window.api.getConfig(CONFIG_KEY)
    if (isKnowledgePreferences(stored)) {
      projectPath.value = stored.projectPath
      selectedExtensions.value = stored.extensions.filter((extension) =>
        KNOWLEDGE_EXTENSIONS.includes(extension)
      )
      if (!selectedExtensions.value.length) selectedExtensions.value = [...DEFAULT_EXTENSIONS]
    }

    if (projectPath.value) {
      const workspace = await window.api.setWorkspace(projectPath.value)
      if (!workspace.success) {
        addLog(`Stored workspace is unavailable: ${workspace.message}`)
        projectPath.value = ''
        await persistPreferences()
      }
    }

    if (configStore.isReady) {
      await initialize()
      await refreshStatus()
    } else addLog('Configure an API key before indexing project knowledge.')
  }

  async function persistPreferences() {
    await window.api.setConfig(CONFIG_KEY, {
      projectPath: projectPath.value,
      extensions: selectedExtensions.value
    })
  }

  function startPolling() {
    stopPolling()
    pollTimer = window.setInterval(() => void refreshStatus(), 1000)
  }

  function stopPolling() {
    if (pollTimer !== null) window.clearInterval(pollTimer)
    pollTimer = null
  }

  onBeforeUnmount(stopPolling)

  return {
    projectPath,
    selectedExtensions,
    isInitializing,
    isIndexing,
    isChecking,
    indexStatus,
    healthReport,
    activityLog,
    progressPercent,
    canIndex,
    initialize,
    chooseDirectory,
    refreshStatus,
    indexProject,
    runHealthCheck,
    clearKnowledge,
    toggleExtension,
    restore,
    startPolling,
    stopPolling
  }
}

function isKnowledgePreferences(
  value: unknown
): value is { projectPath: string; extensions: string[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'projectPath' in value &&
    typeof value.projectPath === 'string' &&
    'extensions' in value &&
    Array.isArray(value.extensions) &&
    value.extensions.every((extension) => typeof extension === 'string')
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}
