import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(), isPackaged: false },
  ipcMain: { handle: vi.fn() }
}))

import {
  buildProjectPredicate,
  isProjectIndexPayload,
  isRAGQueryPayload
} from '../../../electron/main/rag'

describe('project knowledge query isolation', () => {
  it('always scopes retrieval to the requested project and escapes filters', () => {
    expect(
      buildProjectPredicate({
        projectId: "project'one",
        query: 'entry point',
        config: { providerId: 'provider' },
        filters: { languages: ['TypeScript'], paths: ['src/main.ts'] }
      })
    ).toBe(
      "projectId = 'project''one' AND (language = 'TypeScript') AND (relativePath = 'src/main.ts')"
    )
  })

  it('rejects unscoped queries and malformed index requests', () => {
    expect(isRAGQueryPayload({ query: 'entry point', config: { providerId: 'provider' } })).toBe(
      false
    )
    expect(
      isProjectIndexPayload({
        projectId: 'project-one',
        rootPath: 'C:/project',
        extensions: ['ts'],
        config: { providerId: 'provider' }
      })
    ).toBe(false)
  })
})
