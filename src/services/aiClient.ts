import type { AIChatEvent, ChatMessage, ContentPart } from '@/shared/types/ipc'

export type { ChatMessage, ContentPart }

export interface StreamCallbacks {
  onStart?: () => void
  onToken?: (token: string) => void
  onComplete?: (fullText: string) => void
  onError?: (error: Error) => void
}

export interface ChatRequestOptions {
  temperature?: number
}

export class AIClient {
  private providerId: string
  private requestId: string | null = null

  constructor(providerId: string) {
    this.providerId = providerId
  }

  updateProvider(providerId: string): void {
    this.providerId = providerId
  }

  async chat(
    messages: ChatMessage[],
    callbacks: StreamCallbacks = {},
    options: ChatRequestOptions = {}
  ): Promise<string> {
    callbacks.onStart?.()
    return new Promise((resolve, reject) => {
      let expectedRequestId: string | null = null
      const queuedEvents: AIChatEvent[] = []

      const handleEvent = (event: AIChatEvent) => {
        if (!expectedRequestId) {
          queuedEvents.push(event)
          return
        }
        if (event.requestId !== expectedRequestId) return
        if (event.type === 'token') {
          callbacks.onToken?.(event.token)
          return
        }
        cleanup()
        this.requestId = null
        if (event.type === 'complete') {
          callbacks.onComplete?.(event.text)
          resolve(event.text)
        } else {
          const error = new Error(event.error.message)
          callbacks.onError?.(error)
          reject(error)
        }
      }
      const unsubscribe = window.api.onAIChatEvent(handleEvent)
      const cleanup = () => unsubscribe()

      void window.api
        .startAIChat({
          providerId: this.providerId,
          messages,
          temperature: options.temperature
        })
        .then((result) => {
          if (!result.success || !result.requestId) {
            cleanup()
            reject(new Error(result.error?.message || 'Unable to start provider request.'))
            return
          }
          expectedRequestId = result.requestId
          this.requestId = result.requestId
          queuedEvents.splice(0).forEach(handleEvent)
        })
        .catch((error: unknown) => {
          cleanup()
          reject(error instanceof Error ? error : new Error('Unable to start provider request.'))
        })
    })
  }

  abort(): void {
    if (this.requestId) void window.api.abortAIChat(this.requestId)
  }
}

let aiClientInstance: AIClient | null = null

export function getAIClient(): AIClient | null {
  return aiClientInstance
}

export function createAIClient(providerId: string): AIClient {
  if (aiClientInstance) aiClientInstance.updateProvider(providerId)
  else aiClientInstance = new AIClient(providerId)
  return aiClientInstance
}

export function destroyAIClient(): void {
  aiClientInstance?.abort()
  aiClientInstance = null
}
