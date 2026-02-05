<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { marked } from 'marked'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import FileActionPanel from './FileActionPanel.vue'
import { speechService } from '@/services/speechService'

interface MessageImage {
  url: string
  base64?: string
  type?: string
}

const props = defineProps<{
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: MessageImage[]
}>()

const emit = defineEmits<{
  'toolExecuted': [result: string]
  'speak': [content: string]
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
  if (props.role === 'user') return props.content
  return marked(cleanContent.value || '', { breaks: true, gfm: true })
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

onMounted(() => {
  Prism.highlightAll()
})

watch(() => renderedContent.value, () => {
  if (props.role === 'assistant') {
    setTimeout(() => Prism.highlightAll(), 0)
  }
})
</script>

<template>
  <div class="message-bubble" :class="role">
    <div class="avatar">{{ role === 'assistant' ? '🤖' : '👤' }}</div>
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
          <div class="image-overlay">
            <span>🔍</span>
          </div>
        </div>
      </div>

      <div 
        class="message-content markdown-body" 
        v-html="role === 'user' ? content : renderedContent"
      ></div>
      
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
          {{ isSpeaking ? '⏹️' : '🔊' }}
        </button>
        <button 
          class="action-btn"
          title="复制内容"
          @click="navigator.clipboard.writeText(cleanContent)"
        >
          📋
        </button>
      </div>
    </div>

    <!-- 图片预览 Modal -->
    <Teleport to="body">
      <div 
        v-if="previewImage" 
        class="image-preview-overlay"
        @click="closeImagePreview"
      >
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
  display: flex;
  gap: 12px;
  max-width: 90%;
  margin-bottom: 8px;
}

.message-bubble.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-bubble.assistant {
  align-self: flex-start;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: calc(100% - 48px);
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
  width: 120px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.image-thumb:hover {
  border-color: var(--primary);
  transform: scale(1.02);
}

.image-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-thumb .image-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-thumb:hover .image-overlay {
  opacity: 1;
}

.image-overlay span {
  font-size: 1.5rem;
}

.message-content {
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 0.95rem;
  line-height: 1.6;
  position: relative;
  word-wrap: break-word;
}

.user .message-content {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  border-bottom-right-radius: 4px;
  box-shadow: 0 10px 25px rgba(0, 122, 255, 0.2);
}

.assistant .message-content {
  background: white;
  color: var(--text);
  border-bottom-left-radius: 4px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

/* ===== 消息工具栏 ===== */
.message-actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-bubble:hover .message-actions {
  opacity: 1;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--border);
}

.action-btn.active {
  background: rgba(99, 102, 241, 0.2);
  color: var(--primary);
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
  background: #1e1e1e;
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
  overflow-x: auto;
}

:deep(.markdown-body code) {
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
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
</style>
