import { app, ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { createTwoFilesPatch } from 'diff'
import type {
  AgentTask,
  AgentTaskStatus,
  ChangeSet,
  ChangeSetExecutionResult,
  CommandProposal,
  VerificationResult
} from '../../src/shared/types/ipc'
import { getWorkspaceProject } from './projectRepository'
import { resolveWorkspacePath } from './workspace'

const execFileAsync = promisify(execFile)
const STORE_FILE = 'agent-execution.json'
const MISSING_HASH = 'missing'
const MAX_OUTPUT = 40_000
const ALLOWED_SCRIPT = /(lint|typecheck|test|build)/i
const SAFE_SCRIPT_NAME = /^[a-zA-Z0-9:_-]+$/

interface AgentStore {
  tasks: AgentTask[]
  changeSets: ChangeSet[]
  proposals: CommandProposal[]
  results: VerificationResult[]
}

interface ChangeSetInput {
  taskId: string
  projectId: string
  files: Array<{ path: string; action: 'write' | 'delete'; content?: string }>
}

const emptyStore = (): AgentStore => ({ tasks: [], changeSets: [], proposals: [], results: [] })

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

async function readStore(): Promise<AgentStore> {
  try {
    const value = JSON.parse(await fs.readFile(storePath(), 'utf-8')) as Partial<AgentStore>
    return {
      tasks: Array.isArray(value.tasks) ? value.tasks : [],
      changeSets: Array.isArray(value.changeSets) ? value.changeSets : [],
      proposals: Array.isArray(value.proposals) ? value.proposals : [],
      results: Array.isArray(value.results) ? value.results : []
    }
  } catch {
    return emptyStore()
  }
}

async function writeStore(store: AgentStore): Promise<void> {
  const path = storePath()
  const tempPath = `${path}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(store, null, 2), 'utf-8')
  await fs.rename(tempPath, path)
}

function now(): string {
  return new Date().toISOString()
}

function updateTaskStatus(task: AgentTask, status: AgentTaskStatus, error?: string): AgentTask {
  task.status = status
  task.updatedAt = now()
  task.error = error
  return task
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
    return { path, content, hash: hash(content), exists: true }
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

async function previewChangeSet(input: ChangeSetInput): Promise<ChangeSet> {
  const project = await requireProject(input.projectId)
  const store = await readStore()
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
  await writeStore(store)
  return changeSet
}

async function approveChangeSet(changeSetId: string): Promise<ChangeSet> {
  const store = await readStore()
  const changeSet = store.changeSets.find((item) => item.id === changeSetId)
  if (!changeSet || changeSet.approval !== 'pending') throw new Error('ChangeSet is not pending.')
  const task = store.tasks.find((item) => item.id === changeSet.taskId)
  if (!task || task.status !== 'executing') throw new Error('Agent task is not executable.')
  changeSet.approval = 'approved'
  await writeStore(store)
  return changeSet
}

async function executeChangeSet(changeSetId: string): Promise<ChangeSetExecutionResult> {
  const store = await readStore()
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
        result.completed.push({ path: file.path, resultHash: hash(file.content || '') })
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
  await writeStore(store)
  return result
}

async function listVerificationCommands(taskId: string, projectId: string) {
  const project = await requireProject(projectId)
  const store = await readStore()
  const task = store.tasks.find((item) => item.id === taskId && item.projectId === projectId)
  if (!task) throw new Error('Agent task was not found.')
  if (task.status !== 'verifying') throw new Error('Agent task is not ready for verification.')
  const packageContent = await fs.readFile(join(project.rootPath, 'package.json'), 'utf-8')
  const packageData = JSON.parse(packageContent) as { scripts?: Record<string, unknown> }
  const proposals: CommandProposal[] = Object.entries(packageData.scripts || {})
    .filter(
      ([name, command]) =>
        ALLOWED_SCRIPT.test(name) && SAFE_SCRIPT_NAME.test(name) && typeof command === 'string'
    )
    .map(([name, command]) => ({
      id: crypto.randomUUID(),
      taskId,
      projectId,
      scriptName: name,
      command: String(command),
      reason: `Verify the approved changes with the project's ${name} script.`,
      timeoutMs: 120_000,
      approved: false,
      packageHash: hash(packageContent)
    }))
  store.proposals = [
    ...store.proposals.filter((proposal) => proposal.taskId !== taskId),
    ...proposals
  ]
  await writeStore(store)
  return proposals
}

