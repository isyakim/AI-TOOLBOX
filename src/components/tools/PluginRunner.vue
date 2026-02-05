<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePluginStore, type Plugin, type PluginField } from '@/stores/plugins'
import { useConfigStore } from '@/stores'
import { executePlugin, type PluginExecutionResult } from '@/services/pluginExecutor'
import { marked } from 'marked'

const pluginStore = usePluginStore()
const configStore = useConfigStore()

// 状态
const inputs = ref<Record<string, any>>({})
const isExecuting = ref(false)
const executionStage = ref('')
const streamingOutput = ref('')
const result = ref<PluginExecutionResult | null>(null)
const showRawOutput = ref(false)

// 当前插件
const activePlugin = computed(() => pluginStore.activePlugin)

// 监听插件变化,重置输入
watch(activePlugin, (plugin) => {
  if (plugin) {
    resetInputs(plugin)
  }
}, { immediate: true })

function resetInputs(plugin: Plugin) {
  inputs.value = {}
  plugin.fields.forEach(field => {
    inputs.value[field.id] = field.defaultValue ?? ''
  })
  result.value = null
  streamingOutput.value = ''
}

// 验证必填字段
const canExecute = computed(() => {
  if (!activePlugin.value || !configStore.isReady || isExecuting.value) {
    return false
  }
  
  return activePlugin.value.fields.every(field => {
    if (!field.required) return true
    const value = inputs.value[field.id]
    return value !== undefined && value !== ''
  })
})

// 执行插件
async function runPlugin() {
  if (!activePlugin.value || !canExecute.value) return
  
  isExecuting.value = true
  streamingOutput.value = ''
  result.value = null
  
  const execResult = await executePlugin({
    plugin: activePlugin.value,
    inputs: inputs.value,
    onToken: (token) => {
      streamingOutput.value += token
    },
    onProgress: (stage) => {
      executionStage.value = stage
    }
  })
  
  result.value = execResult
  isExecuting.value = false
}

// 停止执行
function stopExecution() {
  // TODO: 实现中断逻辑
  isExecuting.value = false
}

// 复制结果
function copyResult() {
  const text = result.value?.processedOutput || streamingOutput.value
  navigator.clipboard.writeText(text)
}

// 清空
function clearAll() {
  if (activePlugin.value) {
    resetInputs(activePlugin.value)
  }
}

// 关闭插件
function closePlugin() {
  pluginStore.setActivePlugin(null)
}

// 渲染 Markdown
function renderMarkdown(text: string): string {
  try {
    return marked(text) as string
  } catch {
    return text
  }
}

// 获取字段选项
function getFieldOptions(field: PluginField) {
  return field.options || []
}
</script>

<template>
  <div v-if="activePlugin" class="plugin-runner">
    <!-- 插件头部 -->
    <div class="runner-header">
      <button class="back-btn" @click="closePlugin">
        ← 返回
      </button>
      <div class="plugin-info">
        <span class="plugin-icon">{{ activePlugin.icon }}</span>
        <div class="plugin-meta">
          <h2>{{ activePlugin.name }}</h2>
          <p>{{ activePlugin.description }}</p>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="runner-body">
      <!-- 输入区域 -->
      <div class="input-section">
        <h3 class="section-title">📝 输入参数</h3>
        
        <div class="fields-container">
          <div 
            v-for="field in activePlugin.fields" 
            :key="field.id" 
            class="field-group"
          >
            <label :for="field.id" class="field-label">
              {{ field.label }}
              <span v-if="field.required" class="required-star">*</span>
            </label>
            
            <!-- 单行文本 -->
            <input 
              v-if="field.type === 'text'"
              :id="field.id"
              v-model="inputs[field.id]"
              type="text"
              :placeholder="field.placeholder"
              class="field-input"
            >
            
            <!-- 多行文本 -->
            <textarea 
              v-else-if="field.type === 'textarea'"
              :id="field.id"
              v-model="inputs[field.id]"
              :placeholder="field.placeholder"
              :rows="field.rows || 4"
              class="field-textarea"
            ></textarea>
            
            <!-- 下拉选择 -->
            <select 
              v-else-if="field.type === 'select'"
              :id="field.id"
              v-model="inputs[field.id]"
              class="field-select"
            >
              <option value="" disabled>请选择...</option>
              <option 
                v-for="opt in getFieldOptions(field)" 
                :key="opt.value" 
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            
            <!-- 数字 -->
            <input 
              v-else-if="field.type === 'number'"
              :id="field.id"
              v-model.number="inputs[field.id]"
              type="number"
              :placeholder="field.placeholder"
              class="field-input"
            >
            
            <!-- 开关 -->
            <label v-else-if="field.type === 'toggle'" class="toggle-wrapper">
              <input 
                type="checkbox" 
                v-model="inputs[field.id]"
                class="toggle-input"
              >
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <button 
            class="run-btn"
            :class="{ running: isExecuting }"
            :disabled="!canExecute"
            @click="runPlugin"
          >
            <span v-if="isExecuting" class="btn-content">
              <span class="spinner"></span>
              {{ executionStage || '执行中...' }}
            </span>
            <span v-else class="btn-content">
              <span class="btn-icon">▶️</span>
              执行
            </span>
          </button>
          <button v-if="isExecuting" class="stop-btn" @click="stopExecution">
            ⏹ 停止
          </button>
          <button class="clear-btn" @click="clearAll">
            🗑️ 清空
          </button>
        </div>
      </div>

      <!-- 输出区域 -->
      <div class="output-section">
        <div class="output-header">
          <h3 class="section-title">📤 执行结果</h3>
          <div class="output-actions" v-if="result || streamingOutput">
            <button 
              v-if="result?.rawOutput !== result?.processedOutput"
              class="toggle-raw-btn"
              :class="{ active: showRawOutput }"
              @click="showRawOutput = !showRawOutput"
            >
              {{ showRawOutput ? '查看处理后' : '查看原始' }}
            </button>
            <button class="copy-btn" @click="copyResult">
              📋 复制
            </button>
          </div>
        </div>

        <div class="output-content">
          <!-- 空状态 -->
          <div v-if="!streamingOutput && !result" class="output-empty">
            <div class="empty-icon">💡</div>
            <p>填写参数后点击执行</p>
          </div>

          <!-- 执行结果 -->
          <div v-else class="output-result">
            <!-- 错误提示 -->
            <div v-if="result?.error" class="error-block">
              <span class="error-icon">❌</span>
              <span>{{ result.error }}</span>
            </div>
            
            <!-- 流式输出 / 最终结果 -->
            <div 
              v-else 
              class="markdown-content"
              v-html="renderMarkdown(showRawOutput ? (result?.rawOutput || streamingOutput) : (result?.processedOutput || streamingOutput))"
            ></div>
          </div>
        </div>

        <!-- 执行信息 -->
        <div v-if="result?.executionTime" class="execution-info">
          <span>⏱️ 耗时 {{ (result.executionTime / 1000).toFixed(2) }}s</span>
          <span v-if="activePlugin.postProcessor?.enabled" class="post-processed-badge">
            ✨ 已后处理
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plugin-runner {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ===== 头部 ===== */
.runner-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--secondary);
}

