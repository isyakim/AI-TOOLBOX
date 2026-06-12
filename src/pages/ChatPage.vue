<script setup lang="ts">
import { ref } from 'vue'
import ChatParametersPanel from '@/components/chat/ChatParametersPanel.vue'
import ChatToolbar from '@/components/chat/ChatToolbar.vue'
import ChatWorkspace from '@/components/chat/ChatWorkspace.vue'
import SessionPanel from '@/components/chat/SessionPanel.vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const parametersOpen = ref(false)
const clearDialogOpen = ref(false)

function clearCurrentSession() {
  if (chatStore.activeSessionId) chatStore.clearSession(chatStore.activeSessionId)
  clearDialogOpen.value = false
}
</script>

<template>
  <div class="chat-page">
    <SessionPanel class="session-panel" />
    <section class="chat-workspace">
      <ChatToolbar
        :message-count="chatStore.sessionStats.count"
        :current-role="chatStore.currentRole"
        :current-role-id="chatStore.currentRoleId"
        :settings="chatStore.settings"
        :parameters-open="parametersOpen"
        @select-role="chatStore.setRole"
        @update-settings="chatStore.updateSettings"
        @toggle-parameters="parametersOpen = !parametersOpen"
        @clear="clearDialogOpen = true"
      />
      <ChatParametersPanel
        v-if="parametersOpen"
        :settings="chatStore.settings"
        @update="chatStore.updateSettings"
      />
      <ChatWorkspace />
    </section>
  </div>

  <ConfirmDialog
    :open="clearDialogOpen"
    title="Clear conversation"
    message="This removes every message from the active conversation. This action cannot be undone."
    confirm-label="Clear conversation"
    destructive
    @confirm="clearCurrentSession"
    @cancel="clearDialogOpen = false"
  />
</template>

<style scoped>
.chat-page {
  display: grid;
  height: 100%;
  grid-template-columns: 300px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
}

.session-panel {
  min-width: 0;
  border-right: 1px solid var(--border);
  background: #f8fafc;
}

.chat-workspace {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

@media (max-width: 860px) {
  .chat-page {
    grid-template-columns: 1fr;
  }

  .session-panel {
    display: none;
  }
}
</style>
