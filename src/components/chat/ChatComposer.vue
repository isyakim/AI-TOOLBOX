<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  canSend: boolean
  isStreaming: boolean
  placeholder?: string
}>(), {
  placeholder: '输入你的问题... (Enter 发送, Shift+Enter 换行)'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'send': []
  'stop': []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

function handleKeydown(e: KeyboardEvent) {
  // Cmd/Ctrl + Enter 或者单独 Enter 发送
  if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (e.key === 'Enter' && !e.shiftKey)) {
    e.preventDefault()
    if (props.canSend) {
      emit('send')
    }
  }
}

function handleButtonClick() {
  if (props.isStreaming) {
    emit('stop')
  } else if (props.canSend) {
    emit('send')
  }
}

function autoResize() {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px'
  }
}

watch(inputValue, () => {
  setTimeout(autoResize, 0)
})
</script>

<template>
  <div class="chat-composer">
    <div class="composer-toolbar">
      <div class="toolbar-left">
        <button class="tool-btn" title="添加附件 (开发中)" disabled>📎</button>
        <button class="tool-btn" title="语音输入 (开发中)" disabled>🎤</button>
        <button class="tool-btn" title="AI 提示建议">✨</button>
      </div>
      <div class="toolbar-hint">
        ⌘ + Enter 发送 · Shift + Enter 换行
      </div>
    </div>

    <div class="composer-body">
      <textarea
        ref="textareaRef"
        v-model="inputValue"
        class="chat-input"
        :placeholder="placeholder"
        rows="2"
        :disabled="isStreaming"
        @keydown="handleKeydown"
        @input="autoResize"
      ></textarea>
      
      <div class="composer-actions">
        <button 
          v-if="isStreaming"
          class="stop-btn"
          @click="handleButtonClick"
        >
          暂停
        </button>
        <button 
          class="send-btn"
          :class="{ streaming: isStreaming }"
          :disabled="!canSend && !isStreaming"
          @click="handleButtonClick"
        >
          <span v-if="isStreaming">⏹</span>
          <span v-else>⮚</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-composer {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.composer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.toolbar-left {
  display: flex;
  gap: 4px;
}

.tool-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.15s;
}

.tool-btn:hover:not(:disabled) {
  background: var(--secondary);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-hint {
  font-size: 0.75rem;
  color: var(--text-light);
}

.composer-body {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  align-items: flex-end;
}

.chat-input {
  border: none;
  flex: 1;
  font-size: 1rem;
  background: transparent;
  resize: none;
  min-height: 24px;
  max-height: 200px;
  color: var(--text);
  font-family: inherit;
  line-height: 1.5;
}

.chat-input:focus {
  outline: none;
}

.chat-input::placeholder {
  color: var(--text-light);
}

.chat-input:disabled {
  opacity: 0.6;
}

.composer-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.stop-btn {
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.15s;
}

.stop-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.send-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
  box-shadow: 0 10px 25px rgba(0, 122, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.send-btn.streaming {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.send-btn:not(:disabled):hover {
  transform: scale(1.05);
}
</style>
