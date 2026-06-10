<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import FileActionPanel from './FileActionPanel.vue'
import { speechService } from '@/services/speechService'
import type { RAGCitation } from '@/services/ragService'
import { renderSafeMarkdown } from '@/shared/services/markdown'

interface MessageImage {
  url: string
  base64?: string
  type?: string
}

const props = defineProps<{
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: MessageImage[]
  citations?: RAGCitation[]
}>()

const emit = defineEmits<{
  toolExecuted: [result: string]
  speak: [content: string]
}>()

// TTS 状态
const isSpeaking = ref(false)

// Parse file-action blocks
const fileActions = computed(() => {
  if (props.role !== 'assistant') return []

  const regex = /```file-action\s*([\s\S]+?)```/gi
  const actions: any[] = []
  let match

  while ((match = regex.exec(props.content)) !== null) {
    try {
      const payload = JSON.parse(match[1])
      if (payload && payload.action && payload.path) {
        actions.push(payload)
      }
    } catch (e) {
      console.warn('Failed to parse file-action block:', e)
    }
  }
  return actions
})

// Clean content (remove file-action blocks for rendering)
const cleanContent = computed(() => {
  if (props.role !== 'assistant') return props.content
  return props.content.replace(/```file-action\s*([\s\S]+?)```/gi, '').trim()
})

const renderedContent = computed(() => {
  return renderSafeMarkdown(cleanContent.value || '')
})

// 是否支持TTS
const supportsTTS = computed(() => speechService.isSynthesisSupported)

function handleToolExecuted(result: string) {
  emit('toolExecuted', result)
}

// TTS 播放
function toggleSpeak() {
  if (isSpeaking.value) {
    speechService.stopSpeaking()
    isSpeaking.value = false
  } else {
    // 提取纯文本（去除 Markdown 标记）
    const textContent = cleanContent.value
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim()

    speechService.speak(textContent, {
      onEnd: () => {
        isSpeaking.value = false
      },
      onError: () => {
        isSpeaking.value = false
      }
    })
    isSpeaking.value = true
  }
}

// 查看大图
const previewImage = ref<string | null>(null)

function openImagePreview(url: string) {
  previewImage.value = url
}

function closeImagePreview() {
  previewImage.value = null
}

async function copyContent() {
  await window.navigator.clipboard.writeText(cleanContent.value)
}

onMounted(() => {
  Prism.highlightAll()
})

watch(
  () => renderedContent.value,
  () => {
    if (props.role === 'assistant') {
      setTimeout(() => Prism.highlightAll(), 0)
    }
  }
)
</script>

<template>
  <div class="message-bubble" :class="role">
    <div class="message-role">
      {{ role === 'assistant' ? 'AI' : role === 'user' ? 'YOU' : 'SYS' }}
    </div>
    <div class="message-wrapper">
      <!-- 附加的图片 -->
      <div v-if="images && images.length > 0" class="message-images">
        <div
          v-for="(img, index) in images"
          :key="index"
          class="image-thumb"
          @click="openImagePreview(img.url)"
        >
          <img :src="img.url" :alt="`附件 ${index + 1}`" />
        </div>
      </div>

      <div v-if="role === 'user'" class="message-content plain-text">
        {{ content }}
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-else class="message-content markdown-body" v-html="renderedContent"></div>

      <div v-if="role === 'assistant' && citations?.length" class="citations">
        <div class="citations-title">Sources</div>
        <div
          v-for="(citation, index) in citations"
          :key="`${citation.source}-${index}`"
          class="citation-card"
        >
          <div class="citation-path">{{ citation.relativePath || citation.source }}</div>
          <p>{{ citation.snippet }}</p>
        </div>
      </div>

      <!-- File Action Tool Panel -->
      <FileActionPanel
        v-if="fileActions.length > 0"
        :actions="fileActions"
        @executed="handleToolExecuted"
      />

      <!-- 消息工具栏 -->
      <div v-if="role === 'assistant' && content.length > 0" class="message-actions">
        <button
          v-if="supportsTTS"
          class="action-btn"
          :class="{ active: isSpeaking }"
          :title="isSpeaking ? '停止播放' : '朗读'"
          @click="toggleSpeak"
        >
          {{ isSpeaking ? 'Stop' : 'Read' }}
        </button>
        <button class="action-btn" title="复制内容" @click="copyContent">Copy</button>
      </div>
    </div>

    <!-- 图片预览 Modal -->
    <Teleport to="body">
      <div v-if="previewImage" class="image-preview-overlay" @click="closeImagePreview">
        <div class="preview-container" @click.stop>
          <img :src="previewImage" alt="图片预览" />
          <button class="close-btn" @click="closeImagePreview">✕</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.message-bubble {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  width: 100%;
  margin-bottom: 18px;
}

.message-role {
  display: flex;
  justify-content: center;
  padding-top: 13px;
  color: var(--text-light);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.68rem;
  font-weight: 700;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

/* ===== 图片附件区域 ===== */
.message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.image-thumb {
  position: relative;
  width: 128px;
  height: 92px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--border);
  transition: all 0.2s;
}

.image-thumb:hover {
  border-color: var(--primary);
}

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.message-content {
  max-width: 920px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.9rem;
  line-height: 1.6;
  position: relative;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

.plain-text {
  white-space: pre-wrap;
}

.user .message-content {
  background: #eff6ff;
  color: var(--text);
  border-color: #bfdbfe;
}

.assistant .message-content {
  background: #ffffff;
  color: var(--text);
}

.system .message-content {
  background: #f8fafc;
  color: var(--text-light);
}

/* ===== 消息工具栏 ===== */
.message-actions {
  display: flex;
  gap: 6px;
  margin-top: -2px;
  transition: opacity 0.2s;
}

.action-btn {
  height: 26px;
  border: 1px solid var(--border);
  background: #ffffff;
  border-radius: 6px;
  cursor: pointer;
  padding: 0 9px;
  color: var(--text-light);
  font-size: 0.74rem;
  font-weight: 650;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: #9fb0c8;
  color: var(--text);
}

.action-btn.active {
  border-color: var(--primary);
  background: var(--primary-light);
  color: var(--primary);
}

.citations {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 920px;
}

.citations-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-light);
  text-transform: uppercase;
}

.citation-card {
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.citation-path {
  font-family: Consolas, monospace;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--primary);
  word-break: break-all;
}

.citation-card p {
  margin: 6px 0 0;
  color: var(--text-light);
  font-size: 0.82rem;
  line-height: 1.45;
}

/* ===== 图片预览 Modal ===== */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(8px);
}

.preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.preview-container img {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
}

.preview-container .close-btn {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-container .close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Markdown Styling */
:deep(.markdown-body) {
  font-family: inherit;
}

:deep(.markdown-body pre) {
  background: #0f172a;
  border-radius: 6px;
  padding: 12px;
  margin: 12px 0;
  max-width: 100%;
  overflow-x: auto;
}

:deep(.markdown-body code) {
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

:deep(.markdown-body pre code) {
  display: block;
  white-space: pre;
  word-break: normal;
}

:deep(.markdown-body p) {
  margin: 0 0 12px 0;
}
:deep(.markdown-body p:last-child) {
  margin-bottom: 0;
}
:deep(.markdown-body ul, .markdown-body ol) {
  margin: 8px 0;
  padding-left: 20px;
}
:deep(.markdown-body blockquote) {
  border-left: 4px solid var(--border);
  padding-left: 16px;
  color: var(--text-light);
  margin: 12px 0;
}

:deep(.markdown-body table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}
</style>
