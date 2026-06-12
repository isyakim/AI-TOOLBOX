import { describe, expect, it } from 'vitest'
import { parseSSEStream } from '../../../electron/main/sse'

function streamChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    }
  })
}

describe('parseSSEStream', () => {
  it('preserves JSON events split across network chunks', async () => {
    const stream = streamChunks([
      'data: {"choices":[{"delta":{"cont',
      'ent":"Hello"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n'
    ])
    const tokens: string[] = []
    for await (const token of parseSSEStream(stream)) tokens.push(token)
    expect(tokens).toEqual(['Hello', ' world'])
  })

  it('ignores malformed and terminal events', async () => {
    const stream = streamChunks(['data: not-json\n\ndata: [DONE]\n\n'])
    const tokens: string[] = []
    for await (const token of parseSSEStream(stream)) tokens.push(token)
    expect(tokens).toEqual([])
  })
})
