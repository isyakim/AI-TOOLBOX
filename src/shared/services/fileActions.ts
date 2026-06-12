import type { FileActionName, FileActionPayload } from '@/shared/types/ipc'

const FILE_ACTION_PATTERN = /```file-action\s*([\s\S]+?)```/gi
const ACTIONS = new Set<FileActionName>(['read', 'write', 'save', 'edit', 'delete', 'remove'])

export interface ParsedFileActions {
  actions: FileActionPayload[]
  invalidBlocks: number
  contentWithoutActions: string
}

export function parseFileActions(content: string): ParsedFileActions {
  const actions: FileActionPayload[] = []
  let invalidBlocks = 0
  let match: RegExpExecArray | null

  FILE_ACTION_PATTERN.lastIndex = 0
  while ((match = FILE_ACTION_PATTERN.exec(content)) !== null) {
    try {
      const parsed: unknown = JSON.parse(match[1])
      if (isFileActionPayload(parsed)) actions.push(parsed)
      else invalidBlocks += 1
    } catch {
      invalidBlocks += 1
    }
  }

  FILE_ACTION_PATTERN.lastIndex = 0
  return {
    actions,
    invalidBlocks,
    contentWithoutActions: content.replace(FILE_ACTION_PATTERN, '').trim()
  }
}

export function requiresFileActionPreview(action: FileActionPayload): boolean {
  return action.action !== 'read'
}

function isFileActionPayload(value: unknown): value is FileActionPayload {
  if (typeof value !== 'object' || value === null) return false
  const action = Reflect.get(value, 'action')
  const path = Reflect.get(value, 'path')
  const content = Reflect.get(value, 'content')
  return (
    typeof action === 'string' &&
    ACTIONS.has(action as FileActionName) &&
    typeof path === 'string' &&
    path.trim().length > 0 &&
    (content === undefined || typeof content === 'string')
  )
}
