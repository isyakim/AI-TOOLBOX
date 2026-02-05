<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { speechService } from '@/services/speechService'
import { processImageFile, getImageFromClipboard, revokeImageUrls, type ImageInfo } from '@/utils/imageUtils'

const props = defineProps<{
  modelValue: string
  canSend: boolean
  isStreaming: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: [text: string, images: ImageInfo[]]
  stop: []
}>()

// 输入框引用
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 语音识别状态
const isRecording = ref(false)
const interimTranscript = ref('')

// 图片附件
const attachedImages = ref<ImageInfo[]>([])
const maxImages = 4

// TTS 相关
const isSpeaking = ref(false)

// 是否支持多模态
const supportsVision = computed(() => true) // 根据配置判断
const supportsSpeech = computed(() => speechService.isRecognitionSupported)
const supportsTTS = computed(() => speechService.isSynthesisSupported)

// ===== 文本输入 =====
const inputText = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 自动调整高度
watch(inputText, () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px'
  }
})

// 按键处理
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// ===== 发送消息 =====
function sendMessage() {
  if (props.isStreaming) {
    emit('stop')
    return
  }

  const text = inputText.value.trim()
  if (!text && attachedImages.value.length === 0) {
    return
  }

  emit('send', text, [...attachedImages.value])
  
  // 清理
  inputText.value = ''
  attachedImages.value = []
}

// ===== 语音识别 =====
function toggleRecording() {
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

function startRecording() {
  speechService.startRecognition({
    onStart: () => {
      isRecording.value = true
      interimTranscript.value = ''
    },
    onResult: (result) => {
      if (result.isFinal) {
        // 最终结果：追加到输入框
        inputText.value += (inputText.value ? ' ' : '') + result.transcript
        interimTranscript.value = ''
      } else {
        // 临时结果：显示预览
        interimTranscript.value = result.transcript
      }
    },
    onEnd: () => {
      isRecording.value = false
      interimTranscript.value = ''
    },
    onError: (error) => {
      isRecording.value = false
      console.error('Speech recognition error:', error)
    }
  })
}

function stopRecording() {
  speechService.stopRecognition()
  isRecording.value = false
  interimTranscript.value = ''
}

// ===== 图片处理 =====
async function handleImageSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    if (attachedImages.value.length >= maxImages) {
      alert(`最多只能上传 ${maxImages} 张图片`)
      break
    }

    try {
      const imageInfo = await processImageFile(file)
      attachedImages.value.push(imageInfo)
    } catch (error: any) {
      alert(error.message || '图片处理失败')
    }
  }

  // 重置 input
  input.value = ''
}

function removeImage(index: number) {
  const removed = attachedImages.value.splice(index, 1)
  revokeImageUrls(removed)
}

// 粘贴处理
async function handlePaste(e: ClipboardEvent) {
  // 检查是否有图片
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (!file) continue

      if (attachedImages.value.length >= maxImages) {
        alert(`最多只能上传 ${maxImages} 张图片`)
        return
      }

      try {
        const imageInfo = await processImageFile(file)
        attachedImages.value.push(imageInfo)
      } catch (error: any) {
        alert(error.message || '图片处理失败')
      }
      return
    }
  }
}