.back-btn {
  padding: 8px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  border-color: var(--primary);
}

.plugin-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.plugin-icon {
  font-size: 2rem;
}

.plugin-meta h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}

.plugin-meta p {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--text-light);
}

/* ===== 主体 ===== */
.runner-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px;
  min-height: 0;
  overflow: hidden;
}

.section-title {
  margin: 0 0 16px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

/* ===== 输入区域 ===== */
.input-section {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fields-container {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.field-group {
  margin-bottom: 16px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text);
}

.required-star {
  color: #ef4444;
  margin-left: 2px;
}

.field-input,
.field-textarea,
.field-select {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  background: var(--secondary);
  color: var(--text);
  transition: all 0.2s;
}

.field-input:focus,
.field-textarea:focus,
.field-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.field-textarea {
  resize: vertical;
  line-height: 1.6;
}

/* Toggle */
.toggle-wrapper {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  width: 48px;
  height: 26px;
  background: var(--border);
  border-radius: 13px;
  position: relative;
  transition: all 0.3s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked + .toggle-slider {
  background: var(--primary);
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(22px);
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.run-btn {
  flex: 1;
  padding: 14px 24px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
}

.run-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
}

.run-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.run-btn.running {
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-icon {
  font-size: 1rem;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.stop-btn {
  padding: 14px 20px;
  background: #ef4444;
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-weight: 500;
  cursor: pointer;
}

.clear-btn {
  padding: 14px 20px;
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  border-color: var(--primary);
}

/* ===== 输出区域 ===== */
.output-section {
  display: flex;
  flex-direction: column;
  background: var(--secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.output-header .section-title {
  margin: 0;
}

.output-actions {
  display: flex;
  gap: 8px;
}

.toggle-raw-btn,
.copy-btn {
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-raw-btn:hover,
.copy-btn:hover {
  border-color: var(--primary);
}

.toggle-raw-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.output-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.output-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-light);
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 12px;
  opacity: 0.6;
}

.output-empty p {
  margin: 0;
}

.error-block {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-md);
  color: #dc2626;
}

.error-icon {
  font-size: 1.2rem;
}

.markdown-content {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--text);
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(h1) { font-size: 1.4rem; }
.markdown-content :deep(h2) { font-size: 1.2rem; }
.markdown-content :deep(h3) { font-size: 1.05rem; }

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 1.5em;
}

.markdown-content :deep(li) {
  margin: 0.3em 0;
}

.markdown-content :deep(pre) {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-size: 0.85rem;
}

.markdown-content :deep(code) {
  font-family: 'Fira Code', monospace;
}

.markdown-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
}

.markdown-content :deep(th) {
  background: var(--secondary);
  font-weight: 600;
}

.execution-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  font-size: 0.8rem;
  color: var(--text-light);
}

.post-processed-badge {
  padding: 3px 8px;
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  color: white;
  border-radius: 8px;
  font-size: 0.75rem;
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .runner-body {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
}
</style>
