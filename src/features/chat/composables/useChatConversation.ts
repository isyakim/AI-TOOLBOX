import { ref } from 'vue'
import { buildConversationMessages } from '@/features/chat/services/messageBuilder'
import type { MessageImage } from '@/features/chat/types'
import { getAIClient } from '@/services/aiClient'
import { RAGService, type RAGCitation } from '@/services/ragService'
import { useChatStore } from '@/stores/chat'
import { useConfigStore } from '@/stores/config'
import { useWorkspaceStore } from '@/stores/workspace'
import type { ImageInfo } from '@/utils/imageUtils'

export function useChatConversation() {
  const chatStore = useChatStore()
  const configStore = useConfigStore()
  const workspaceStore = useWorkspaceStore()
  const errorMessage = ref('')

  async function send(text: string, images: ImageInfo[] = []) {
    errorMessage.value = ''
    const sessionId = chatStore.activeSessionId || chatStore.createSession()

    if (!configStore.isReady || !configStore.activeConfig) {
      recordLocalInput(sessionId, text, images)
      return
    }

    const aiClient = getAIClient()
    if (!aiClient) {
      errorMessage.value = 'The active provider is not ready.'
      return
    }

    const messageImages: MessageImage[] = images.map((image) => ({
      url: image.url,
      base64: image.base64,
      type: image.type
    }))
    chatStore.addMessage(
      sessionId,
      {
        role: 'user',
        content: text,
        images: messageImages.length ? messageImages : undefined
      },
      false
    )
    const assistantMessageId = chatStore.addMessage(
      sessionId,
      { role: 'assistant', content: '' },
      false
    )
    if (!assistantMessageId) return

    chatStore.setStreaming(assistantMessageId)
    try {
      const citations = await loadCitations(text)
      chatStore.updateMessageCitations(sessionId, assistantMessageId, citations)
      const session = chatStore.sessions.find((item) => item.id === sessionId)
      if (!session) return

      await aiClient.chat(
        buildConversationMessages({
          role: chatStore.currentRole,
          citations,
          messages: session.messages,
          assistantMessageId,
          settings: chatStore.settings
        }),
        {
          onToken: (token) => chatStore.appendMessageToken(sessionId, assistantMessageId, token),
          onError: (error) => {
            errorMessage.value = error.message
            chatStore.updateMessage(sessionId, assistantMessageId, `Error: ${error.message}`, false)
          }
        },
        { temperature: chatStore.settings.temperature }
      )
    } catch (error: unknown) {
      errorMessage.value = error instanceof Error ? error.message : 'The request failed.'
      const message = chatStore.sessions
        .find((session) => session.id === sessionId)
        ?.messages.find((item) => item.id === assistantMessageId)
      if (message && !message.content) {
        chatStore.updateMessage(
          sessionId,
          assistantMessageId,
          `Error: ${errorMessage.value}`,
          false
        )
      }
    } finally {
      chatStore.setStreaming(null)
      chatStore.persist()
    }
  }

  function stop() {
    getAIClient()?.abort()
    chatStore.setStreaming(null)
    chatStore.persist()
  }

  async function continueFromTool(result: string) {
    await send(`[Tool execution result]\n${result}\n\nContinue from this result.`)
  }

  async function loadCitations(query: string): Promise<RAGCitation[]> {
    const projectId = chatStore.activeSession?.projectId || workspaceStore.activeProjectId
    if (!chatStore.settings.useRAG || !configStore.activeConfig || !projectId || !query.trim())
      return []
    try {
      const response = await RAGService.query(projectId, query, configStore.activeConfig)
      return response.success ? RAGService.mapResultsToCitations(response.results) : []
    } catch (error: unknown) {
      errorMessage.value =
        error instanceof Error
          ? `Project context unavailable: ${error.message}`
          : 'Project context unavailable.'
      return []
    }
  }

  function recordLocalInput(sessionId: string, text: string, images: ImageInfo[]) {
    chatStore.addMessage(sessionId, {
      role: 'user',
      content: text.trim() || '[Image message]',
      images: images.length
        ? images.map((image) => ({ url: image.url, base64: image.base64, type: image.type }))
        : undefined
    })
    chatStore.addMessage(sessionId, {
      role: 'system',
      content:
        'Provider not configured. The input was saved locally; add a provider in Settings to receive AI responses.'
    })
  }

  return { errorMessage, send, stop, continueFromTool }
}
