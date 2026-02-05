<script setup lang="ts">
import MessageBubble from './MessageBubble.vue'
import type { MessageImage } from '@/stores/chat'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: MessageImage[]
}

defineProps<{
  messages: Message[]
}>()

const emit = defineEmits<{
  'toolExecuted': [result: string]
  'speak': [content: string]
}>()
</script>

<template>
  <div class="message-list">
    <MessageBubble
      v-for="msg in messages"
      :key="msg.id"
      :role="msg.role"
      :content="msg.content"
      :images="msg.images"
      @tool-executed="(res) => emit('toolExecuted', res)"
      @speak="(content) => emit('speak', content)"
    />
  </div>
</template>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}
</style>
