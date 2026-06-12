<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import ImageAttachmentList from '@/components/chat/ImageAttachmentList.vue'
import { useImageAttachments } from '@/features/chat/composables/useImageAttachments'
import { speechService } from '@/services/speechService'
import type { ImageInfo } from '@/utils/imageUtils'

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

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isRecording = ref(false)
const interimTranscript = ref('')
const speechError = ref('')
const supportsSpeech = computed(() => speechService.isRecognitionSupported)
const inputText = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
const {
  images,
  errorMessage: imageError,
  maxImages,
  handleFileInput,
  handlePaste,
  removeImage,
  takeImages
} = useImageAttachments()
const canSubmit = computed(() => props.isStreaming || props.canSend || images.value.length > 0)

watch(inputText, () => {
  if (!textareaRef.value) return
  textareaRef.value.style.height = 'auto'
  textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 200)}px`
})

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return
  event.preventDefault()
  if (!props.isStreaming) sendMessage()
}

function sendMessage() {
  if (props.isStreaming) {
    emit('stop')
    return
  }

  const text = inputText.value.trim()
  if (!text && images.value.length === 0) return
  emit('send', text, takeImages())
  inputText.value = ''
}

function toggleRecording() {
  if (isRecording.value) {
    stopRecording()
    return
  }

  speechError.value = ''
  speechService.startRecognition({
    onStart: () => {
      isRecording.value = true
      interimTranscript.value = ''
    },
    onResult: (result) => {
      if (result.isFinal) {
        inputText.value += `${inputText.value ? ' ' : ''}${result.transcript}`
        interimTranscript.value = ''
      } else {
        interimTranscript.value = result.transcript
      }
    },
    onEnd: () => stopRecording(),
    onError: (error) => {
      speechError.value = error
      stopRecording()
    }
  })
}

function stopRecording() {
  speechService.stopRecognition()
  isRecording.value = false
  interimTranscript.value = ''
}

function speakText(text: string) {
  speechService.speak(text)
}

onUnmounted(() => {
  stopRecording()
  speechService.stopSpeaking()
})

defineExpose({
  speakText,
  stopSpeaking: () => speechService.stopSpeaking()
})
</script>

<template>
  <div class="composer">
    <ImageAttachmentList v-if="images.length" :images="images" @remove="removeImage" />

    <div v-if="isRecording" class="recording-status">
      <span></span>
      Listening
      <em v-if="interimTranscript">{{ interimTranscript }}</em>
    </div>

    <div class="input-row">
      <label class="tool-btn" title="Attach images">
        <input type="file" accept="image/*" multiple hidden @change="handleFileInput" />
        IMG
      </label>
      <button
        v-if="supportsSpeech"
        type="button"
        class="tool-btn"
        :class="{ active: isRecording }"
        title="Voice input"
        @click="toggleRecording"
      >
        {{ isRecording ? 'REC' : 'MIC' }}
      </button>

      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="message-input"
        :placeholder="placeholder || 'Type a message'"
        rows="1"
        @keydown="handleKeydown"
        @paste="handlePaste"
      ></textarea>

      <button
        type="button"
        class="send-btn"
        :class="{ stop: isStreaming }"
        :disabled="!canSubmit"
        @click="sendMessage"
      >
        {{ isStreaming ? 'Stop' : 'Send' }}
      </button>
    </div>

    <div class="composer-meta">
      <span>Enter to send | Shift+Enter for a new line</span>
      <span v-if="images.length">{{ images.length }}/{{ maxImages }} images</span>
      <span v-if="imageError || speechError" class="error">{{ imageError || speechError }}</span>
    </div>
  </div>
</template>

<style scoped>
.composer {
  display: grid;
  flex-shrink: 0;
  gap: 7px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
  background: #ffffff;
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
}

.input-row:focus-within {
  border-color: var(--primary);
}

textarea {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  max-height: 200px;
  padding: 6px 4px;
  border: 0;
  outline: 0;
  resize: none;
  color: var(--text);
  font: inherit;
  line-height: 1.45;
}

.tool-btn,
.send-btn {
  display: inline-flex;
  min-width: 40px;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #f8fafc;
  color: var(--text);
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
}

.tool-btn.active {
  border-color: var(--error);
  color: var(--error);
}

.send-btn {
  min-width: 58px;
  border-color: var(--primary);
  background: var(--primary);
  color: #ffffff;
  font-size: 0.82rem;
}

.send-btn.stop {
  border-color: var(--error);
  background: var(--error);
}

.send-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.composer-meta,
.recording-status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-light);
  font-size: 0.7rem;
}

.recording-status span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--error);
}

.recording-status em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-meta .error {
  color: var(--error);
}

@media (max-width: 600px) {
  .composer-meta span:first-child {
    display: none;
  }
}
</style>
