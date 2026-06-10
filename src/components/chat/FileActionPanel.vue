<script setup lang="ts">
import { ref } from 'vue'

interface FileAction {
  action: 'read' | 'write' | 'delete' | 'save' | 'edit' | 'remove'
  path: string
  content?: string
}

defineProps<{
  actions: FileAction[]
}>()

const emit = defineEmits<{
  executed: [result: string]
}>()

const status = ref<Record<number, 'pending' | 'running' | 'success' | 'error'>>({})
const results = ref<Record<number, string>>({})
const previews = ref<Record<number, { diff: string; exists: boolean }>>({})
const previewStatus = ref<Record<number, 'idle' | 'loading' | 'ready' | 'error'>>({})

function getStatus(index: number) {
  return status.value[index] || 'pending'
}

function getPreviewStatus(index: number) {
  return previewStatus.value[index] || 'idle'
}

function requiresPreview(action: FileAction) {
  return ['write', 'save', 'edit', 'delete', 'remove'].includes(action.action)
}

async function previewAction(action: FileAction, index: number) {
  previewStatus.value[index] = 'loading'
  results.value[index] = ''

  try {
    const res = await window.api.previewFileAction(action)
    if (res.success) {
      previews.value[index] = {
        diff: res.diff || '',
        exists: Boolean(res.exists)
      }
      previewStatus.value[index] = 'ready'
    } else {
      previewStatus.value[index] = 'error'
      results.value[index] = `Preview failed: ${res.message}`
    }
  } catch (error: any) {
    previewStatus.value[index] = 'error'
    results.value[index] = `Preview error: ${error.message}`
  }
}

async function executeAction(action: FileAction, index: number) {
  if (requiresPreview(action) && getPreviewStatus(index) !== 'ready') {
    results.value[index] = 'Preview the diff before executing this file action.'
    return
  }

  status.value[index] = 'running'

  try {
    const res = await window.api.fileAction(action)
    if (res.success) {
      status.value[index] = 'success'
      let resultText = ''

      if (action.action === 'read') {
        resultText = res.entries
          ? `Directory read: ${action.path}\n\n${res.entries.join('\n')}`
          : `File read: ${action.path}\n\n${res.content}`
      } else {
        resultText = `Action succeeded: ${action.action} -> ${action.path}`
      }

      results.value[index] = resultText
      emit('executed', resultText)
    } else {
      status.value[index] = 'error'
      results.value[index] = `Failed: ${res.message}`
    }
  } catch (error: any) {
    status.value[index] = 'error'
    results.value[index] = `Error: ${error.message}`
  }
}
</script>

<template>
  <div class="file-action-panel">
    <div v-for="(action, index) in actions" :key="index" class="action-card">
      <div class="action-header">
        <span class="action-type" :class="action.action">{{ action.action.toUpperCase() }}</span>
        <span class="action-path">{{ action.path }}</span>
      </div>

      <div v-if="action.content && !previews[index]" class="content-preview">
        <code
          >{{ action.content.slice(0, 120) }}{{ action.content.length > 120 ? '...' : '' }}</code
        >
      </div>

      <div v-if="requiresPreview(action)" class="diff-section">
        <div class="diff-header">
          <span>Diff preview required before execution</span>
          <button
            class="preview-btn"
            :disabled="getPreviewStatus(index) === 'loading'"
            @click="previewAction(action, index)"
          >
            {{
              getPreviewStatus(index) === 'loading'
                ? 'Loading...'
                : previews[index]
                  ? 'Refresh diff'
                  : 'Preview diff'
            }}
          </button>
        </div>
        <pre
          v-if="previews[index]"
          class="diff-box"
        ><code>{{ previews[index].diff || '(no content changes)' }}</code></pre>
      </div>

      <div class="action-footer">
        <span class="status-badge" :class="getStatus(index)">
          {{
            getStatus(index) === 'pending'
              ? 'Pending'
              : getStatus(index) === 'running'
                ? 'Running...'
                : getStatus(index) === 'success'
                  ? 'Executed'
                  : 'Failed'
          }}
        </span>
        <button
          v-if="getStatus(index) === 'pending' || getStatus(index) === 'error'"
          class="exec-btn"
          :disabled="requiresPreview(action) && getPreviewStatus(index) !== 'ready'"
          @click="executeAction(action, index)"
        >
          Execute
        </button>
      </div>

      <div v-if="results[index]" class="result-box">
        <pre><code>{{ results[index] }}</code></pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-action-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 12px 0;
  width: 100%;
}

.action-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.action-header,
.action-footer,
.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.action-type {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
}

.action-type.read {
  background: #3b82f6;
}
.action-type.write,
.action-type.save,
.action-type.edit {
  background: #10b981;
}
.action-type.delete,
.action-type.remove {
  background: #ef4444;
}

.action-path {
  flex: 1;
  font-family: Consolas, monospace;
  color: var(--text);
  font-size: 0.85rem;
  word-break: break-all;
}

.content-preview {
  padding: 8px;
  overflow: hidden;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 0.8rem;
}

.diff-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diff-header {
  color: var(--text-light);
  font-size: 0.8rem;
}

.diff-box {
  max-height: 260px;
  margin: 0;
  overflow: auto;
  padding: 10px;
  background: #0f172a;
  border-radius: 6px;
  color: #d1d5db;
  font-size: 0.78rem;
  line-height: 1.5;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.pending {
  color: var(--text-light);
}
.status-badge.running {
  color: var(--primary);
}
.status-badge.success {
  color: #10b981;
}
.status-badge.error {
  color: #ef4444;
}

.exec-btn,
.preview-btn {
  border: 1px solid var(--border);
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
}

.exec-btn {
  color: white;
  border-color: var(--primary);
  background: var(--primary);
}

.preview-btn {
  color: var(--text);
  background: white;
}

.exec-btn:disabled,
.preview-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.result-box {
  margin-top: 4px;
  padding: 8px;
  background: #1e1e1e;
  border-radius: 6px;
}

.result-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.result-box code {
  color: #dcdcdc;
  font-size: 0.8rem;
}
</style>
