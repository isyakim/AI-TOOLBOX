import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeBaseUrl,
  testProviderConnection,
  validateProviderConnection
} from '@/features/settings/services/providerService'

const providerInput = {
  providerId: 'ollama',
  providerName: 'Ollama',
  kind: 'ollama' as const,
  baseUrl: 'http://127.0.0.1:11434/v1',
  apiKey: '',
  models: [],
  selectedModel: 'qwen3',
  embeddingModel: 'nomic-embed-text',
  requiresApiKey: false,
  timeoutMs: 15000,
  isActive: true
}

describe('providerService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes URLs and permits API-key-free local providers', () => {
    expect(normalizeBaseUrl(' http://127.0.0.1:11434/v1/// ')).toBe('http://127.0.0.1:11434/v1')
    expect(
      validateProviderConnection({ baseUrl: 'file:///tmp', apiKey: '', requiresApiKey: false })
    ).toContain('HTTP')
    expect(
      validateProviderConnection({
        baseUrl: providerInput.baseUrl,
        apiKey: '',
        requiresApiKey: false
      })
    ).toBeNull()
    expect(
      validateProviderConnection({
        baseUrl: providerInput.baseUrl,
        apiKey: '',
        requiresApiKey: true
      })
    ).toBe('API key is required.')
  })

  it('delegates connection tests to the main-process API', async () => {
    Object.assign(window, {
      api: {
        testProvider: vi
          .fn()
          .mockResolvedValue({ success: true, message: 'Connection succeeded.', models: ['qwen3'] })
      }
    })
    await expect(testProviderConnection(providerInput)).resolves.toEqual({
      success: true,
      message: 'Connection succeeded.',
      models: ['qwen3']
    })
    expect(window.api.testProvider).toHaveBeenCalledWith(providerInput)
  })
})