async function runVerificationCommand(proposalId: string): Promise<VerificationResult> {
  const store = await readStore()
  const proposal = store.proposals.find((item) => item.id === proposalId)
  if (!proposal?.approved) throw new Error('Approve the verification command before running it.')
  if (store.results.some((result) => result.proposalId === proposalId))
    throw new Error(
      'This verification command has already run. Discover a new proposal to rerun it.'
    )
  if (!ALLOWED_SCRIPT.test(proposal.scriptName) || !SAFE_SCRIPT_NAME.test(proposal.scriptName))
    throw new Error('Command is not allowlisted.')
  const task = store.tasks.find((item) => item.id === proposal.taskId)
  if (!task) throw new Error('Agent task was not found.')
  if (task.status !== 'verifying') throw new Error('Agent task is not ready for verification.')
  const project = await requireProject(proposal.projectId)
  const packageContent = await fs.readFile(join(project.rootPath, 'package.json'), 'utf-8')
  if (hash(packageContent) !== proposal.packageHash)
    throw new Error('package.json changed after command approval. Discover commands again.')
  const packageData = JSON.parse(packageContent) as { scripts?: Record<string, unknown> }
  if (packageData.scripts?.[proposal.scriptName] !== proposal.command)
    throw new Error('The approved package script no longer matches the proposal.')
  updateTaskStatus(task, 'verifying')
  const startedAt = Date.now()
  let exitCode = 0
  let output = ''
  let timedOut = false
  try {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const result = await execFileAsync(npmCommand, ['run', proposal.scriptName], {
      cwd: project.rootPath,
      windowsHide: true,
      shell: process.platform === 'win32',
      timeout: Math.min(proposal.timeoutMs, 120_000),
      maxBuffer: 5 * 1024 * 1024
    })
    output = `${result.stdout}\n${result.stderr}`.trim()
  } catch (error: unknown) {
    const value = error as {
      code?: number | string
      stdout?: string
      stderr?: string
      killed?: boolean
    }
    exitCode = typeof value.code === 'number' ? value.code : 1
    timedOut = Boolean(value.killed)
    output = `${value.stdout || ''}\n${value.stderr || ''}`.trim()
  }
  const result: VerificationResult = {
    id: crypto.randomUUID(),
    taskId: task.id,
    proposalId,
    scriptName: proposal.scriptName,
    exitCode,
    durationMs: Date.now() - startedAt,
    output: output.slice(-MAX_OUTPUT),
    timedOut,
    createdAt: now()
  }
  store.results.push(result)
  task.verificationIds.push(result.id)
  updateTaskStatus(
    task,
    exitCode === 0 ? 'completed' : 'failed',
    exitCode ? `${proposal.scriptName} failed.` : undefined
  )
  await writeStore(store)
  return result
}

export function setupAgentExecutionHandlers(): void {
  ipcMain.handle('agent:tasks:list', async (_, projectId: unknown) => {
    const store = await readStore()
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
    const store = await readStore()
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
    await writeStore(store)
    return task
  })
  ipcMain.handle('agent:plan:save', async (_, input: unknown) => {
    if (!isRecord(input) || typeof input.taskId !== 'string' || !isStringArray(input.steps))
      throw new Error('Invalid task plan.')
    const store = await readStore()
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
    await writeStore(store)
    return task
  })
  ipcMain.handle('agent:plan:approve', async (_, taskId: unknown) => {
    if (typeof taskId !== 'string') throw new Error('Invalid task ID.')
    const store = await readStore()
    const task = store.tasks.find((item) => item.id === taskId)
    if (!task || task.status !== 'awaiting_approval') throw new Error('Task plan is not pending.')
    updateTaskStatus(task, 'executing')
    await writeStore(store)
    return task
  })
  ipcMain.handle('agent:task:cancel', async (_, taskId: unknown) => {
    if (typeof taskId !== 'string') throw new Error('Invalid task ID.')
    const store = await readStore()
    const task = store.tasks.find((item) => item.id === taskId)
    if (!task || ['completed', 'failed', 'cancelled'].includes(task.status))
      throw new Error('Task cannot be cancelled.')
    updateTaskStatus(task, 'cancelled')
    await writeStore(store)
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
    return (await readStore()).changeSets.find((item) => item.taskId === taskId) || null
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
  ipcMain.handle('agent:command:approve', async (_, proposalId: unknown) => {
    if (typeof proposalId !== 'string') throw new Error('Invalid command proposal.')
    const store = await readStore()
    const proposal = store.proposals.find((item) => item.id === proposalId)
    if (!proposal) throw new Error('Command proposal was not found.')
    const task = store.tasks.find((item) => item.id === proposal.taskId)
    if (!task || task.status !== 'verifying')
      throw new Error('Agent task is not ready for verification.')
    proposal.approved = true
    await writeStore(store)
    return proposal
  })
  ipcMain.handle('agent:command:run', (_, proposalId: unknown) => {
    if (typeof proposalId !== 'string') throw new Error('Invalid command proposal.')
    return runVerificationCommand(proposalId)
  })
  ipcMain.handle('agent:results:list', async (_, taskId: unknown) => {
    if (typeof taskId !== 'string') return []
    return (await readStore()).results.filter((result) => result.taskId === taskId)
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

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown agent execution error.'
}