// TTS 播报
function speakText(text: string) {
  if (isSpeaking.value) {
    speechService.stopSpeaking()
    isSpeaking.value = false
  } else {
    speechService.speak(text, {
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

// 清理
onUnmounted(() => {
  stopRecording()
  revokeImageUrls(attachedImages.value)
  speechService.stopSpeaking()
})

// 暴露方法给父组件
defineExpose({
  speakText,
  stopSpeaking: () => {
    speechService.stopSpeaking()
    isSpeaking.value = false
  }
})
</script>

<template>
  <div class="multimodal-input">
    <!-- 图片预览区 -->
    <div v-if="attachedImages.length > 0" class="image-preview-area">
      <div 
        v-for="(img, index) in attachedImages" 
        :key="index"
        class="preview-item"
      >
        <img :src="img.url" :alt="`附件 ${index + 1}`" />
        <button class="remove-btn" @click="removeImage(index)">×</button>
        <span class="image-size">{{ (img.size / 1024).toFixed(0) }}KB</span>
      </div>
    </div>

    <!-- 录音中提示 -->
    <div v-if="isRecording" class="recording-indicator">
      <span class="pulse-dot"></span>
      <span class="recording-text">录音中...</span>
      <span v-if="interimTranscript" class="interim-text">{{ interimTranscript }}</span>
    </div>

    <!-- 主输入区 -->
    <div class="input-wrapper">
      <!-- 附件按钮组 -->
      <div class="action-buttons left">
        <!-- 图片上传 -->
        <label 
          v-if="supportsVision"
          class="action-btn" 
          title="上传图片 (最多4张)"
        >
          <input 
            type="file" 
            accept="image/*" 
            multiple 
            @change="handleImageSelect"
            style="display: none"
          />
          <span class="btn-icon">🖼️</span>
        </label>

        <!-- 语音输入 -->
        <button 
          v-if="supportsSpeech"
          class="action-btn" 
          :class="{ active: isRecording, recording: isRecording }"
          title="语音输入"
          @click="toggleRecording"
        >
          <span class="btn-icon">{{ isRecording ? '🔴' : '🎤' }}</span>
        </button>
      </div>

      <!-- 文本输入框 -->
      <textarea
        ref="textareaRef"
        v-model="inputText"
        :placeholder="placeholder || '输入消息... (Enter 发送, Shift+Enter 换行)'"
        :disabled="isStreaming"
        class="message-input"
        rows="1"
        @keydown="handleKeydown"
        @paste="handlePaste"
      ></textarea>

      <!-- 发送按钮组 -->
      <div class="action-buttons right">
        <!-- 发送/停止按钮 -->
        <button 
          class="send-btn"
          :class="{ stop: isStreaming, disabled: !canSend && !isStreaming }"
          :disabled="!canSend && !isStreaming"
          @click="sendMessage"
        >
          <span v-if="isStreaming" class="btn-icon">⏹</span>
          <span v-else class="btn-icon">➤</span>
        </button>
      </div>
    </div>

    <!-- 功能提示 -->
    <div class="input-hints">
      <span v-if="supportsVision" class="hint-item">
        📷 支持粘贴或拖拽图片
      </span>
      <span v-if="attachedImages.length > 0" class="hint-item active">
        已附 {{ attachedImages.length }}/{{ maxImages }} 图
      </span>
    </div>
  </div>
</template>

<style scoped>
.multimodal-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

/* ===== 图片预览区 ===== */
.image-preview-area {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 0;
}

.preview-item {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 2px solid var(--border);
  transition: all 0.2s;
}

.preview-item:hover {
  border-color: var(--primary);
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-item .remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.preview-item:hover .remove-btn {
  opacity: 1;
}

.preview-item .image-size {
  position: absolute;
  bottom: 2px;
  left: 2px;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 1px 4px;
  border-radius: 4px;
}

/* ===== 录音指示器 ===== */
.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.1), transparent);
  border-radius: var(--radius-sm);
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.pulse-dot {
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

.recording-text {
  font-size: 0.85rem;
  color: #ef4444;
  font-weight: 500;
}

.interim-text {
  flex: 1;
  font-size: 0.9rem;
  color: var(--text-light);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 主输入区 ===== */
.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  transition: all 0.2s;
}

.input-wrapper:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--surface);
  border-color: var(--border);
}

.action-btn.active {
  background: rgba(99, 102, 241, 0.1);
  border-color: var(--primary);
}

.action-btn.recording {
  animation: recordPulse 1.5s infinite;
}

@keyframes recordPulse {
  0%, 100% { background: rgba(239, 68, 68, 0.1); }
  50% { background: rgba(239, 68, 68, 0.25); }
}

.btn-icon {
  font-size: 1.1rem;
}

/* 文本输入框 */
.message-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text);
  resize: none;
  outline: none;
  max-height: 200px;
  min-height: 24px;
}

.message-input::placeholder {
  color: var(--text-light);
}

.message-input:disabled {
  opacity: 0.6;
}

/* 发送按钮 */
.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.send-btn.stop {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.send-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.send-btn .btn-icon {
  color: white;
  font-size: 1rem;
}

/* ===== 功能提示 ===== */
.input-hints {
  display: flex;
  gap: 12px;
  padding-left: 4px;
}

.hint-item {
  font-size: 0.75rem;
  color: var(--text-light);
}

.hint-item.active {
  color: var(--primary);
  font-weight: 500;
}

/* ===== 响应式 ===== */
@media (max-width: 600px) {
  .action-buttons.left {
    flex-direction: row;
  }
  
  .hint-item {
    display: none;
  }
}
</style>
