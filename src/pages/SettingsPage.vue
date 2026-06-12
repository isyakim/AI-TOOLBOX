<script setup lang="ts">
import { ref } from 'vue'
import ProviderConfigForm from '@/components/settings/ProviderConfigForm.vue'
import ProviderConfigList from '@/components/settings/ProviderConfigList.vue'
import { useProviderConfigForm } from '@/features/settings/composables/useProviderConfigForm'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { PROVIDERS, useConfigStore, type APIConfig } from '@/stores/config'

const configStore = useConfigStore()
const providerForm = useProviderConfigForm()
const pendingDelete = ref<APIConfig | null>(null)

function deleteConfig() {
  if (pendingDelete.value) configStore.deleteConfig(pendingDelete.value.id)
  pendingDelete.value = null
}
</script>

<template>
  <div class="settings-page">
    <header class="page-header">
      <div>
        <p>MODEL ACCESS</p>
        <h1>Provider settings</h1>
      </div>
      <span>{{ configStore.isReady ? 'Provider ready' : 'Configuration required' }}</span>
    </header>

    <main class="settings-grid">
      <ProviderConfigForm
        v-model:selected-provider-id="providerForm.selectedProviderId.value"
        v-model:form="providerForm.form.value"
        :providers="PROVIDERS"
        :selected-provider="providerForm.selectedProvider.value"
        :models="providerForm.availableModels.value"
        :test-result="providerForm.testResult.value"
        :status-message="providerForm.statusMessage.value"
        :is-testing="providerForm.isTesting.value"
        :is-saving="providerForm.isSaving.value"
        :can-save="providerForm.canSave.value"
        @test="providerForm.testConnection"
        @save="providerForm.saveConfig"
        @docs="providerForm.openDocs"
      />
      <ProviderConfigList
        :configs="configStore.configs"
        :active-config-id="configStore.activeConfigId"
        @activate="configStore.setActiveConfig"
        @delete="pendingDelete = $event"
      />
    </main>
  </div>

  <ConfirmDialog
    :open="Boolean(pendingDelete)"
    title="Delete provider configuration"
    :message="`Delete ${pendingDelete?.providerName || 'this provider'} from local secure storage?`"
    confirm-label="Delete configuration"
    destructive
    @confirm="deleteConfig"
    @cancel="pendingDelete = null"
  />
</template>

<style scoped>
.settings-page {
  height: 100%;
  overflow: auto;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #f8fafc;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.page-header p,
.page-header h1 {
  margin: 0;
}

.page-header p,
.page-header > span {
  color: var(--text-light);
  font-size: 0.72rem;
  font-weight: 700;
}

.settings-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.8fr) minmax(360px, 1.2fr);
  gap: 14px;
  align-items: start;
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
