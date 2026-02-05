import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ThemeConfig {
  // 主色调 HSL
  primaryHue: number        // 0-360
  primarySaturation: number // 0-100
  primaryLightness: number  // 0-100
  
  // 表面颜色
  surfaceHue: number
  surfaceSaturation: number
  surfaceLightness: number
  
  // 毛玻璃效果
  glassBlur: number         // 0-30 px
  glassOpacity: number      // 0-100 %
  glassSaturation: number   // 0-200 % (backdrop-filter: saturate)
  
  // 暗色模式
  isDark: boolean
  
  // 圆角大小
  borderRadius: number      // 0-24 px
  
  // 预设名称
  presetName: string
}

// 预设主题
export const THEME_PRESETS: Record<string, Partial<ThemeConfig>> = {
  default: {
    presetName: '经典蓝',
    primaryHue: 221,
    primarySaturation: 83,
    primaryLightness: 53,
    surfaceHue: 220,
    surfaceSaturation: 14,
    surfaceLightness: 96,
    glassBlur: 12,
    glassOpacity: 85,
    glassSaturation: 120,
    isDark: false,
    borderRadius: 12
  },
  purple: {
    presetName: '梦幻紫',
    primaryHue: 270,
    primarySaturation: 76,
    primaryLightness: 55,
    surfaceHue: 270,
    surfaceSaturation: 10,
    surfaceLightness: 97,
    glassBlur: 16,
    glassOpacity: 80,
    glassSaturation: 140,
    isDark: false,
    borderRadius: 16
  },
  emerald: {
    presetName: '翡翠绿',
    primaryHue: 160,
    primarySaturation: 84,
    primaryLightness: 39,
    surfaceHue: 160,
    surfaceSaturation: 8,
    surfaceLightness: 96,
    glassBlur: 10,
    glassOpacity: 88,
    glassSaturation: 110,
    isDark: false,
    borderRadius: 10
  },
  sunset: {
    presetName: '日落橙',
    primaryHue: 25,
    primarySaturation: 95,
    primaryLightness: 53,
    surfaceHue: 30,
    surfaceSaturation: 12,
    surfaceLightness: 97,
    glassBlur: 14,
    glassOpacity: 82,
    glassSaturation: 130,
    isDark: false,
    borderRadius: 14
  },
  rose: {
    presetName: '玫瑰红',
    primaryHue: 340,
    primarySaturation: 82,
    primaryLightness: 52,
    surfaceHue: 340,
    surfaceSaturation: 8,
    surfaceLightness: 97,
    glassBlur: 12,
    glassOpacity: 85,
    glassSaturation: 125,
    isDark: false,
    borderRadius: 12
  },
  dark: {
    presetName: '暗夜模式',
    primaryHue: 221,
    primarySaturation: 83,
    primaryLightness: 60,
    surfaceHue: 222,
    surfaceSaturation: 47,
    surfaceLightness: 11,
    glassBlur: 20,
    glassOpacity: 60,
    glassSaturation: 150,
    isDark: true,
    borderRadius: 12
  },
  midnight: {
    presetName: '午夜紫',
    primaryHue: 265,
    primarySaturation: 89,
    primaryLightness: 65,
    surfaceHue: 260,
    surfaceSaturation: 45,
    surfaceLightness: 8,
    glassBlur: 24,
    glassOpacity: 55,
    glassSaturation: 160,
    isDark: true,
    borderRadius: 16
  },
  forest: {
    presetName: '森林夜',
    primaryHue: 142,
    primarySaturation: 71,
    primaryLightness: 50,
    surfaceHue: 150,
    surfaceSaturation: 30,
    surfaceLightness: 10,
    glassBlur: 18,
    glassOpacity: 65,
    glassSaturation: 140,
    isDark: true,
    borderRadius: 10
  }
}

const DEFAULT_THEME: ThemeConfig = {
  ...THEME_PRESETS.default as ThemeConfig
}

