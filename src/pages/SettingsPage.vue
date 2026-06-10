<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useConfigStore, PROVIDERS } from '@/stores'

const configStore = useConfigStore()

// Form state
const selectedProviderId = ref('openai')
const formData = ref({
  baseUrl: '',
  apiKey: '',
  model: ''
})

const testResult = ref<{ success: boolean; message: string } | null>(null)
const isTesting = ref(false)
const isSaving = ref(false)

const selectedProvider = computed(
  () => PROVIDERS.find((p) => p.id === selectedProviderId.value) || PROVIDERS[0]
)

const availableModels = computed(() => selectedProvider.value?.models || [])

// 当选择服务商时更新表单
watch(
  selectedProviderId,
  (providerId) => {
    const provider = PROVIDERS.find((p) => p.id === providerId)
    if (provider) {
      formData.value.baseUrl = provider.baseURL
      formData.value.model = provider.models[0]?.value || ''
    }
  },
  { immediate: true }
)

// 测试连接
async function testConnection() {
  if (!formData.value.apiKey || !formData.value.baseUrl) {
    testResult.value = { success: false, message: '请填写 API Key 和 Base URL' }
    return
  }

  isTesting.value = true
  testResult.value = null

  try {
    const response = await fetch(`${formData.value.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${formData.value.apiKey}`
      }
    })

    if (response.ok) {
      testResult.value = { success: true, message: '连接成功！' }
    } else {
      const error = await response.json().catch(() => ({}))
      testResult.value = {
        success: false,
        message: error.error?.message || `HTTP ${response.status}`
      }
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: error instanceof Error ? error.message : '连接失败'
    }
  } finally {
    isTesting.value = false
  }
}

// 保存配置
function saveConfig() {
  if (!formData.value.apiKey || !formData.value.baseUrl) {
    return
  }

  isSaving.value = true

  const configData = {
    providerId: selectedProviderId.value,
    providerName: selectedProvider.value.name,
    baseUrl: formData.value.baseUrl,
    apiKey: formData.value.apiKey,
    models: [formData.value.model],
    selectedModel: formData.value.model,
    isActive: true
  }

  configStore.addConfig(configData)

  // Reset form
  formData.value = {
    baseUrl: selectedProvider.value.baseURL,
    apiKey: '',
    model: selectedProvider.value.models[0]?.value || ''
  }
  testResult.value = null
  isSaving.value = false
}

// 删除配置
function deleteConfig(id: string) {
  if (confirm('确定要删除这个配置吗？')) {
    configStore.deleteConfig(id)
  }
}

// 切换活跃配置
function activateConfig(id: string) {
  configStore.setActiveConfig(id)
}

function openDocs() {
  if (selectedProvider.value.docs && selectedProvider.value.docs !== '#') {
    window.open(selectedProvider.value.docs, '_blank')
  }
}
</script>

