import { getAIClient } from './aiClient'
import type { ProjectMap } from '@/shared/types/ipc'

export async function generateAgentPlan(objective: string, projectMap: ProjectMap | null) {
  const client = getAIClient()
  if (!client) throw new Error('Configure an AI provider before generating a plan.')
  const context = projectMap
    ? `Entry files: ${projectMap.entryFiles.join(', ') || 'unknown'}\nHotspots: ${
        projectMap.hotspots
          .slice(0, 8)
          .map((item) => `${item.path} (${item.reason})`)
          .join(', ') || 'none'
      }`
    : 'No Project Map is available. Keep the plan conservative and request inspection where needed.'
  const output = await client.chat(
    [
      {
        role: 'system',
        content:
          'Create an implementation plan only. Do not propose file contents, shell commands, patches, or file-action blocks. Return strict JSON with shape {"steps":["..."]}. Each step must be concrete and independently reviewable.'
      },
      { role: 'user', content: `Objective:\n${objective}\n\nProject context:\n${context}` }
    ],
    {},
    { temperature: 0.2 }
  )
  const json = output.match(/\{[\s\S]*\}/)?.[0]
  if (!json) throw new Error('The provider did not return a structured plan.')
  const parsed: unknown = JSON.parse(json)
  if (!isRecord(parsed) || !Array.isArray(parsed.steps))
    throw new Error('The provider returned an invalid plan schema.')
  const steps = parsed.steps.filter(
    (step): step is string => typeof step === 'string' && Boolean(step.trim())
  )
  if (!steps.length) throw new Error('The provider returned an empty plan.')
  return steps
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
