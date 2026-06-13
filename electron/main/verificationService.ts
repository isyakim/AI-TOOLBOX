import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { CommandProposal, VerificationResult } from '../../src/shared/types/ipc'
import { getWorkspaceProject } from './projectRepository'
import { readAgentStore, writeAgentStore } from './agentRepository'
import { contentHash, now, updateTaskStatus } from './agentUtils'

const execFileAsync = promisify(execFile)
const MAX_OUTPUT = 40_000
const ALLOWED_SCRIPT = /(lint|typecheck|test|build)/i
const SAFE_SCRIPT_NAME = /^[a-zA-Z0-9:_-]+$/

async function requireProject(projectId: string) {
  const project = await getWorkspaceProject(projectId)
  if (!project) throw new Error('Workspace project was not found.')
  return project
}

export async function listVerificationCommands(
  taskId: string,
  projectId: string
): Promise<CommandProposal[]> {
  const project = await requireProject(projectId)
  const store = await readAgentStore()
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
      packageHash: contentHash(packageContent)
    }))
  store.proposals = [
    ...store.proposals.filter((proposal) => proposal.taskId !== taskId),
    ...proposals
  ]
  await writeAgentStore(store)
  return proposals
}

export async function approveVerificationCommand(proposalId: string): Promise<CommandProposal> {
  const store = await readAgentStore()
  const proposal = store.proposals.find((item) => item.id === proposalId)
  if (!proposal) throw new Error('Command proposal was not found.')
  const task = store.tasks.find((item) => item.id === proposal.taskId)
  if (!task || task.status !== 'verifying')
    throw new Error('Agent task is not ready for verification.')
  proposal.approved = true
  await writeAgentStore(store)
  return proposal
}

export async function runVerificationCommand(proposalId: string): Promise<VerificationResult> {
  const store = await readAgentStore()
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
  if (contentHash(packageContent) !== proposal.packageHash)
    throw new Error('package.json changed after command approval. Discover commands again.')
  const packageData = JSON.parse(packageContent) as { scripts?: Record<string, unknown> }
  if (packageData.scripts?.[proposal.scriptName] !== proposal.command)
    throw new Error('The approved package script no longer matches the proposal.')

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
  await writeAgentStore(store)
  return result
}
