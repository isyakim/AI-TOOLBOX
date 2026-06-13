import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  AgentTask,
  ChangeSet,
  ChangeSetExecutionResult,
  CommandProposal,
  VerificationResult
} from '@/shared/types/ipc'
import { useWorkspaceStore } from './workspace'
import { useChatStore } from './chat'

export const useAgentStore = defineStore('agent', () => {
  const workspaceStore = useWorkspaceStore()
  const chatStore = useChatStore()
  const tasks = ref<AgentTask[]>([])
  const activeTaskId = ref<string | null>(null)
  const changeSet = ref<ChangeSet | null>(null)
  const commands = ref<CommandProposal[]>([])
  const results = ref<VerificationResult[]>([])
  const busy = ref(false)
  const error = ref('')

  const activeTask = computed(
    () => tasks.value.find((task) => task.id === activeTaskId.value) || null
  )

  async function load() {
    tasks.value = await window.api.listAgentTasks(workspaceStore.activeProjectId || undefined)
    if (!tasks.value.some((task) => task.id === activeTaskId.value))
      activeTaskId.value = tasks.value[0]?.id || null
    await loadTaskDetails()
  }

  async function selectTask(taskId: string) {
    activeTaskId.value = taskId
    await loadTaskDetails()
  }

  async function loadTaskDetails() {
    if (!activeTaskId.value) {
      changeSet.value = null
      commands.value = []
      results.value = []
      return
    }
    changeSet.value = await window.api.getAgentChangeSet(activeTaskId.value)
    results.value = await window.api.listVerificationResults(activeTaskId.value)
  }

  async function create(objective: string) {
    if (!workspaceStore.activeProjectId) throw new Error('Select a workspace project first.')
    const task = await window.api.createAgentTask({
      projectId: workspaceStore.activeProjectId,
      objective
    })
    tasks.value = [task, ...tasks.value]
    activeTaskId.value = task.id
    await loadTaskDetails()
    return task
  }

  async function savePlan(steps: string[]) {
    if (activeTask.value)
      replaceTask(await window.api.saveAgentPlan({ taskId: activeTask.value.id, steps }))
  }

  async function approvePlan() {
    if (activeTask.value) replaceTask(await window.api.approveAgentPlan(activeTask.value.id))
  }

  async function cancelTask() {
    if (activeTask.value) replaceTask(await window.api.cancelAgentTask(activeTask.value.id))
  }

  async function previewChanges(
    files: Array<{ path: string; action: 'write' | 'delete'; content?: string }>
  ) {
    if (!activeTask.value) return
    changeSet.value = await window.api.previewChangeSet({
      taskId: activeTask.value.id,
      projectId: activeTask.value.projectId,
      files
    })
  }

  async function approveChanges() {
    if (changeSet.value) changeSet.value = await window.api.approveChangeSet(changeSet.value.id)
  }

  async function executeChanges(): Promise<ChangeSetExecutionResult | null> {
    if (!changeSet.value) return null
    const execution = await window.api.executeChangeSet(changeSet.value.id)
    await load()
    return execution
  }

  async function loadCommands() {
    if (!activeTask.value) return
    commands.value = await window.api.listVerificationCommands({
      taskId: activeTask.value.id,
      projectId: activeTask.value.projectId
    })
  }

  async function approveCommand(proposalId: string) {
    const proposal = await window.api.approveVerificationCommand(proposalId)
    commands.value = commands.value.map((item) => (item.id === proposal.id ? proposal : item))
  }

  async function runCommand(proposalId: string) {
    const result = await window.api.runVerificationCommand(proposalId)
    results.value.push(result)
    commands.value = commands.value.filter((command) => command.id !== proposalId)
    const sessionId = chatStore.activeSessionId || chatStore.createSession()
    chatStore.addMessage(sessionId, {
      role: 'system',
      content: `[Agent verification: npm run ${result.scriptName}]\nExit code: ${result.exitCode}\nDuration: ${result.durationMs}ms\n\n${result.output || '(no output)'}`
    })
    await load()
    return result
  }

  async function run<T>(action: () => Promise<T>): Promise<T | null> {
    busy.value = true
    error.value = ''
    try {
      return await action()
    } catch (cause: unknown) {
      error.value = cause instanceof Error ? cause.message : 'Agent operation failed.'
      return null
    } finally {
      busy.value = false
    }
  }

  function replaceTask(task: AgentTask) {
    tasks.value = tasks.value.map((item) => (item.id === task.id ? task : item))
  }

  return {
    tasks,
    activeTaskId,
    activeTask,
    changeSet,
    commands,
    results,
    busy,
    error,
    load,
    selectTask,
    create,
    savePlan,
    approvePlan,
    cancelTask,
    previewChanges,
    approveChanges,
    executeChanges,
    loadCommands,
    approveCommand,
    runCommand,
    run
  }
})
