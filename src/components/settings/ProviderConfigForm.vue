<script setup lang="ts">
import type { ModelOption, Provider } from '@/stores/config'
import type { ProviderConnectionResult } from '@/features/settings/services/providerService'

const props = defineProps<{
  providers: Provider[]
  selectedProvider: Provider
  selectedProviderId: string
  form: { baseUrl: string; apiKey: string; model: string }
  models: ModelOption[]
  testResult: ProviderConnectionResult | null
  statusMessage: string
  isTesting: boolean
  isSaving: boolean
  canSave: boolean
}>()

const emit = defineEmits<{
  'update:selectedProviderId': [value: string]
  'update:form': [value: { baseUrl: string; apiKey: string; model: string }]
  test: []
  save: []
  docs: []
}>()

function updateForm(key: 'baseUrl' | 'apiKey' | 'model', value: string) {
  emit('update:form', { ...props.form, [key]: value })
}
</script>

<template>
  <section class="settings-section">
    <header>
      <p>PROVIDER</p>
      <h2>Add or update configuration</h2>
    </header>

    <div class="form-grid">
      <label>
        <span>Provider</span>
        <div class="provider-row">
          <select
            :value="selectedProviderId"
            @change="emit('update:selectedProviderId', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="provider in providers" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
          <button
            v-if="selectedProvider.docs !== '#'"
            title="Open provider docs"
            @click="emit('docs')"
          >
            Docs
          </button>
        </div>
        <small>{{ selectedProvider.desc }}</small>
      </label>

      <label>
        <span>Base URL</span>
        <input
          :value="form.baseUrl"
          type="url"
          placeholder="https://api.openai.com/v1"
          @input="updateForm('baseUrl', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label>
        <span>API key</span>
        <input
          :value="form.apiKey"
          type="password"
          autocomplete="off"
          placeholder="Provider API key"
          @input="updateForm('apiKey', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label>
        <span>Model</span>
        <select
          v-if="models.length"
          :value="form.model"
          @change="updateForm('model', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="model in models" :key="model.value" :value="model.value">
            {{ model.label }}
          </option>
        </select>
        <input
          v-else
          :value="form.model"
          placeholder="Model name"
          @input="updateForm('model', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <p v-if="testResult" class="result" :class="{ success: testResult.success }">
      {{ testResult.message }}
    </p>
    <p v-if="statusMessage" class="status">{{ statusMessage }}</p>

    <footer>
      <button :disabled="isTesting" @click="emit('test')">
        {{ isTesting ? 'Testing...' : 'Test connection' }}
      </button>
      <button class="primary" :disabled="!canSave || isSaving" @click="emit('save')">
        {{ isSaving ? 'Saving...' : 'Save configuration' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.settings-section {
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
}

header p,
header h2 {
  margin: 0;
}

header p {
  color: var(--text-light);
  font-size: 0.68rem;
  font-weight: 700;
}

.form-grid {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

label {
  display: grid;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
}

input,
select,
button {
  min-height: 38px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  font: inherit;
}

input,
select {
  width: 100%;
  padding: 0 10px;
}

.provider-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 7px;
}

.provider-row button,
footer button {
  padding: 0 12px;
  cursor: pointer;
}

small,
.status {
  color: var(--text-light);
  font-weight: 400;
}

.result,
.status {
  margin: 12px 0 0;
  padding: 9px 10px;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.78rem;
}

.result.success,
.status {
  background: #f0fdf4;
  color: #15803d;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

footer .primary {
  border-color: var(--primary);
  background: var(--primary);
  color: #ffffff;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
