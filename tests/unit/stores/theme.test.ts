/**
 * 主题 Store 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore, THEME_PRESETS } from '@/stores/theme'

describe('Theme Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with default theme', () => {
    const store = useThemeStore()
    
    expect(store.config.primaryHue).toBe(221)
    expect(store.config.isDark).toBe(false)
    expect(store.config.presetName).toBe('经典蓝')
  })

  it('should update theme correctly', () => {
    const store = useThemeStore()
    
    store.updateTheme({ primaryHue: 270 })
    
    expect(store.config.primaryHue).toBe(270)
  })

  it('should apply preset correctly', () => {
    const store = useThemeStore()
    
    store.applyPreset('purple')
    
    expect(store.config.primaryHue).toBe(270)
    expect(store.config.presetName).toBe('梦幻紫')
  })

  it('should reset theme to default', () => {
    const store = useThemeStore()
    
    store.updateTheme({ primaryHue: 100, isDark: true })
    store.resetTheme()
    
    expect(store.config.primaryHue).toBe(221)
    expect(store.config.isDark).toBe(false)
  })

  it('should generate correct CSS variables', () => {
    const store = useThemeStore()
    
    const vars = store.cssVariables
    
    expect(vars['--primary']).toContain('hsl(221')
    expect(vars['--glass-blur']).toBe('12px')
    expect(vars['--radius-lg']).toBe('12px')
  })

  it('should export theme as JSON', () => {
    const store = useThemeStore()
    
    const json = store.exportTheme()
    const parsed = JSON.parse(json)
    
    expect(parsed.primaryHue).toBe(221)
    expect(parsed.presetName).toBe('经典蓝')
  })

  it('should import valid theme JSON', () => {
    const store = useThemeStore()
    
    const success = store.importTheme('{"primaryHue": 180, "presetName": "自定义"}')
    
    expect(success).toBe(true)
    expect(store.config.primaryHue).toBe(180)
  })

  it('should reject invalid theme JSON', () => {
    const store = useThemeStore()
    
    const success = store.importTheme('invalid json')
    
    expect(success).toBe(false)
  })

  it('should have all preset themes defined', () => {
    const presetIds = Object.keys(THEME_PRESETS)
    
    expect(presetIds).toContain('default')
    expect(presetIds).toContain('dark')
    expect(presetIds).toContain('purple')
    expect(presetIds.length).toBeGreaterThanOrEqual(6)
  })

  it('should toggle dark mode correctly', () => {
    const store = useThemeStore()
    
    expect(store.config.isDark).toBe(false)
    
    store.updateTheme({ isDark: true })
    expect(store.config.isDark).toBe(true)
    
    store.updateTheme({ isDark: false })
    expect(store.config.isDark).toBe(false)
  })

  it('should update glass blur settings', () => {
    const store = useThemeStore()
    
    store.updateTheme({ glassBlur: 20, glassOpacity: 70 })
    
    expect(store.config.glassBlur).toBe(20)
    expect(store.config.glassOpacity).toBe(70)
    expect(store.cssVariables['--glass-blur']).toBe('20px')
  })
})
