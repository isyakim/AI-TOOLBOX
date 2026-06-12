import { computed, ref, watch } from 'vue'
import {
  normalizeBaseUrl,
  testProviderConnection,
  validateProviderConnection,
  type ProviderConnectionResult
} from '@/features/settings/services/providerService'
import { PROVIDERS, useConfigStore } from '@/stores/config'

export function useProviderConfigForm() {
  const configStore = useConfigStore()
  const selectedProviderId = ref(PROVIDERS[0]?.id || '')
  const form = ref({
    baseUrl: '',
    apiKey: '',
    model: '',
    embeddingModel: 'text-embedding-3-small'
  })
  const testResult = ref<ProviderConnectionResult | null>(null)
  const statusMessage = ref('')
  const isTesting = ref(false)
  const isSaving = ref(false)
  const selectedProvider = computed(
    () => PROVIDERS.find((provider) => provider.id === selectedProviderId.value) || PROVIDERS[0]
  )
  const availableModels = computed(() => selectedProvider.value?.models || [])
  const validationError = computed(() => validateProviderConnection(form.value))
  const canSave = computed(() => !validationError.value && Boolean(form.value.model.trim()))

  watch(
    selectedProviderId,
    () => {
      form.value = {
        baseUrl: selectedProvider.value.baseURL,
        apiKey: '',
        model: selectedProvider.value.models[0]?.value || '',
        embeddingModel: 'text-embedding-3-small'
      }
      testResult.value = null
      statusMessage.value = ''
    },
    { immediate: true }
  )

  async function testConnection() {
    isTesting.value = true
    testResult.value = null
    try {
      testResult.value = await testProviderConnection(form.value)
    } finally {
      isTesting.value = false
    }
  }

  function saveConfig() {
    if (!canSave.value) {
      statusMessage.value = validationError.value || 'Model is required.'
      return
    }
    isSaving.value = true
    const baseUrl = normalizeBaseUrl(form.value.baseUrl)
    const duplicate = configStore.configs.find(
      (config) =>
        config.providerId === selectedProviderId.value &&
        normalizeBaseUrl(config.baseUrl) === baseUrl
    )
    const data = {
      providerId: selectedProviderId.value,
      providerName: selectedProvider.value.name,
      baseUrl,
      apiKey: form.value.apiKey.trim(),
      models: [form.value.model.trim()],
      selectedModel: form.value.model.trim(),
      embeddingModel: form.value.embeddingModel.trim() || 'text-embedding-3-small',
      isActive: true
    }

    if (duplicate) {
      configStore.updateConfig(duplicate.id, data)
      configStore.setActiveConfig(duplicate.id)
      statusMessage.value = 'Existing provider configuration updated.'
    } else {
      const id = configStore.addConfig(data)
      configStore.setActiveConfig(id)
      statusMessage.value = 'Provider configuration saved.'
    }

    form.value.apiKey = ''
    testResult.value = null
    isSaving.value = false
  }

  function openDocs() {
    const docs = selectedProvider.value.docs
    if (docs && docs !== '#') window.open(docs, '_blank')
  }

  return {
    selectedProviderId,
    form,
    testResult,
    statusMessage,
    isTesting,
    isSaving,
    selectedProvider,
    availableModels,
    validationError,
    canSave,
    testConnection,
    saveConfig,
    openDocs
  }
}
