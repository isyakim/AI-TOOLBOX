import { createHash } from 'node:crypto'
import type { AgentTask, AgentTaskStatus } from '../../src/shared/types/ipc'

export const MISSING_HASH = 'missing'

export function now(): string {
  return new Date().toISOString()
}

export function updateTaskStatus(
  task: AgentTask,
  status: AgentTaskStatus,
  error?: string
): AgentTask {
  task.status = status
  task.updatedAt = now()
  task.error = error
  return task
}

export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown agent execution error.'
}