<template>
  <div class="settings-page">
    <div class="settings-header">
      <h2>⚙️ 设置</h2>
      <p class="subtitle">配置 AI 服务商的 API 密钥和端点</p>
    </div>

    <div class="settings-grid">
      <!-- API 配置表单 -->
      <section class="settings-section">
        <h3>➕ 添加配置</h3>

        <div class="config-form">
          <!-- 服务商选择 -->
          <div class="form-group">
            <label>服务商</label>
            <div class="provider-select-wrapper">
              <select v-model="selectedProviderId" class="form-select">
                <option v-for="p in PROVIDERS" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
              <button
                v-if="selectedProvider.docs && selectedProvider.docs !== '#'"
                class="docs-btn"
                title="查看文档"
                @click="openDocs"
              >
                📄
              </button>
            </div>
            <span class="form-hint">{{ selectedProvider.desc }}</span>
          </div>

          <!-- Base URL -->
          <div class="form-group">
            <label>Base URL</label>
            <input
              v-model="formData.baseUrl"
              type="text"
              class="form-input"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <!-- API Key -->
          <div class="form-group">
            <label>API Key</label>
            <input
              v-model="formData.apiKey"
              type="password"
              class="form-input"
              placeholder="sk-..."
            />
          </div>

          <!-- Model -->
          <div class="form-group">
            <label>模型</label>
            <select v-if="availableModels.length > 0" v-model="formData.model" class="form-select">
              <option v-for="m in availableModels" :key="m.value" :value="m.value">
                {{ m.label }}
              </option>
            </select>
            <input
              v-else
              v-model="formData.model"
              type="text"
              class="form-input"
              placeholder="自定义模型名称"
            />
          </div>

          <!-- Test Result -->
          <div
            v-if="testResult"
            class="test-result"
            :class="{ success: testResult.success, error: !testResult.success }"
          >
            {{ testResult.success ? '✅' : '❌' }} {{ testResult.message }}
          </div>

          <!-- Actions -->
          <div class="form-actions">
            <button class="btn btn-secondary" :disabled="isTesting" @click="testConnection">
              {{ isTesting ? '测试中...' : '🔗 测试连接' }}
            </button>
            <button
              class="btn btn-primary"
              :disabled="!formData.apiKey || !formData.baseUrl || isSaving"
              @click="saveConfig"
            >
              {{ isSaving ? '保存中...' : '💾 保存配置' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 已保存的配置 -->
      <section class="settings-section">
        <h3>📋 已保存配置</h3>

        <div v-if="configStore.configs.length === 0" class="empty-configs">
          <span class="empty-icon">🔐</span>
          <p>暂无配置，请在左侧添加</p>
        </div>

        <div v-else class="config-list">
          <div
            v-for="config in configStore.configs"
            :key="config.id"
            class="config-item"
            :class="{ active: config.id === configStore.activeConfigId }"
          >
            <div class="config-info">
              <div class="config-header">
                <span class="config-name">{{ config.providerName }}</span>
                <span v-if="config.id === configStore.activeConfigId" class="active-badge"
                  >当前</span
                >
              </div>
              <span class="config-model">{{ config.selectedModel }}</span>
              <span class="config-url">{{ config.baseUrl }}</span>
            </div>
            <div class="config-actions">
              <button
                v-if="config.id !== configStore.activeConfigId"
                class="action-btn activate"
                title="设为活跃"
                @click="activateConfig(config.id)"
              >
                ✓
              </button>
              <button class="action-btn delete" title="删除" @click="deleteConfig(config.id)">
                🗑️
              </button>
            </div>
          </div>
        </div>

        <!-- API Status -->
        <div class="api-status">
          <div class="status-indicator" :class="{ ready: configStore.isReady }">
            {{ configStore.isReady ? '✅ API 已就绪' : '⚠️ 未配置 API' }}
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  padding: var(--space-lg);
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-lg);
  height: 100%;
  overflow-y: auto;
}

.settings-header {
  margin-bottom: var(--space-xl);
}

.settings-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  color: var(--text-light);
  margin: 8px 0 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.settings-section {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  border: 1px solid var(--border);
}

.settings-section h3 {
  margin: 0 0 var(--space-lg);
  font-size: 1.1rem;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-weight: 500;
  font-size: 0.9rem;
}

.form-hint {
  font-size: 0.8rem;
  color: var(--text-light);
}

.provider-select-wrapper {
  display: flex;
  gap: 8px;
}

.provider-select-wrapper .form-select {
  flex: 1;
}

.docs-btn {
  width: 40px;
  border: 1px solid var(--border);
  background: var(--secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.15s;
}

.docs-btn:hover {
  background: #e2e8f0;
}

.form-input,
.form-select {
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  transition: border-color 0.2s;
  background: white;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

.test-result {
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
}

.test-result.success {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.test-result.error {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: var(--space-sm);
}

.btn {
  padding: 11px 20px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-dark);
}

.btn-secondary {
  background: var(--secondary);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
}

.empty-configs {
  text-align: center;
  color: var(--text-light);
  padding: 40px 20px;
}

.empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 12px;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--secondary);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.config-item.active {
  background: rgba(0, 122, 255, 0.08);
  border-color: var(--primary);
}

.config-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-name {
  font-weight: 600;
}

.active-badge {
  font-size: 0.7rem;
  background: var(--primary);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
}

.config-model {
  font-size: 0.85rem;
  color: var(--text);
}

.config-url {
  font-size: 0.75rem;
  color: var(--text-light);
}

.config-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
}

.action-btn.activate {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.action-btn.activate:hover {
  background: rgba(34, 197, 94, 0.2);
}

.action-btn.delete {
  background: rgba(239, 68, 68, 0.1);
}

.action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
}

.api-status {
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border);
}

.status-indicator {
  font-size: 0.9rem;
  color: var(--text-light);
}

.status-indicator.ready {
  color: #16a34a;
}
</style>
