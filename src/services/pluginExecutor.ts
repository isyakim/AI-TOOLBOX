import { getAIClient, type ChatMessage } from './aiClient'
import type { Plugin } from '@/stores/plugins'

export interface PluginExecutionContext {
  plugin: Plugin
  inputs: Record<string, unknown>
  onToken?: (token: string) => void
  onProgress?: (stage: string) => void
}

export interface PluginExecutionResult {
  success: boolean
  rawOutput: string
  processedOutput: string
  error?: string
  executionTime: number
}

function buildUserMessage(plugin: Plugin, inputs: Record<string, unknown>): string {
  return plugin.fields
    .flatMap((field) => {
      const value = inputs[field.id]
      return value === undefined || value === '' ? [] : [`**${field.label}**: ${String(value)}`]
    })
    .join('\n\n')
}

export async function executePlugin(ctx: PluginExecutionContext): Promise<PluginExecutionResult> {
  const startedAt = Date.now()
  const aiClient = getAIClient()

  if (!aiClient) {
    return {
      success: false,
      rawOutput: '',
      processedOutput: '',
      error: 'Configure an AI provider before running a plugin.',
      executionTime: 0
    }
  }

  try {
    ctx.onProgress?.('Generating...')
    const messages: ChatMessage[] = [
      { role: 'system', content: ctx.plugin.systemPrompt },
      { role: 'user', content: buildUserMessage(ctx.plugin, ctx.inputs) }
    ]
    let output = ''

    await aiClient.chat(messages, {
      onToken: (token) => {
        output += token
        ctx.onToken?.(token)
      }
    })

    return {
      success: true,
      rawOutput: output,
      processedOutput: output,
      executionTime: Date.now() - startedAt
    }
  } catch (error: unknown) {
    return {
      success: false,
      rawOutput: '',
      processedOutput: '',
      error: error instanceof Error ? error.message : 'Plugin execution failed.',
      executionTime: Date.now() - startedAt
    }
  }
}

export function cancelPluginExecution(): void {
  getAIClient()?.abort()
}

export function validatePlugin(plugin: Partial<Plugin>): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!plugin.id?.trim()) errors.push('Plugin ID is required.')
  if (!plugin.name?.trim()) errors.push('Plugin name is required.')
  if (!plugin.version?.trim()) errors.push('Plugin version is required.')
  if (!plugin.systemPrompt?.trim()) errors.push('System prompt is required.')
  if (!plugin.fields || plugin.fields.length === 0)
    errors.push('At least one input field is required.')

  plugin.fields?.forEach((field, index) => {
    if (!field.id?.trim()) errors.push(`Field ${index + 1} requires an ID.`)
    if (!field.label?.trim()) errors.push(`Field ${index + 1} requires a label.`)
    if (field.type === 'select' && !field.options?.length) {
      errors.push(`Field ${index + 1} requires select options.`)
    }
  })

  return { valid: errors.length === 0, errors }
}
