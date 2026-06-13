import { reactive, ref, watch } from 'vue'
import { generateAgentPlan } from '@/services/agentPlanner'
import { useAgentStore } from '@/stores/agent'
import { useWorkspaceStore } from '@/stores/workspace'
import type { ProposedFileChange } from '../types'

export function useAgentTaskWorkspace() {
  const agent = useAgentStore()
  const workspace = useWorkspaceStore()
  const objective = ref('')
  const planText = ref('')
  const executionMessage = ref('')
  const proposedFiles = reactive<ProposedFileChange[]>([newProposedFile()])

  watch(
    () => agent.activeTask,
    (task, previous) => {
      planText.value = task?.plan.map((step) => step.title).join('\n') || ''
      if (task?.id !== previous?.id) {
        proposedFiles.splice(0, proposedFiles.length, newProposedFile())
        executionMessage.value = ''
      }
    },
    { immediate: true }
  )

  async function createTask() {
    const created = await agent.run(() => agent.create(objective.value))
    if (created) objective.value = ''
  }

  async function savePlan() {
    const steps = planText.value
      .split(/\r?\n/)
      .map((step) => step.trim())
      .filter(Boolean)
    await agent.run(() => agent.savePlan(steps))
  }

  async function generatePlan() {
    if (!agent.activeTask) return
    const steps = await agent.run(() =>
      generateAgentPlan(agent.activeTask!.objective, workspace.projectMap)
    )
    if (steps) planText.value = steps.join('\n')
  }

  async function previewChanges() {
    const files = proposedFiles
      .filter((file) => file.path.trim())
      .map((file) => ({
        path: file.path.trim(),
        action: file.action,
        content: file.action === 'write' ? file.content : undefined
      }))
    await agent.run(() => agent.previewChanges(files))
  }

  async function executeChanges() {
    const result = await agent.run(() => agent.executeChanges())
    if (result && typeof result === 'object' && 'success' in result) {
      executionMessage.value = result.success
        ? `Applied ${result.completed.length} file change(s).`
        : `Stopped at ${result.failed?.path}: ${result.failed?.message}`
    }
  }

  function addFile() {
    proposedFiles.push(newProposedFile())
  }

  function removeFile(index: number) {
    if (proposedFiles.length > 1) proposedFiles.splice(index, 1)
  }

  return {
    agent,
    workspace,
    objective,
    planText,
    executionMessage,
    proposedFiles,
    createTask,
    savePlan,
    generatePlan,
    previewChanges,
    executeChanges,
    addFile,
    removeFile
  }
}

function newProposedFile(): ProposedFileChange {
  return { path: '', action: 'write', content: '' }
}
