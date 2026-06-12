import { describe, expect, it } from 'vitest'
import { parseFileActions, requiresFileActionPreview } from '@/shared/services/fileActions'

describe('fileActions', () => {
  it('parses valid actions and removes action blocks from display content', () => {
    const parsed = parseFileActions(
      'Review this change.\n```file-action\n{"action":"write","path":"src/a.ts","content":"ok"}\n```'
    )

    expect(parsed.actions).toEqual([{ action: 'write', path: 'src/a.ts', content: 'ok' }])
    expect(parsed.contentWithoutActions).toBe('Review this change.')
    expect(parsed.invalidBlocks).toBe(0)
  })

  it('rejects unknown actions and malformed JSON', () => {
    const parsed = parseFileActions(
      '```file-action\n{"action":"execute","path":"script.sh"}\n```\n```file-action\n{bad}\n```'
    )

    expect(parsed.actions).toEqual([])
    expect(parsed.invalidBlocks).toBe(2)
  })

  it('requires approval for every mutating action', () => {
    expect(requiresFileActionPreview({ action: 'read', path: 'README.md' })).toBe(false)
    expect(requiresFileActionPreview({ action: 'delete', path: 'README.md' })).toBe(true)
  })
})
