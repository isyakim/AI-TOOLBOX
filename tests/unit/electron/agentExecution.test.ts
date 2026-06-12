import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  userDataPath: 'F:/work/AI-TOOLBOX/.tmp-agent-user-data',
  projectRoot: 'F:/work/AI-TOOLBOX/.tmp-agent-project'
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => state.userDataPath) },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) =>
      state.handlers.set(channel, handler)
    )
  }
}))

vi.mock('../../../electron/main/projectRepository', () => ({
  getWorkspaceProject: vi.fn(async (id: string) =>
    id === 'project-one'
      ? {
          id,
          name: 'fixture',
          rootPath: state.projectRoot,
          branch: 'main',
          languageStats: {},
          indexVersion: 1,
          lastIndexedAt: null,
          failedFiles: []
        }
      : null
  )
}))

import { setupAgentExecutionHandlers } from '../../../electron/main/agentExecution'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const handler = state.handlers.get(channel)
  if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
  return (await handler({}, ...args)) as T
}

describe('controlled agent execution', () => {
  beforeEach(async () => {
    state.handlers.clear()
    await fs.rm(state.userDataPath, { recursive: true, force: true })
    await fs.rm(state.projectRoot, { recursive: true, force: true })
    await fs.mkdir(state.userDataPath, { recursive: true })
    await fs.mkdir(state.projectRoot, { recursive: true })
    await fs.writeFile(join(state.projectRoot, 'target.txt'), 'before\n', 'utf-8')
    await fs.writeFile(
      join(state.projectRoot, 'package.json'),
      JSON.stringify({
        scripts: {
          'test:fixture': `node -e "console.log('verified')"`,
          serve: `node -e "console.log('not allowed')"`
        }
      }),
      'utf-8'
    )
    setupAgentExecutionHandlers()
  })

  afterEach(async () => {
    await fs.rm(state.userDataPath, { recursive: true, force: true })
    await fs.rm(state.projectRoot, { recursive: true, force: true })
  })

  it('rejects a stale ChangeSet and stops remaining actions', async () => {
    const task = await invoke<{ id: string }>('agent:tasks:create', {
      projectId: 'project-one',
      objective: 'Update fixture files'
    })
    await invoke('agent:plan:save', { taskId: task.id, steps: ['Update target', 'Verify'] })
    await invoke('agent:plan:approve', task.id)
    await expect(
      invoke('agent:changeset:preview', {
        taskId: task.id,
        projectId: 'project-one',
        files: [
          { path: 'target.txt', action: 'write', content: 'one\n' },
          { path: 'target.txt', action: 'write', content: 'two\n' }
        ]
      })
    ).rejects.toThrow('duplicate file paths')
    const changeSet = await invoke<{ id: string }>('agent:changeset:preview', {
      taskId: task.id,
      projectId: 'project-one',
      files: [
        { path: 'target.txt', action: 'write', content: 'after\n' },
        { path: 'second.txt', action: 'write', content: 'second\n' }
      ]
    })
    await invoke('agent:changeset:approve', changeSet.id)
    await fs.writeFile(join(state.projectRoot, 'target.txt'), 'external change\n', 'utf-8')

    const result = await invoke<{
      success: boolean
      failed?: { path: string; message: string }
      skipped: string[]
    }>('agent:changeset:execute', changeSet.id)

    expect(result.success).toBe(false)
    expect(result.failed?.path).toBe('target.txt')
    expect(result.failed?.message).toContain('changed after preview')
    expect(result.skipped).toEqual(['second.txt'])
    await expect(fs.stat(join(state.projectRoot, 'second.txt'))).rejects.toThrow()
    await expect(
      invoke('agent:commands:list', { taskId: task.id, projectId: 'project-one' })
    ).rejects.toThrow('not ready for verification')
  })

  it('executes approved changes and only exposes allowlisted package scripts', async () => {
    const task = await invoke<{ id: string }>('agent:tasks:create', {
      projectId: 'project-one',
      objective: 'Apply and verify a change'
    })
    await invoke('agent:plan:save', { taskId: task.id, steps: ['Apply change'] })
    await invoke('agent:plan:approve', task.id)
    const changeSet = await invoke<{ id: string }>('agent:changeset:preview', {
      taskId: task.id,
      projectId: 'project-one',
      files: [{ path: 'target.txt', action: 'write', content: 'after\n' }]
    })
    await invoke('agent:changeset:approve', changeSet.id)
    const execution = await invoke<{ success: boolean }>('agent:changeset:execute', changeSet.id)
    expect(execution.success).toBe(true)
    expect(await fs.readFile(join(state.projectRoot, 'target.txt'), 'utf-8')).toBe('after\n')

    const proposals = await invoke<Array<{ id: string; scriptName: string }>>(
      'agent:commands:list',
      { taskId: task.id, projectId: 'project-one' }
    )
    expect(proposals.map((proposal) => proposal.scriptName)).toEqual(['test:fixture'])
    await invoke('agent:command:approve', proposals[0].id)
    const verification = await invoke<{ exitCode: number; output: string }>(
      'agent:command:run',
      proposals[0].id
    )
    expect(verification.exitCode).toBe(0)
    expect(verification.output).toContain('verified')
  })
})
