<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import PluginInputForm, { type PluginInputValues } from '@/components/plugins/PluginInputForm.vue'
import PluginOutputPanel from '@/components/plugins/PluginOutputPanel.vue'
import {
  cancelPluginExecution,
  executePlugin,
  type PluginExecutionResult
} from '@/services/pluginExecutor'
import { useChatStore } from '@/stores/chat'
import { useConfigStore } from '@/stores/config'
import { usePluginStore, type Plugin } from '@/stores/plugins'

const pluginStore = usePluginStore()
const configStore = useConfigStore()
const chatStore = useChatStore()

const inputs = ref<PluginInputValues>({})
const isExecuting = ref(false)
const executionStage = ref('')
const streamingOutput = ref('')
const result = ref<PluginExecutionResult | null>(null)
const activePlugin = computed(() => pluginStore.activePlugin)

const canExecute = computed(() => {
  if (!activePlugin.value || !configStore.isReady || isExecuting.value) return false
  return activePlugin.value.fields.every((field) => {
    if (!field.required) return true
    const value = inputs.value[field.id]
    return value !== undefined && value !== ''
  })
})

watch(activePlugin, (plugin) => plugin && resetInputs(plugin), { immediate: true })

function resetInputs(plugin: Plugin) {
  inputs.value = Object.fromEntries(
    plugin.fields.map((field) => [field.id, field.defaultValue ?? ''])
  )
  result.value = null
  streamingOutput.value = ''
  executionStage.value = ''
}

async function runPlugin() {
  if (!activePlugin.value || !canExecute.value) return
  isExecuting.value = true
  streamingOutput.value = ''
  result.value = null

  try {
    result.value = await executePlugin({
      plugin: activePlugin.value,
      inputs: inputs.value,
      onToken: (token) => (streamingOutput.value += token),
      onProgress: (stage) => (executionStage.value = stage)
    })
  } finally {
    isExecuting.value = false
  }
}

function stopExecution() {
  cancelPluginExecution()
  isExecuting.value = false
  executionStage.value = 'Cancelled'
}

function addToChat(content: string, label = `Plugin result: ${activePlugin.value?.name}`) {
  if (!content.trim()) return
  const sessionId = chatStore.activeSessionId || chatStore.createSession()
  chatStore.addMessage(sessionId, { role: 'system', content: `[${label}]\n\n${content}` })
}
</script>

<template>
  <div v-if="activePlugin" class="plugin-runner">
    <header class="runner-header">
      <button class="back-btn" @click="pluginStore.setActivePlugin(null)">Back</button>
      <div class="plugin-meta">
        <p>{{ activePlugin.id }} · v{{ activePlugin.version }}</p>
        <h2>{{ activePlugin.name }}</h2>
        <span>{{ activePlugin.description }}</span>
      </div>
    </header>

    <div class="runner-body">
      <section class="input-panel">
        <header class="section-header">
          <div>
            <p>INPUT</p>
            <h3>Workflow parameters</h3>
          </div>
          <span>{{ activePlugin.permissions.join(' · ') }}</span>
        </header>

        <div class="fields-scroll">
          <PluginInputForm v-model="inputs" :fields="activePlugin.fields" :disabled="isExecuting" />
        </div>

        <footer class="runner-actions">
          <button class="secondary-btn" :disabled="isExecuting" @click="resetInputs(activePlugin)">
            Clear
          </button>
          <button v-if="isExecuting" class="danger-btn" @click="stopExecution">Stop</button>
          <button v-else class="primary-btn" :disabled="!canExecute" @click="runPlugin">
            {{ configStore.isReady ? 'Run workflow' : 'Configure provider first' }}
          </button>
          <span v-if="executionStage" class="stage">{{ executionStage }}</span>
        </footer>
      </section>

      <PluginOutputPanel
        :streaming-output="streamingOutput"
        :result="result"
        @send-to-chat="addToChat($event)"
        @file-action-executed="addToChat($event, 'Plugin file action result')"
      />
    </div>
  </div>
</template>

<style scoped>
.plugin-runner {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: #f8fafc;
}

.runner-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  background: #ffffff;
}

.back-btn,
.secondary-btn,
.primary-btn,
.danger-btn {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  cursor: pointer;
}

.plugin-meta h2,
.plugin-meta p,
.plugin-meta span {
  margin: 0;
}

.plugin-meta p,
.section-header p {
  color: var(--text-light);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.7rem;
}

.plugin-meta span {
  color: var(--text-light);
  font-size: 0.84rem;
}

.runner-body {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: minmax(320px, 0.85fr) minmax(0, 1.15fr);
  gap: 12px;
  padding: 12px;
}

.input-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
}

.section-header,
.runner-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.section-header h3,
.section-header p {
  margin: 0;
}

.section-header > span,
.stage {
  color: var(--text-light);
  font-size: 0.72rem;
}

.fields-scroll {
  flex: 1;
  overflow: auto;
  padding: 14px;
}

.runner-actions {
  justify-content: flex-end;
  border-top: 1px solid var(--border);
  border-bottom: 0;
}

.primary-btn {
  border-color: var(--primary);
  background: var(--primary);
  color: #ffffff;
}

.danger-btn {
  border-color: var(--error);
  background: var(--error);
  color: #ffffff;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .runner-body {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .input-panel {
    min-height: 460px;
  }
}
</style>
