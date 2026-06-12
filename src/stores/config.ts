import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import providersData from '@/data/providers.json'
import { createAIClient, destroyAIClient } from '@/services/aiClient'
import type { ProviderKind, ProviderPublicConfig, ProviderSaveInput } from '@/shared/types/ipc'

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
  models: ModelOption[]
  kind: ProviderKind
  requiresApiKey: boolean
  defaultEmbeddingModel: string
}

export type APIConfig = ProviderPublicConfig
export const PROVIDERS = providersData as Provider[]

export const useConfigStore = defineStore('config', () => {
  const configs = ref<APIConfig[]>([])
  const activeConfigId = ref<string | null>(null)
  const activeConfig = computed(
    () => configs.value.find((config) => config.id === activeConfigId.value) || null
  )
  const isReady = computed(() =>
    Boolean(activeConfig.value?.baseUrl && activeConfig.value.hasCredential)
  )
  const currentProvider = computed(() =>
    activeConfig.value
      ? PROVIDERS.find((provider) => provider.id === activeConfig.value?.providerId) || null
      : null
  )

  watch(
    activeConfig,
    (config) => {
      if (config && isReady.value) createAIClient(config.id)
      else destroyAIClient()
    },
    { immediate: true }
  )

  async function addConfig(input: ProviderSaveInput): Promise<string> {
    const config = await window.api.saveProviderConfig(input)
    configs.value.push(config)
    if (!activeConfigId.value) await setActiveConfig(config.id)
    return config.id
  }

  async function updateConfig(id: string, updates: ProviderSaveInput): Promise<void> {
    const config = await window.api.saveProviderConfig({ ...updates, id })
    const index = configs.value.findIndex((item) => item.id === id)
    if (index >= 0) configs.value[index] = config
  }

  async function deleteConfig(id: string): Promise<void> {
    const state = await window.api.deleteProviderConfig(id)
    configs.value = state.configs
    activeConfigId.value = state.activeConfigId
  }

  async function setActiveConfig(id: string): Promise<void> {
    const state = await window.api.setActiveProviderConfig(id)
    configs.value = state.configs
    activeConfigId.value = state.activeConfigId
  }

  async function loadFromStorage(): Promise<void> {
    let state = await window.api.listProviderConfigs()
    if (!state.configs.length) {
      const legacyJson = localStorage.getItem('ai-toolbox-configs')
      if (legacyJson) {
        const legacyConfigs = JSON.parse(legacyJson) as Array<Record<string, unknown>>
        for (const legacy of legacyConfigs) {
          await window.api.saveProviderConfig({
            id: String(legacy.id || crypto.randomUUID()),
            providerId: String(legacy.providerId || 'openai-compatible'),
            providerName: String(legacy.providerName || 'OpenAI Compatible'),
            kind: 'openai-compatible',
            baseUrl: String(legacy.baseUrl || ''),
            apiKey: String(legacy.apiKey || ''),
            models: Array.isArray(legacy.models) ? legacy.models.map(String) : [],
            selectedModel: String(legacy.selectedModel || ''),
            embeddingModel: String(legacy.embeddingModel || 'text-embedding-3-small'),
            requiresApiKey: true,
            timeoutMs: 120000,
            isActive: legacy.isActive !== false
          })
        }
        const legacyActiveId = localStorage.getItem('ai-toolbox-active-config')
        if (legacyActiveId) await window.api.setActiveProviderConfig(legacyActiveId)
        localStorage.removeItem('ai-toolbox-configs')
        localStorage.removeItem('ai-toolbox-active-config')
        state = await window.api.listProviderConfigs()
      }
    }
    configs.value = state.configs
    activeConfigId.value = state.activeConfigId
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
