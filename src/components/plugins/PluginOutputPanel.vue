<script setup lang="ts">
import { computed, ref } from 'vue'
import FileActionPanel from '@/components/chat/FileActionPanel.vue'
import type { PluginExecutionResult } from '@/services/pluginExecutor'
import { renderSafeMarkdown } from '@/shared/services/markdown'
import { parseFileActions } from '@/shared/services/fileActions'

const props = defineProps<{
  streamingOutput: string
  result: PluginExecutionResult | null
}>()

const emit = defineEmits<{
  sendToChat: [content: string]
  fileActionExecuted: [result: string]
}>()

const showRawOutput = ref(false)
const statusMessage = ref('')
const output = computed(() =>
  showRawOutput.value
    ? props.result?.rawOutput || props.streamingOutput
    : props.result?.processedOutput || props.streamingOutput
)

const parsedActions = computed(() => parseFileActions(output.value))
const fileActions = computed(() => parsedActions.value.actions)

async function copyOutput() {
  if (!output.value) return
  await navigator.clipboard.writeText(output.value)
  statusMessage.value = 'Copied to clipboard.'
}
</script>

<template>
  <section class="output-panel">
    <header class="panel-header">
      <div>
        <p class="eyebrow">OUTPUT</p>
        <h3>Execution result</h3>
      </div>
      <div v-if="output" class="output-actions">
        <button
          v-if="result?.rawOutput !== result?.processedOutput"
          class="btn"
          :class="{ active: showRawOutput }"
          @click="showRawOutput = !showRawOutput"
        >
          {{ showRawOutput ? 'Processed' : 'Raw' }}
        </button>
        <button class="btn" @click="copyOutput">Copy</button>
        <button class="btn primary" @click="emit('sendToChat', output)">Send to chat</button>
      </div>
    </header>

    <div class="output-content">
      <div v-if="!output && !result" class="empty-state">
        Run the workflow to inspect its generated output here.
      </div>
      <div v-else-if="result?.error" class="error-block">{{ result.error }}</div>
      <template v-else>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="markdown-content"
          v-html="renderSafeMarkdown(parsedActions.contentWithoutActions)"
        ></div>
        <p v-if="parsedActions.invalidBlocks" class="action-warning">
          {{ parsedActions.invalidBlocks }} invalid file action block(s) were ignored.
        </p>
        <FileActionPanel
          v-if="fileActions.length"
          :actions="fileActions"
          @executed="emit('fileActionExecuted', $event)"
        />
      </template>
    </div>

    <footer v-if="result?.executionTime || statusMessage" class="panel-footer">
      <span v-if="result?.executionTime">{{ (result.executionTime / 1000).toFixed(2) }}s</span>
      <span>{{ statusMessage }}</span>
    </footer>
  </section>
</template>

<style scoped>
.output-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
}

.panel-header,
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.panel-header h3,
.eyebrow {
  margin: 0;
}

.eyebrow {
  color: var(--text-light);
  font-size: 0.68rem;
  font-weight: 700;
}

.output-actions {
  display: flex;
  gap: 6px;
}

.btn {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  cursor: pointer;
}

.btn:hover,
.btn.active {
  border-color: var(--primary);
}

.btn.primary {
  border-color: var(--primary);
  background: var(--primary);
  color: #ffffff;
}

.output-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.empty-state {
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--text-light);
  text-align: center;
}

.error-block {
  padding: 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
}

.action-warning {
  padding: 8px 10px;
  border: 1px solid #fde68a;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
  font-size: 0.76rem;
}

.markdown-content {
  line-height: 1.65;
}

.markdown-content :deep(pre) {
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  background: #111827;
  color: #e5e7eb;
}

.panel-footer {
  justify-content: flex-start;
  border-top: 1px solid var(--border);
  border-bottom: 0;
  color: var(--text-light);
  font-size: 0.76rem;
}

@media (max-width: 720px) {
  .panel-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
