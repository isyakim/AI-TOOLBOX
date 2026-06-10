import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { createAIClient, destroyAIClient } from '@/services/aiClient'
import providersData from '@/data/providers.json'

export interface ModelOption {
  value: string
  label: string
}

export interface Provider {
  id: string
  name: string
  desc: string
  baseURL: string
  docs: string
  endpoint: string
  models: ModelOption[]
  custom?: boolean
}

export interface APIConfig {
  id: string
  providerId: string
  providerName: string
  baseUrl: string
  apiKey: string
  models: string[]
  selectedModel: string
  isActive: boolean
}

// 从 JSON 加载服务商数据
export const PROVIDERS: Provider[] = providersData as Provider[]

export const useConfigStore = defineStore('config', () => {
  // State
  const configs = ref<APIConfig[]>([])
  const activeConfigId = ref<string | null>(null)

  // Getters
  const activeConfig = computed(
    () => configs.value.find((c) => c.id === activeConfigId.value) || null
  )

  const isReady = computed(
    () =>
      activeConfig.value !== null &&
      activeConfig.value.apiKey.length > 0 &&
      activeConfig.value.baseUrl.length > 0
  )

  const currentProvider = computed(() =>
    activeConfig.value
      ? PROVIDERS.find((p) => p.id === activeConfig.value?.providerId) || null
      : null
  )

  // Watch for config changes to update AI Client
  watch(
    activeConfig,
    (config) => {
      if (config && config.apiKey && config.baseUrl) {
        createAIClient({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          model: config.selectedModel || 'gpt-4'
        })
      } else {
        destroyAIClient()
      }
    },
    { immediate: true }
  )

  // Actions
  function addConfig(config: Omit<APIConfig, 'id'>) {
    const id = crypto.randomUUID()
    configs.value.push({ ...config, id })
    if (!activeConfigId.value) {
      activeConfigId.value = id
    }
    void saveToStorage()
    return id
  }

  function updateConfig(id: string, updates: Partial<APIConfig>) {
    const index = configs.value.findIndex((c) => c.id === id)
    if (index !== -1) {
      configs.value[index] = { ...configs.value[index], ...updates }
      void saveToStorage()
    }
  }

  function deleteConfig(id: string) {
    configs.value = configs.value.filter((c) => c.id !== id)
    if (activeConfigId.value === id) {
      activeConfigId.value = configs.value[0]?.id || null
    }
    void saveToStorage()
  }

  function setActiveConfig(id: string) {
    activeConfigId.value = id
    void saveToStorage()
  }

  async function saveToStorage() {
    await window.api.setConfig('provider-config', {
      configs: configs.value,
      activeConfigId: activeConfigId.value
    })
  }

  async function loadFromStorage() {
    try {
      const stored = (await window.api.getConfig('provider-config')) as
        | {
            configs?: APIConfig[]
            activeConfigId?: string | null
          }
        | undefined

      if (stored?.configs) {
        configs.value = stored.configs
        activeConfigId.value = stored.activeConfigId || null
        return
      }

      const legacyConfigs = localStorage.getItem('ai-toolbox-configs')
      if (legacyConfigs) {
        configs.value = JSON.parse(legacyConfigs) as APIConfig[]
        activeConfigId.value = localStorage.getItem('ai-toolbox-active-config') || null
        await saveToStorage()
        localStorage.removeItem('ai-toolbox-configs')
        localStorage.removeItem('ai-toolbox-active-config')
      }
    } catch {
      configs.value = []
      activeConfigId.value = null
    }
  }

  return {
    configs,
    activeConfigId,
    activeConfig,
    isReady,
    currentProvider,
    addConfig,
    updateConfig,
    deleteConfig,
    setActiveConfig,
    loadFromStorage
  }
})
