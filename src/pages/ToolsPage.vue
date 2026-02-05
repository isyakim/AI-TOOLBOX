<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConfigStore } from '@/stores'
import { getAIClient } from '@/services/aiClient'

interface Tool {
  id: string
  icon: string
  name: string
  desc: string
  placeholder: string
  systemPrompt: string
}

const configStore = useConfigStore()

const tools: Tool[] = [
  {
    id: 'translate',
    icon: '🌐',
    name: '文本翻译',
    desc: '支持多种语言互译',
    placeholder: '输入要翻译的文本...',
    systemPrompt: '你是一个专业的翻译助手。请将用户输入的文本翻译成中文（如果是中文则翻译成英文）。只返回翻译结果，不要添加任何解释。'
  },
  {
    id: 'summary',
    icon: '📝',
    name: '文本摘要',
    desc: '快速生成文章摘要',
    placeholder: '粘贴需要总结的文章...',
    systemPrompt: '你是一个专业的文本摘要助手。请为用户输入的文本生成一个简洁的摘要，突出关键要点。'
  },
  {
    id: 'code',
    icon: '💻',
    name: '代码助手',
    desc: '代码生成、解释、优化',
    placeholder: '描述你需要的代码或粘贴代码进行解释...',
    systemPrompt: '你是一个专业的编程助手。帮助用户生成、解释或优化代码。使用清晰的代码注释和格式。'
  },
  {
    id: 'writing',
    icon: '✍️',
    name: '写作助手',
    desc: '文章、邮件内容创作',
    placeholder: '描述你想要写的内容...',
    systemPrompt: '你是一个专业的写作助手。帮助用户撰写文章、邮件或其他文本内容。注重语言的流畅性和表达的准确性。'
  },
  {
    id: 'grammar',
    icon: '✅',
    name: '语法检查',
    desc: '检查并纠正语法错误',
    placeholder: '输入需要检查语法的文本...',
    systemPrompt: '你是一个专业的语法检查助手。检查用户输入的文本中的语法错误，指出问题并给出修改建议。'
  },
  {
    id: 'explain',
    icon: '💡',
    name: '概念解释',
    desc: '解释复杂概念和术语',
    placeholder: '输入需要解释的概念或术语...',
    systemPrompt: '你是一个专业的知识解释助手。用简洁易懂的语言解释用户询问的概念或术语，必要时使用例子帮助理解。'
  }
]

// State
const activeTool = ref<Tool | null>(null)
const inputText = ref('')
const outputText = ref('')
const isProcessing = ref(false)

const canProcess = computed(() => 
  inputText.value.trim().length > 0 && 
  configStore.isReady && 
  !isProcessing.value
)

function selectTool(tool: Tool) {
  activeTool.value = tool
  inputText.value = ''
  outputText.value = ''
}

function closeTool() {
  activeTool.value = null
  inputText.value = ''
  outputText.value = ''
}

