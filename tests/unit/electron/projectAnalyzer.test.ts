import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { isPackaged: false } }))

import { analyzeProject } from '../../../electron/main/projectAnalyzer'
import type { WorkspaceProject } from '../../../src/shared/types/ipc'

const project: WorkspaceProject = {
  id: 'project',
  name: 'fixture',
  rootPath: process.cwd(),
  branch: 'main',
  languageStats: { TypeScript: 1 },
  indexVersion: 0,
  lastIndexedAt: null,
  failedFiles: []
}

describe('analyzeProject', () => {
  it('extracts TypeScript symbols, imports, entry files, and line-aware chunks', async () => {
    const source = [
      "import { helper } from './helper'",
      'export function start() {',
      '  return helper()',
      '}',
      'class Worker {}'
    ].join('\n')
    const root = await mkdtemp(join(tmpdir(), 'ai-toolbox-analysis-'))
    const path = join(root, 'main.ts')
    await writeFile(path, source)
    const result = await analyzeProject({ ...project, rootPath: root }, [
      {
        path,
        relativePath: 'src/main.ts',
        extension: '.ts',
        language: 'TypeScript',
        bytes: source.length
      }
    ])

    expect(result.projectMap.entryFiles).toEqual(['src/main.ts'])
    expect(result.projectMap.symbols).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'start', lineStart: 2 })])
    )
    expect(result.projectMap.relations).toContainEqual(
      expect.objectContaining({ fromPath: 'src/main.ts', toPath: 'src/helper' })
    )
    expect(result.chunks[0]).toEqual(expect.objectContaining({ relativePath: 'src/main.ts' }))
    await rm(root, { recursive: true, force: true })
  })
})
