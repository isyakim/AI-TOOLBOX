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
          text: 'fallback text',
          _distance: 0.1,
          metadata: {
            source: 'absolute.ts',
            relativePath: 'src/example.ts',
            path: 'C:/project/src/example.ts',
            snippet: 'const value = 1'
          }
        },
        { text: 'ignored', metadata: { source: 'system' } }
      ])
    ).toEqual([
      {
        source: 'src/example.ts',
        path: 'C:/project/src/example.ts',
        relativePath: 'src/example.ts',
        snippet: 'const value = 1',
        score: 0.1
      }
    ])
  })
})
