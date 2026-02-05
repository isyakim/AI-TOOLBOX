<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RAGService } from '@/services/ragService'
import { useConfigStore } from '@/stores'

const configStore = useConfigStore()
const isInitializing = ref(false)
const isIngesting = ref(false)
const documents = ref<{ name: string; size: string; status: string }[]>([])
const log = ref<string[]>([])

function addLog(msg: string) {
  log.value.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`)
}

async function initDB() {
  isInitializing.value = true
  try {
    const res = await RAGService.init()
    if (res.success) {
      addLog('✅ 向量数据库初始化成功')
    } else {
      addLog(`❌ 初始化失败: ${res.message}`)
    }
  } catch (e: any) {
    addLog(`❌ 错误: ${e.message}`)
  } finally {
    isInitializing.value = false
  }
}

async function handleFileUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || !files.length) return

  isIngesting.value = true
  const file = files[0]
  addLog(`📂 正在准备解析文件: ${file.name}`)
  
  try {
    const res = await RAGService.ingest(file)
    if (res.success) {
      addLog(`✅ 文件 "${file.name}" 已成功向量化并存入知识库`)
      documents.value.push({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        status: '已索引'
      })
    } else {
      addLog(`❌ 注入失败: ${res.message}`)
    }
  } catch (e: any) {
    addLog(`❌ 解析错误: ${e.message}`)
  } finally {
    isIngesting.value = false
  }
}

async function clearDB() {
  if (!confirm('确定要清空所有知识库数据吗？')) return
  const res = await window.api.ragClear()
  if (res.success) {
    addLog('🗑️ 知识库已清空')
    documents.value = []
  }
}

onMounted(() => {
  if (configStore.isReady) {
    initDB()
  } else {
    addLog('⚠️ 请先配置 API 秘钥，以便使用 Embedding 功能')
  }
})
</script>

<template>
  <div class="knowledge-page">
    <header class="page-header">
      <div class="header-info">
        <h2>本地知识库 (RAG)</h2>
        <p>让 AI 学习你的私有文档，提供更精准的回答</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" @click="clearDB">清空库</button>
        <button class="btn btn-primary" :disabled="isInitializing" @click="initDB">
          {{ isInitializing ? '初始化中...' : '重新初始化' }}
        </button>
      </div>
    </header>

    <div class="knowledge-content">
      <!-- Upload Section -->
      <section class="upload-section">
        <div class="upload-card">
          <input 
            type="file" 
            id="kb-upload" 
            accept=".md,.txt,.pdf" 
            @change="handleFileUpload" 
            hidden 
            :disabled="isIngesting"
          >
          <label for="kb-upload" class="upload-label" :class="{ loading: isIngesting }">
            <span class="icon">{{ isIngesting ? '⏳' : '📥' }}</span>
            <span class="text">{{ isIngesting ? '正在学习文档...' : '点击或拖拽上传文档' }}</span>
            <span class="hint">支持 .md, .txt (PDF 实验性支持)</span>
          </label>
        </div>
      </section>

      <div class="main-grid">
        <!-- Document List -->
        <section class="doc-section">
          <h3>已学习文档</h3>
          <div class="doc-list">
            <div v-if="documents.length === 0" class="empty-docs">
              还没有关联任何文档
            </div>
            <div v-for="doc in documents" :key="doc.name" class="doc-item">
              <span class="doc-icon">📄</span>
              <div class="doc-info">
                <span class="doc-name">{{ doc.name }}</span>
                <span class="doc-meta">{{ doc.size }}</span>
              </div>
              <span class="doc-status">{{ doc.status }}</span>
            </div>
          </div>
        </section>

        <!-- Operation Log -->
        <section class="log-section">
          <h3>操作日志</h3>
          <div class="log-container">
            <div v-for="(msg, i) in log" :key="i" class="log-entry">
              {{ msg }}
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.knowledge-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.page-header h2 {
  font-size: 1.5rem;
  margin: 0;
}

.page-header p {
  color: var(--text-light);
  margin: 4px 0 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.upload-section {
  margin-bottom: 40px;
}

.upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s;
}

.upload-label:hover {
  border-color: var(--primary);
  background: rgba(0, 122, 255, 0.02);
}

.upload-label.loading {
  cursor: wait;
  opacity: 0.7;
}

.upload-label .icon {
  font-size: 3rem;
  margin-bottom: 12px;
}

.upload-label .text {
  font-weight: 600;
  font-size: 1.1rem;
}

.upload-label .hint {
  color: var(--text-light);
  font-size: 0.85rem;
  margin-top: 8px;
}

.main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}

.doc-list {
  background: var(--secondary);
  border-radius: var(--radius-md);
  min-height: 200px;
}

.empty-docs {
  padding: 40px;
  text-align: center;
  color: var(--text-light);
}

.doc-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.doc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.doc-name {
  font-weight: 500;
}

.doc-meta {
  font-size: 0.75rem;
  color: var(--text-light);
}

.doc-status {
  font-size: 0.75rem;
  background: #10b981;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
}

.log-container {
  background: #1e1e1e;
  border-radius: var(--radius-md);
  padding: 16px;
  height: 300px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.8rem;
  color: #dcdcdc;
}

.log-entry {
  margin-bottom: 4px;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary { background: var(--primary); color: white; border: none; }
.btn-secondary { background: var(--secondary); border: 1px solid var(--border); }
</style>