export const useThemeStore = defineStore('theme', () => {
  // State
  const config = ref<ThemeConfig>({ ...DEFAULT_THEME })
  
  // Computed CSS Variables
  const cssVariables = computed(() => {
    const c = config.value
    const isDark = c.isDark
    
    // 计算主色调变体
    const primaryDark = Math.max(0, c.primaryLightness - 10)
    const primaryLight = Math.min(100, c.primaryLightness + 15)
    
    // 计算表面颜色变体
    const surfaceDark = isDark 
      ? Math.min(100, c.surfaceLightness + 5)
      : Math.max(0, c.surfaceLightness - 4)
    const surfaceLight = isDark
      ? Math.max(0, c.surfaceLightness - 3)
      : Math.min(100, c.surfaceLightness + 2)
    
    // 文字颜色
    const textColor = isDark ? 'hsl(0, 0%, 95%)' : 'hsl(222, 47%, 11%)'
    const textLight = isDark ? 'hsl(0, 0%, 70%)' : 'hsl(215, 16%, 47%)'
    
    // 边框颜色
    const borderColor = isDark 
      ? `hsla(${c.surfaceHue}, ${c.surfaceSaturation}%, 30%, 0.3)`
      : `hsla(${c.surfaceHue}, ${c.surfaceSaturation}%, 80%, 0.5)`
    
    return {
      '--primary': `hsl(${c.primaryHue}, ${c.primarySaturation}%, ${c.primaryLightness}%)`,
      '--primary-dark': `hsl(${c.primaryHue}, ${c.primarySaturation}%, ${primaryDark}%)`,
      '--primary-light': `hsl(${c.primaryHue}, ${c.primarySaturation}%, ${primaryLight}%)`,
      '--primary-hue': `${c.primaryHue}`,
      '--primary-sat': `${c.primarySaturation}%`,
      
      '--surface': `hsl(${c.surfaceHue}, ${c.surfaceSaturation}%, ${c.surfaceLightness}%)`,
      '--secondary': `hsl(${c.surfaceHue}, ${c.surfaceSaturation}%, ${surfaceDark}%)`,
      '--surface-light': `hsl(${c.surfaceHue}, ${c.surfaceSaturation}%, ${surfaceLight}%)`,
      
      '--text': textColor,
      '--text-light': textLight,
      '--border': borderColor,
      
      '--glass-blur': `${c.glassBlur}px`,
      '--glass-opacity': `${c.glassOpacity / 100}`,
      '--glass-saturation': `${c.glassSaturation}%`,
      '--glass-bg': isDark 
        ? `hsla(${c.surfaceHue}, ${c.surfaceSaturation}%, ${c.surfaceLightness + 5}%, ${c.glassOpacity / 100})`
        : `hsla(${c.surfaceHue}, ${c.surfaceSaturation}%, 100%, ${c.glassOpacity / 100})`,
      
      '--radius-sm': `${Math.max(4, c.borderRadius - 8)}px`,
      '--radius-md': `${Math.max(6, c.borderRadius - 4)}px`,
      '--radius-lg': `${c.borderRadius}px`,
      '--radius-xl': `${c.borderRadius + 4}px`,
      
      '--bg-gradient-start': isDark 
        ? `hsl(${c.surfaceHue}, ${c.surfaceSaturation + 10}%, ${c.surfaceLightness - 2}%)`
        : `hsl(${c.surfaceHue}, ${c.surfaceSaturation + 5}%, ${c.surfaceLightness}%)`,
      '--bg-gradient-end': isDark
        ? `hsl(${c.surfaceHue + 20}, ${c.surfaceSaturation}%, ${c.surfaceLightness + 3}%)`
        : `hsl(${c.surfaceHue + 10}, ${c.surfaceSaturation - 5}%, ${c.surfaceLightness - 2}%)`
    }
  })
  
  // Actions
  function updateTheme(updates: Partial<ThemeConfig>) {
    config.value = { ...config.value, ...updates }
    applyTheme()
    saveToStorage()
  }
  
  function applyPreset(presetId: string) {
    const preset = THEME_PRESETS[presetId]
    if (preset) {
      config.value = { ...DEFAULT_THEME, ...preset } as ThemeConfig
      applyTheme()
      saveToStorage()
    }
  }
  
  function resetTheme() {
    config.value = { ...DEFAULT_THEME }
    applyTheme()
    saveToStorage()
  }
  
  function applyTheme() {
    const root = document.documentElement
    const vars = cssVariables.value
    
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
    
    // 设置 color-scheme
    root.style.setProperty('color-scheme', config.value.isDark ? 'dark' : 'light')
    
    // 添加/移除暗色模式类
    if (config.value.isDark) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
  }
  
  function saveToStorage() {
    localStorage.setItem('ai-toolbox-theme-config', JSON.stringify(config.value))
  }
  
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('ai-toolbox-theme-config')
      if (saved) {
        config.value = { ...DEFAULT_THEME, ...JSON.parse(saved) }
      }
      applyTheme()
    } catch (e) {
      console.error('Failed to load theme:', e)
      resetTheme()
    }
  }
  
  // 导出主题配置
  function exportTheme(): string {
    return JSON.stringify(config.value, null, 2)
  }
  
  // 导入主题配置
  function importTheme(json: string): boolean {
    try {
      const imported = JSON.parse(json)
      config.value = { ...DEFAULT_THEME, ...imported }
      applyTheme()
      saveToStorage()
      return true
    } catch {
      return false
    }
  }
  
  return {
    config,
    cssVariables,
    updateTheme,
    applyPreset,
    resetTheme,
    applyTheme,
    loadFromStorage,
    exportTheme,
    importTheme
  }
})
