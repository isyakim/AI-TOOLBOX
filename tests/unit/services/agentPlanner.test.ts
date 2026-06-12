import { beforeEach, describe, expect, it, vi } from 'vitest'

const chat = vi.fn()
vi.mock('@/services/aiClient', () => ({ getAIClient: () => ({ chat }) }))

import { generateAgentPlan } from '@/services/agentPlanner'

describe('agentPlanner', () => {
  beforeEach(() => chat.mockReset())

  it('accepts only a structured plan response', async () => {
    chat.mockResolvedValue('{"steps":["Inspect the module","Add focused tests"]}')
    await expect(generateAgentPlan('Fix the module', null)).resolves.toEqual([
      'Inspect the module',
      'Add focused tests'
    ])
    expect(chat.mock.calls[0][0][0].content).toContain('plan only')
  })

  it('rejects non-plan model output', async () => {
    chat.mockResolvedValue('I changed the files for you.')
    await expect(generateAgentPlan('Fix it', null)).rejects.toThrow('structured plan')
  })
})
