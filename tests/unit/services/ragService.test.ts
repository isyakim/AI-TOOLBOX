import { describe, expect, it } from 'vitest'
import { RAGService, toRAGConfig } from '@/services/ragService'

describe('RAGService', () => {
  it('maps provider configuration explicitly', () => {
    expect(
      toRAGConfig({
        id: 'provider-id'
      })
    ).toEqual({
      providerId: 'provider-id'
    })
  })

  it('maps typed query results into citations', () => {
    expect(
      RAGService.mapResultsToCitations([
        {
          projectId: 'project',
          path: 'C:/project/src/example.ts',
          relativePath: 'src/example.ts',
          lineStart: 1,
          lineEnd: 2,
          indexedAt: '2026-06-12T00:00:00.000Z',
          snippet: 'const value = 1',
          text: 'fallback text',
          _distance: 0.1
        }
      ])
    ).toEqual([
      {
        source: 'src/example.ts',
        path: 'C:/project/src/example.ts',
        relativePath: 'src/example.ts',
        snippet: 'const value = 1',
        score: 0.1,
        projectId: 'project',
        lineStart: 1,
        lineEnd: 2,
        indexedAt: '2026-06-12T00:00:00.000Z'
      }
    ])
  })
})
