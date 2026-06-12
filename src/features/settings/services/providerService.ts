import type { ProviderConnectionResult, ProviderSaveInput } from '@/shared/types/ipc'

export type { ProviderConnectionResult }

export interface ProviderConnectionInput {
  baseUrl: string
  apiKey: string
  requiresApiKey: boolean
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function validateProviderConnection(input: ProviderConnectionInput): string | null {
  if (input.requiresApiKey && !input.apiKey.trim()) return 'API key is required.'
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  if (!baseUrl) return 'Base URL is required.'
  try {
    const url = new URL(baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return 'Base URL must use HTTP or HTTPS.'
  } catch {
    return 'Base URL is not valid.'
  }
  return null
}

export function testProviderConnection(
  input: ProviderSaveInput
): Promise<ProviderConnectionResult> {
  return window.api.testProvider(input)
}
