import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { createTwoFilesPatch } from 'diff'
import type { ChangeSet, ChangeSetExecutionResult } from '../../src/shared/types/ipc'
import { getWorkspaceProject } from './projectRepository'
import { resolveWorkspacePath } from './workspace'
import { readAgentStore, writeAgentStore } from './agentRepository'
import { contentHash, errorMessage, MISSING_HASH, now, updateTaskStatus } from './agentUtils'

export interface ChangeSetInput {
  taskId: string
  projectId: string
  files: Array<{ path: string; action: 'write' | 'delete'; content?: string }>
}

async function requireProject(projectId: string) {
  const project = await getWorkspaceProject(projectId)
  if (!project) throw new Error('Workspace project was not found.')
  return project
}

async function readFileState(rootPath: string, relativePath: string) {
  const path = await resolveWorkspacePath(rootPath, relativePath)
  try {
    const stats = await fs.stat(path)
    if (!stats.isFile()) throw new Error('ChangeSets only support regular files.')
    const content = await fs.readFile(path, 'utf-8')
    return { path, content, hash: contentHash(content), exists: true }
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return { path, content: '', hash: MISSING_HASH, exists: false }
    throw error
  }
}

function diffStats(diff: string): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions += 1
    if (line.startsWith('-') && !line.startsWith('---')) deletions += 1
  }
  return { additions, deletions }
}

function fileRisk(action: 'write' | 'delete', path: string, exists: boolean) {
  if (action === 'delete') return 'high' as const
  if (/^(package-lock\.json|package\.json|\.github\/|electron\/main\/)/i.test(path))
    return 'medium' as const
  return exists ? ('low' as const) : ('medium' as const)
}

export async function previewChangeSet(input: ChangeSetInput): Promise<ChangeSet> {
  const project = await requireProject(input.projectId)
  const store = await readAgentStore()
  const task = store.tasks.find((item) => item.id === input.taskId)
  if (!task || task.projectId !== input.projectId) throw new Error('Agent task was not found.')
  if (task.status !== 'executing')
    throw new Error('Approve the task plan before proposing changes.')
  if (!input.files.length) throw new Error('A ChangeSet requires at least one file.')
  if (new Set(input.files.map((file) => file.path)).size !== input.files.length)
    throw new Error('A ChangeSet cannot contain duplicate file paths.')

  const files = []
  for (const proposed of input.files) {
    const current = await readFileState(project.rootPath, proposed.path)
    if (proposed.action === 'delete' && !current.exists)
      throw new Error(`Cannot delete missing file: ${proposed.path}`)
    const nextContent = proposed.action === 'delete' ? '' : proposed.content || ''
    const diff = createTwoFilesPatch(
      `a/${proposed.path}`,
      `b/${proposed.path}`,
      current.content,
      nextContent,
      'before',
      'after',
      { context: 3 }
    )
    files.push({
      ...proposed,
      expectedHash: current.hash,
      diff,
      ...diffStats(diff),
      risk: fileRisk(proposed.action, proposed.path, current.exists)
    })
  }

  const changeSet: ChangeSet = {
    id: crypto.randomUUID(),
    taskId: task.id,
    projectId: project.id,
    files,
    approval: 'pending',
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    risks: files
      .filter((file) => file.risk !== 'low')
      .map((file) => `${file.risk.toUpperCase()}: ${file.action} ${file.path}`),
    createdAt: now()
  }
  store.changeSets = [...store.changeSets.filter((item) => item.taskId !== task.id), changeSet]
  task.changeSetId = changeSet.id
  task.updatedAt = now()
  await writeAgentStore(store)
  return changeSet
}

export async function approveChangeSet(changeSetId: string): Promise<ChangeSet> {
  const store = await readAgentStore()
  const changeSet = store.changeSets.find((item) => item.id === changeSetId)
  if (!changeSet || changeSet.approval !== 'pending') throw new Error('ChangeSet is not pending.')
  const task = store.tasks.find((item) => item.id === changeSet.taskId)
  if (!task || task.status !== 'executing') throw new Error('Agent task is not executable.')
  changeSet.approval = 'approved'
  await writeAgentStore(store)
  return changeSet
}

export async function executeChangeSet(changeSetId: string): Promise<ChangeSetExecutionResult> {
  const store = await readAgentStore()
  const changeSet = store.changeSets.find((item) => item.id === changeSetId)
  if (!changeSet || changeSet.approval !== 'approved')
    throw new Error('Approve the ChangeSet before execution.')
  const task = store.tasks.find((item) => item.id === changeSet.taskId)
  if (!task) throw new Error('Agent task was not found.')
  if (task.status !== 'executing') throw new Error('Agent task is not executable.')
  const project = await requireProject(changeSet.projectId)
  const result: ChangeSetExecutionResult = { success: true, completed: [], skipped: [] }

  for (let index = 0; index < changeSet.files.length; index += 1) {
    const file = changeSet.files[index]
    try {
      const current = await readFileState(project.rootPath, file.path)
      if (current.hash !== file.expectedHash)
        throw new Error('File changed after preview. Generate a fresh ChangeSet.')
      if (file.action === 'delete') {
        await fs.unlink(current.path)
        result.completed.push({ path: file.path, resultHash: MISSING_HASH })
      } else {
        await fs.mkdir(dirname(current.path), { recursive: true })
        const tempPath = join(dirname(current.path), `.${crypto.randomUUID()}.aitoolbox.tmp`)
        try {
          await fs.writeFile(tempPath, file.content || '', 'utf-8')
          await fs.rename(tempPath, current.path)
        } finally {
          await fs.rm(tempPath, { force: true }).catch(() => undefined)
        }
        result.completed.push({ path: file.path, resultHash: contentHash(file.content || '') })
      }
    } catch (error: unknown) {
      result.success = false
      result.failed = { path: file.path, message: errorMessage(error) }
      result.skipped = changeSet.files.slice(index + 1).map((item) => item.path)
      break
    }
  }

  changeSet.approval = result.success ? 'executed' : 'failed'
  if (result.success) task.plan.forEach((step) => (step.status = 'completed'))
  else {
    const failedStep = task.plan.find((step) => step.status === 'pending')
    if (failedStep) failedStep.status = 'failed'
  }
  updateTaskStatus(task, result.success ? 'verifying' : 'failed', result.failed?.message)
  await writeAgentStore(store)
  return result
}
