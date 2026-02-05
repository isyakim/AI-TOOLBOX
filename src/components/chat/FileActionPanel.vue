<script setup lang="ts">
import { ref, computed } from 'vue'

interface FileAction {
  action: 'read' | 'write' | 'delete' | 'save' | 'edit' | 'remove'
  path: string
  content?: string
}

const props = defineProps<{
  actions: FileAction[]
}>()

const emit = defineEmits<{
  'executed': [result: string]
}>()

const status = ref<Record<number, 'pending' | 'running' | 'success' | 'error'>>(
  props.actions.reduce((acc, _, i) => ({ ...acc, [i]: 'pending' }), {})
)

const results = ref<Record<number, string>>({})

async function executeAction(action: FileAction, index: number) {
  status.value[index] = 'running'
  
  try {
    const res = await window.api.fileAction(action)
    if (res.success) {
      status.value[index] = 'success'
      let resultText = ''
      if (action.action === 'read') {
        if (res.entries) {
          resultText = `目录读取成功: ${action.path}\n\n${res.entries.join('\n')}`
        } else {
          resultText = `文件读取成功: ${action.path}\n\n${res.content}`
        }
      } else {
        resultText = `操作成功: ${action.action} -> ${action.path}`
      }
      results.value[index] = resultText
      emit('executed', resultText)
    } else {
      status.value[index] = 'error'
      results.value[index] = `失败: ${res.message}`
    }
  } catch (error: any) {
    status.value[index] = 'error'
    results.value[index] = `错误: ${error.message}`
  }
}
</script>

<template>
  <div class="file-action-panel">
    <div v-for="(action, index) in actions" :key="index" class="action-card">
      <div class="action-header">
        <span class="action-type" :class="action.action">
          {{ action.action.toUpperCase() }}
        </span>
        <span class="action-path">{{ action.path }}</span>
      </div>

      <div v-if="action.content" class="content-preview">
        <code>{{ action.content.slice(0, 100) }}{{ action.content.length > 100 ? '...' : '' }}</code>
      </div>

      <div class="action-footer">
        <span class="status-badge" :class="status[index]">
          {{ 
            status[index] === 'pending' ? '等待执行' :
            status[index] === 'running' ? '正在执行...' :
            status[index] === 'success' ? '✅ 已执行' : '❌ 失败'
          }}
        </span>
        <button 
          v-if="status[index] === 'pending' || status[index] === 'error'"
          class="exec-btn"
          @click="executeAction(action, index)"
        >
          执行操作
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
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-type {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
}

.action-type.read { background: #3b82f6; }
.action-type.write, .action-type.save, .action-type.edit { background: #10b981; }
.action-type.delete, .action-type.remove { background: #ef4444; }

.action-path {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--text);
  word-break: break-all;
}

.content-preview {
  background: #f1f5f9;
  padding: 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  overflow: hidden;
}

.action-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.pending { color: var(--text-light); }
.status-badge.running { color: var(--primary); }
.status-badge.success { color: #10b981; }
.status-badge.error { color: #ef4444; }

.exec-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.exec-btn:hover {
  opacity: 0.9;
}

.result-box {
  background: #1e1e1e;
  padding: 8px;
  border-radius: 6px;
  margin-top: 8px;
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
