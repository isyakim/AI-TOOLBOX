export interface ProviderConnectionInput {
  baseUrl: string
  apiKey: string
}

export interface ProviderConnectionResult {
  success: boolean
  message: string
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function validateProviderConnection(input: ProviderConnectionInput): string | null {
  if (!input.apiKey.trim()) return 'API key is required.'
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

export async function testProviderConnection(
  input: ProviderConnectionInput
): Promise<ProviderConnectionResult> {
  const validationError = validateProviderConnection(input)
  if (validationError) return { success: false, message: validationError }

  try {
    const response = await fetch(`${normalizeBaseUrl(input.baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${input.apiKey.trim()}` }
    })
    if (response.ok) return { success: true, message: 'Connection succeeded.' }

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    return {
      success: false,
      message: payload.error?.message || `Provider returned HTTP ${response.status}.`
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed.'
    }
  }
}
