import { describe, expect, it } from 'vitest'
import { validatePlugin } from '@/services/pluginExecutor'

describe('validatePlugin', () => {
  it('accepts a declarative plugin', () => {
    const result = validatePlugin({
      id: 'review',
      name: 'Review',
      version: '1.0.0',
      systemPrompt: 'Review code',
      fields: [{ id: 'diff', label: 'Diff', type: 'textarea', required: true }]
    })
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('rejects incomplete schemas', () => {
    const result = validatePlugin({ name: 'Broken', fields: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(2)
  })
})
