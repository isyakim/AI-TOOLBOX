import { ipcMain, type WebContents } from 'electron'
import type {
  AIChatEvent,
  AIChatStartPayload,
  ProviderConnectionResult,
  ProviderSaveInput
} from '../../src/shared/types/ipc'
import { resolveProvider } from './providerRepository'
import { parseSSEStream } from './sse'

const requests = new Map<string, AbortController>()

export function setupAIHandlers(): void {
  ipcMain.handle('ai:chat:start', async (event, payload: AIChatStartPayload) => {
    if (!isChatPayload(payload)) {
      return { success: false, error: apiError('INVALID_PAYLOAD', 'Invalid chat request.') }
    }
    const requestId = crypto.randomUUID()
    const controller = new AbortController()
    requests.set(requestId, controller)
    setImmediate(() => void streamChat(event.sender, requestId, payload, controller))
    return { success: true, requestId }
  })

  ipcMain.handle('ai:chat:abort', (_, requestId: unknown) => {
    if (typeof requestId !== 'string') return { success: false }
    requests.get(requestId)?.abort()
    return { success: true }
  })

  ipcMain.handle('ai:test-provider', async (_, input: unknown) => {
    if (!isProviderInput(input)) {
      return { success: false, message: 'Invalid provider configuration.', models: [] }
    }
    return testProvider(input)
  })
}

async function streamChat(
  sender: WebContents,
  requestId: string,
  payload: AIChatStartPayload,
  controller: AbortController
): Promise<void> {
  let fullText = ''
  try {
    const provider = await resolveProvider(payload.providerId)
    const timeout = setTimeout(() => controller.abort('timeout'), provider.timeoutMs)
    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: requestHeaders(provider.apiKey),
        body: JSON.stringify({
          model: provider.selectedModel,
          messages: payload.messages,
          stream: true,
          temperature: payload.temperature
        }),
        signal: controller.signal
      })
      if (!response.ok) throw await responseError(response)
      if (!response.body) throw new Error('Provider response body is unavailable.')

      for await (const token of parseSSEStream(response.body)) {
        fullText += token
        emit(sender, { requestId, type: 'token', token })
      }
      emit(sender, { requestId, type: 'complete', text: fullText })
    } finally {
      clearTimeout(timeout)
    }
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      emit(sender, { requestId, type: 'complete', text: fullText, aborted: true })
    } else {
      emit(sender, {
        requestId,
        type: 'error',
        error: apiError('PROVIDER_REQUEST_FAILED', errorMessage(error))
      })
    }
  } finally {
    requests.delete(requestId)
  }
}

async function testProvider(input: ProviderSaveInput): Promise<ProviderConnectionResult> {
  try {
    const baseUrl = input.baseUrl.replace(/\/+$/, '')
    const endpoint =
      input.kind === 'ollama' ? `${baseUrl.replace(/\/v1$/, '')}/api/tags` : `${baseUrl}/models`
    const response = await fetch(endpoint, {
      headers: input.kind === 'ollama' ? undefined : requestHeaders(input.apiKey || ''),
      signal: AbortSignal.timeout(Math.min(input.timeoutMs || 15000, 30000))
    })
    if (!response.ok) throw await responseError(response)
    const payload = (await response.json().catch(() => ({}))) as {
      models?: Array<{ name?: string }>
      data?: Array<{ id?: string }>
    }
    const models =
      input.kind === 'ollama'
        ? payload.models?.map((model) => model.name || '').filter(Boolean)
        : payload.data?.map((model) => model.id || '').filter(Boolean)
    return { success: true, message: 'Connection succeeded.', models: models || [] }
  } catch (error: unknown) {
    return { success: false, message: errorMessage(error), models: [] }
  }
}

function requestHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  }
}

async function responseError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
  return new Error(payload.error?.message || `Provider returned HTTP ${response.status}.`)
}

function emit(sender: WebContents, event: AIChatEvent): void {
  if (!sender.isDestroyed()) sender.send('ai:chat:event', event)
}

function isChatPayload(value: unknown): value is AIChatStartPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<AIChatStartPayload>
  return typeof payload.providerId === 'string' && Array.isArray(payload.messages)
}

function isProviderInput(value: unknown): value is ProviderSaveInput {
  if (!value || typeof value !== 'object') return false
  const input = value as Partial<ProviderSaveInput>
  return Boolean(
    input.providerId &&
    input.providerName &&
    input.baseUrl &&
    input.kind &&
    typeof input.requiresApiKey === 'boolean'
  )
}

function apiError(code: string, message: string) {
  return { code, message }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown provider error.'
}
