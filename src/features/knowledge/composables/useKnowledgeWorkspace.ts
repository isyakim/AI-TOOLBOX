import { computed, onBeforeUnmount, ref } from 'vue'
import { RAGService } from '@/services/ragService'
import type { ProjectHealthReport, RAGIndexStatus } from '@/shared/types/ipc'
import { useConfigStore } from '@/stores/config'
import { useWorkspaceStore } from '@/stores/workspace'

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
  message: '',
  failedFiles: [],
  paused: false,
  cancelRequested: false
})

export function useKnowledgeWorkspace() {
  const configStore = useConfigStore()
  const workspaceStore = useWorkspaceStore()
  const projectPath = ref('')
  const selectedExtensions = ref([...DEFAULT_EXTENSIONS])
  const isInitializing = ref(false)
  const isIndexing = ref(false)
  const isChecking = ref(false)
  const indexStatus = ref<RAGIndexStatus>(emptyStatus())
  const healthReport = ref<ProjectHealthReport | null>(null)
  const excludePatterns = ref<string[]>([])
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
    const project = await workspaceStore.register(result.path)
    projectPath.value = project.rootPath
    healthReport.value = null
    await persistPreferences()
    addLog(`Selected project: ${result.path}`)
  }

  async function refreshStatus() {
    try {
      indexStatus.value = await RAGService.getIndexStatus(
        workspaceStore.activeProjectId || undefined
      )
    } catch (error: unknown) {
      addLog(`Status refresh failed: ${errorMessage(error)}`)
    }
  }

  async function indexProject(force = false) {
    if (!projectPath.value || !configStore.activeConfig || !workspaceStore.activeProjectId) {
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
        {
          projectId: workspaceStore.activeProjectId,
          rootPath: projectPath.value,
          extensions: selectedExtensions.value,
          excludePatterns: excludePatterns.value,
          force
        },
        configStore.activeConfig
      )
      addLog(
        indexStatus.value.success
          ? indexStatus.value.message || (force ? 'Project index rebuilt.' : 'Project indexed.')
          : `Index failed: ${indexStatus.value.message}`
      )
      await persistPreferences()
      await workspaceStore.refresh()
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

  async function pauseIndex() {
    if (workspaceStore.activeProjectId)
      await window.api.ragPauseIndex(workspaceStore.activeProjectId)
  }

  async function resumeIndex() {
    if (workspaceStore.activeProjectId)
      await window.api.ragResumeIndex(workspaceStore.activeProjectId)
  }

  async function cancelIndex() {
    if (workspaceStore.activeProjectId)
      await window.api.ragCancelIndex(workspaceStore.activeProjectId)
  }

  async function selectProject(projectId: string) {
    await workspaceStore.setActive(projectId)
    projectPath.value = workspaceStore.activeProject?.rootPath || ''
    healthReport.value = null
    await window.api.setWorkspace(projectPath.value)
    await refreshStatus()
  }

  async function toggleExtension(extension: string) {
    selectedExtensions.value = selectedExtensions.value.includes(extension)
      ? selectedExtensions.value.filter((item) => item !== extension)
      : [...selectedExtensions.value, extension]
    await persistPreferences()
  }

  async function updateExcludePatterns(patterns: string[]) {
    excludePatterns.value = Array.from(new Set(patterns))
    await persistPreferences()
  }

  async function restore() {
    const stored = await window.api.getConfig(CONFIG_KEY)
    if (isKnowledgePreferences(stored)) {
      projectPath.value = stored.projectPath
      selectedExtensions.value = stored.extensions.filter((extension) =>
        KNOWLEDGE_EXTENSIONS.includes(extension)
      )
      excludePatterns.value = stored.excludePatterns || []
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

    if (workspaceStore.activeProject) {
      projectPath.value = workspaceStore.activeProject.rootPath
    }

    if (configStore.isReady) {
      await initialize()
      await refreshStatus()
    } else addLog('Configure an API key before indexing project knowledge.')
  }

  async function persistPreferences() {
    await window.api.setConfig(CONFIG_KEY, {
      projectPath: projectPath.value,
      extensions: selectedExtensions.value,
      excludePatterns: excludePatterns.value
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
    projects: computed(() => workspaceStore.projects),
    activeProjectId: computed(() => workspaceStore.activeProjectId),
    projectMap: computed(() => workspaceStore.projectMap),
    selectedExtensions,
    excludePatterns,
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
    updateExcludePatterns,
    selectProject,
    pauseIndex,
    resumeIndex,
    cancelIndex,
    restore,
    startPolling,
    stopPolling
  }
}

function isKnowledgePreferences(value: unknown): value is {
  projectPath: string
  extensions: string[]
  excludePatterns?: string[]
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'projectPath' in value &&
    typeof value.projectPath === 'string' &&
    'extensions' in value &&
    Array.isArray(value.extensions) &&
    value.extensions.every((extension) => typeof extension === 'string') &&
    (!('excludePatterns' in value) ||
      (Array.isArray(value.excludePatterns) &&
        value.excludePatterns.every((pattern) => typeof pattern === 'string')))
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}
