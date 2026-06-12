import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AIClient } from '@/services/aiClient'
import type { AIChatEvent } from '@/shared/types/ipc'

describe('AIClient', () => {
  let eventHandler: ((event: AIChatEvent) => void) | undefined
  const unsubscribe = vi.fn()
  const startAIChat = vi.fn()
  const abortAIChat = vi.fn()

  beforeEach(() => {
    eventHandler = undefined
    unsubscribe.mockReset()
    startAIChat.mockReset().mockResolvedValue({ success: true, requestId: 'request-1' })
    abortAIChat.mockReset().mockResolvedValue({ success: true })
    Object.assign(window, {
      api: {
        startAIChat,
        abortAIChat,
        onAIChatEvent: vi.fn((callback: (event: AIChatEvent) => void) => {
          eventHandler = callback
          return unsubscribe
        })
      }
    })
  })

  it('sends only a provider ID and handles streamed main-process events', async () => {
    const client = new AIClient('provider-1')
    const tokens: string[] = []
    const result = client.chat(
      [{ role: 'user', content: 'Hello' }],
      { onToken: (token) => tokens.push(token) },
      { temperature: 0.4 }
    )
    await Promise.resolve()
    expect(startAIChat).toHaveBeenCalledWith({
      providerId: 'provider-1',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.4
    })
    expect(JSON.stringify(startAIChat.mock.calls[0])).not.toContain('apiKey')
    eventHandler?.({ requestId: 'request-1', type: 'token', token: 'Hi' })
    eventHandler?.({ requestId: 'request-1', type: 'complete', text: 'Hi' })
    await expect(result).resolves.toBe('Hi')
    expect(tokens).toEqual(['Hi'])
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('aborts the active request by request ID', async () => {
    const client = new AIClient('provider-1')
    const pending = client.chat([{ role: 'user', content: 'Hello' }])
    await Promise.resolve()
    client.abort()
    expect(abortAIChat).toHaveBeenCalledWith('request-1')
    eventHandler?.({ requestId: 'request-1', type: 'complete', text: '', aborted: true })
    await expect(pending).resolves.toBe('')
  })
})
