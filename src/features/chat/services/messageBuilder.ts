import type { ChatMessage, ContentPart } from '@/services/aiClient'
import type { RAGCitation } from '@/services/ragService'
import type { ChatSettings, Message, RoleMode } from '../types'
import { FILE_ACTION_PROMPT } from '../roles'

export function buildSystemPrompt(role: RoleMode, citations: RAGCitation[]): string {
  let prompt = `${role.prompt}\n${FILE_ACTION_PROMPT}`
  if (!citations.length) return prompt

  const context = citations
    .map((citation, index) => `[source ${index + 1}] ${citation.source}\n${citation.snippet}`)
    .join('\n---\n')

  prompt += `\n\nRelevant project knowledge:\n${context}\n\nUse this context when relevant and cite file paths naturally.`
  return prompt
}

export function selectContextMessages(
  messages: Message[],
  assistantMessageId: string,
  settings: ChatSettings
): Message[] {
  const count = settings.enableMemory ? settings.contextLength * 2 : 2
  return messages.slice(-count).filter((message) => message.id !== assistantMessageId)
}

export function toAIMessage(message: Message): ChatMessage {
  if (!message.images?.length) {
    return { role: message.role, content: message.content }
  }

  const content: ContentPart[] = [{ type: 'text', text: message.content }]
  for (const image of message.images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.type};base64,${image.base64}` }
    })
  }
  return { role: message.role, content }
}

export function buildConversationMessages(options: {
  role: RoleMode
  citations: RAGCitation[]
  messages: Message[]
  assistantMessageId: string
  settings: ChatSettings
}): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt(options.role, options.citations) },
    ...selectContextMessages(options.messages, options.assistantMessageId, options.settings).map(
      toAIMessage
    )
  ]
}