async function processInput() {
  if (!canProcess.value || !activeTool.value) return

  const aiClient = getAIClient()
  if (!aiClient) {
    outputText.value = '❌ 请先在设置页面配置 API'
    return
  }

  isProcessing.value = true
  outputText.value = ''

  try {
    await aiClient.chat([
      { role: 'system', content: activeTool.value.systemPrompt },
      { role: 'user', content: inputText.value }
    ], {
      onToken: (token) => {
        outputText.value += token
      },
      onError: (error) => {
        outputText.value = `❌ 错误: ${error.message}`
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      outputText.value = `❌ 错误: ${error.message}`
    }
  } finally {
    isProcessing.value = false
  }
}

function stopProcessing() {
  const aiClient = getAIClient()
  if (aiClient) {
    aiClient.abort()
  }
  isProcessing.value = false
}

function copyOutput() {
  navigator.clipboard.writeText(outputText.value)
}
</script>

<template>
  <div class="tools-page">
    <!-- Tool Selection Grid -->
    <div v-if="!activeTool" class="tools-grid-container">
      <div class="tools-header">
        <h2>AI 工具集</h2>
        <p class="subtitle">选择一个工具开始使用</p>
      </div>

      <div class="tools-grid">
        <div 
          v-for="tool in tools" 
          :key="tool.id"
          class="tool-card"
          @click="selectTool(tool)"
        >
          <span class="tool-icon">{{ tool.icon }}</span>
          <h3 class="tool-name">{{ tool.name }}</h3>
          <p class="tool-desc">{{ tool.desc }}</p>
        </div>
      </div>
    </div>

    <!-- Active Tool View -->
    <div v-else class="tool-workspace">
      <div class="tool-header">
        <button class="back-btn" @click="closeTool">← 返回</button>
        <div class="tool-title">
          <span class="tool-icon">{{ activeTool.icon }}</span>
          <h2>{{ activeTool.name }}</h2>
        </div>
      </div>

      <div class="tool-body">
        <!-- Tool Panels -->
          <!-- Input Area -->
          <div class="tool-panel input-panel">
            <div class="panel-header">
              <span>输入</span>
            </div>
            <textarea 
              v-model="inputText"
              class="tool-textarea"
              :placeholder="activeTool.placeholder"
            ></textarea>
            <div class="panel-actions">
              <button 
                v-if="isProcessing"
                class="btn btn-danger"
                @click="stopProcessing"
              >
                ⏹ 停止
              </button>
              <button 
                v-else
                class="btn btn-primary"
                :disabled="!canProcess"
                @click="processInput"
              >
                ▶ 执行
              </button>
            </div>
          </div>

          <!-- Output Area -->
          <div class="tool-panel output-panel">
            <div class="panel-header">
              <span>结果</span>
              <button 
                v-if="outputText" 
                class="copy-btn"
                @click="copyOutput"
              >
                📋 复制
              </button>
            </div>
            <div class="tool-output">
              <div v-if="isProcessing && !outputText" class="loading">
                <span class="spinner"></span> 处理中...
              </div>
              <div v-else-if="outputText" class="output-content">
                {{ outputText }}
              </div>
              <div v-else class="output-placeholder">
                结果将显示在这里
              </div>
            </div>
          </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tools-page {
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.tools-grid-container {
  padding: var(--space-lg);
}

.tools-header {
  margin-bottom: var(--space-xl);
}

.tools-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  color: var(--text-light);
  margin: 8px 0 0;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.tool-card {
  background: white;
  padding: 28px 24px;
  border-radius: var(--radius-lg);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--border);
}

.tool-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  border-color: var(--primary);
}

.tool-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 14px;
}

.tool-name {
  font-weight: 600;
  margin: 0 0 8px;
  font-size: 1.05rem;
}

.tool-desc {
  font-size: 0.85rem;
  color: var(--text-light);
  margin: 0;
}

/* Tool Workspace */
.tool-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--border);
}

.back-btn {
  background: var(--secondary);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #e2e8f0;
}

.tool-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tool-title .tool-icon {
  font-size: 1.5rem;
  margin: 0;
}

.tool-title h2 {
  margin: 0;
  font-size: 1.25rem;
}

.tool-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: var(--space-lg);
  min-height: 0;
}

.full-width-tool {
  grid-column: span 2;
}

.tool-panel {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--secondary);
  font-weight: 500;
  font-size: 0.9rem;
}

.tool-textarea {
  flex: 1;
  border: none;
  padding: 16px;
  font-size: 0.95rem;
  resize: none;
  font-family: inherit;
  line-height: 1.6;
}

.tool-textarea:focus {
  outline: none;
}

.panel-actions {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: 10px 24px;
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

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.copy-btn {
  background: transparent;
  border: 1px solid var(--border);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: var(--secondary);
}

.tool-output {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  font-size: 0.95rem;
  line-height: 1.6;
}

.output-placeholder {
  color: var(--text-light);
  text-align: center;
  padding: 40px 20px;
}

.output-content {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-light);
  padding: 40px;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 800px) {
  .tool-body {
    grid-template-columns: 1fr;
  }
}
</style>
