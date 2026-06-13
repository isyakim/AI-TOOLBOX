import { ipcMain } from 'electron'
import type { AgentTask } from '../../src/shared/types/ipc'
import { getWorkspaceProject } from './projectRepository'
import { readAgentStore, writeAgentStore } from './agentRepository'
import { now, updateTaskStatus } from './agentUtils'
import {
  approveChangeSet,
  executeChangeSet,
  previewChangeSet,
  type ChangeSetInput
} from './changeSetService'
import {
  approveVerificationCommand,
  listVerificationCommands,
  runVerificationCommand
} from './verificationService'

async function requireProject(projectId: string) {
  const project = await getWorkspaceProject(projectId)
  if (!project) throw new Error('Workspace project was not found.')
  return project
}

export function setupAgentExecutionHandlers(): void {
  ipcMain.handle('agent:tasks:list', async (_, projectId: unknown) => {
    const store = await readAgentStore()
    return typeof projectId === 'string'
      ? store.tasks.filter((task) => task.projectId === projectId)
      : store.tasks
  })
  ipcMain.handle('agent:tasks:create', async (_, input: unknown) => {
    if (
      !isRecord(input) ||
      typeof input.projectId !== 'string' ||
      typeof input.objective !== 'string'
    )
      throw new Error('Invalid agent task.')
    await requireProject(input.projectId)
    const store = await readAgentStore()
    const task: AgentTask = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      objective: input.objective.trim(),
      status: 'draft',
      plan: [],
      verificationIds: [],
      createdAt: now(),
      updatedAt: now()
    }
    if (!task.objective) throw new Error('Task objective is required.')
    store.tasks.push(task)
    await writeAgentStore(store)
    return task
  })
  ipcMain.handle('agent:plan:save', async (_, input: unknown) => {
    if (!isRecord(input) || typeof input.taskId !== 'string' || !isStringArray(input.steps))
      throw new Error('Invalid task plan.')
    const store = await readAgentStore()
    const task = store.tasks.find((item) => item.id === input.taskId)
    if (!task || task.status !== 'draft') throw new Error('Only draft tasks can receive a plan.')
    task.plan = input.steps.filter(Boolean).map((step) => ({
      id: crypto.randomUUID(),
      title: step,
      description: step,
      status: 'pending'
    }))
    if (!task.plan.length) throw new Error('A task plan requires at least one step.')
    updateTaskStatus(task, 'awaiting_approval')
    await writeAgentStore(store)
    return task
  })
  ipcMain.handle('agent:plan:approve', async (_, taskId: unknown) => {
    if (typeof taskId !== 'string') throw new Error('Invalid task ID.')
    const store = await readAgentStore()
    const task = store.tasks.find((item) => item.id === taskId)
    if (!task || task.status !== 'awaiting_approval') throw new Error('Task plan is not pending.')
    updateTaskStatus(task, 'executing')
    await writeAgentStore(store)
    return task
  })
  ipcMain.handle('agent:task:cancel', async (_, taskId: unknown) => {
    if (typeof taskId !== 'string') throw new Error('Invalid task ID.')
    const store = await readAgentStore()
    const task = store.tasks.find((item) => item.id === taskId)
    if (!task || ['completed', 'failed', 'cancelled'].includes(task.status))
      throw new Error('Task cannot be cancelled.')
    updateTaskStatus(task, 'cancelled')
    await writeAgentStore(store)
    return task
  })
  ipcMain.handle('agent:changeset:preview', (_, input: unknown) => {
    if (!isChangeSetInput(input)) throw new Error('Invalid ChangeSet input.')
    return previewChangeSet(input)
  })
  ipcMain.handle('agent:changeset:approve', (_, id: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid ChangeSet ID.')
    return approveChangeSet(id)
  })
  ipcMain.handle('agent:changeset:get', async (_, taskId: unknown) => {
    if (typeof taskId !== 'string') return null
    return (await readAgentStore()).changeSets.find((item) => item.taskId === taskId) || null
  })
  ipcMain.handle('agent:changeset:execute', (_, id: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid ChangeSet ID.')
    return executeChangeSet(id)
  })
  ipcMain.handle('agent:commands:list', (_, input: unknown) => {
    if (!isRecord(input) || typeof input.taskId !== 'string' || typeof input.projectId !== 'string')
      throw new Error('Invalid command request.')
    return listVerificationCommands(input.taskId, input.projectId)
  })
  ipcMain.handle('agent:command:approve', (_, proposalId: unknown) => {
    if (typeof proposalId !== 'string') throw new Error('Invalid command proposal.')
    return approveVerificationCommand(proposalId)
  })
  ipcMain.handle('agent:command:run', (_, proposalId: unknown) => {
    if (typeof proposalId !== 'string') throw new Error('Invalid command proposal.')
    return runVerificationCommand(proposalId)
  })
  ipcMain.handle('agent:results:list', async (_, taskId: unknown) => {
    if (typeof taskId !== 'string') return []
    return (await readAgentStore()).results.filter((result) => result.taskId === taskId)
  })
}

function isChangeSetInput(value: unknown): value is ChangeSetInput {
  if (!isRecord(value) || typeof value.taskId !== 'string' || typeof value.projectId !== 'string')
    return false
  if (!Array.isArray(value.files)) return false
  return value.files.every(
    (file) =>
      isRecord(file) &&
      typeof file.path === 'string' &&
      ['write', 'delete'].includes(String(file.action)) &&
      (file.content === undefined || typeof file.content === 'string')
  )
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
