import { describe, expect, it } from 'vitest'
import { executePlugin, validatePlugin } from '@/services/pluginExecutor'

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

  it('enforces the ai:chat permission before provider access', async () => {
    const result = await executePlugin({
      plugin: {
        schemaVersion: 2,
        id: 'no-chat',
        name: 'No chat',
        icon: 'X',
        description: '',
        author: 'Test',
        version: '1.0.0',
        category: 'utility',
        systemPrompt: 'Test',
        fields: [],
        permissions: [],
        compatibleAppVersion: '>=2.0.0',
        permissionReasons: {},
        outputType: 'markdown',
        tags: [],
        createdAt: '',
        updatedAt: ''
      },
      inputs: {}
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('ai:chat')
  })
})
