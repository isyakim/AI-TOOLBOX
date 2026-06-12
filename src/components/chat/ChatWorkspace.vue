<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import MessageList from './MessageList.vue'
import MultimodalInput from './MultimodalInput.vue'
import { useChatConversation } from '@/features/chat/composables/useChatConversation'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const conversation = useChatConversation()
const inputMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const canSend = computed(() => inputMessage.value.trim().length > 0 && !chatStore.isStreaming)

function scrollToBottom() {
  if (messagesContainer.value)
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}

watch(
  () => chatStore.activeSession?.messages.map((message) => message.content).join('\n'),
  () => nextTick(scrollToBottom),
  { immediate: true }
)
</script>

<template>
  <div ref="messagesContainer" class="chat-messages">
    <MessageList
      v-if="chatStore.activeSession"
      :messages="chatStore.activeSession.messages"
      @tool-executed="conversation.continueFromTool"
    />
    <div v-else class="empty-state">
      <h3>No active session</h3>
      <p>Create or select a conversation from the session list.</p>
    </div>
  </div>

  <p v-if="conversation.errorMessage.value" class="conversation-error">
    {{ conversation.errorMessage.value }}
  </p>

  <MultimodalInput
    v-model="inputMessage"
    :can-send="canSend"
    :is-streaming="chatStore.isStreaming"
    :placeholder="`${chatStore.currentRole.title}: ask about code, docs, diffs, or project context...`"
    @send="conversation.send"
    @stop="conversation.stop"
  />
</template>

<style scoped>
.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.empty-state {
  display: grid;
  height: 100%;
  place-content: center;
  color: var(--text-light);
  text-align: center;
}

.conversation-error {
  margin: 0;
  padding: 7px 12px;
  border-top: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.78rem;
}
</style>
