import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeBaseUrl,
  testProviderConnection,
  validateProviderConnection
} from '@/features/settings/services/providerService'

describe('providerService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes and validates provider URLs', () => {
    expect(normalizeBaseUrl(' https://api.example.com/v1/// ')).toBe('https://api.example.com/v1')
    expect(validateProviderConnection({ baseUrl: 'file:///tmp', apiKey: 'key' })).toContain('HTTP')
    expect(validateProviderConnection({ baseUrl: 'https://api.example.com/v1', apiKey: '' })).toBe(
      'API key is required.'
    )
  })

  it('returns a provider error without throwing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid key' } })
    } as Response)

    await expect(
      testProviderConnection({ baseUrl: 'https://api.example.com/v1/', apiKey: 'bad' })
    ).resolves.toEqual({ success: false, message: 'Invalid key' })
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/v1/models', expect.any(Object))
  })
})
