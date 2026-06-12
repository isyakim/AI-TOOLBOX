import { describe, expect, it } from 'vitest'
import { RAGService, toRAGConfig } from '@/services/ragService'

describe('RAGService', () => {
  it('maps provider configuration explicitly', () => {
    expect(
      toRAGConfig({
        apiKey: 'key',
        baseUrl: 'https://api.example.com/v1',
        selectedModel: 'chat-model',
        embeddingModel: 'embed-model'
      })
    ).toEqual({
      apiKey: 'key',
      baseUrl: 'https://api.example.com/v1',
      model: 'chat-model',
      embeddingModel: 'embed-model'
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
