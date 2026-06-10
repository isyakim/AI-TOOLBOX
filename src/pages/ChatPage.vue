<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useConfigStore } from '@/stores'
import { ROLE_MODES, useChatStore } from '@/stores/chat'
import SessionPanel from '@/components/chat/SessionPanel.vue'
import MessageList from '@/components/chat/MessageList.vue'
import MultimodalInput from '@/components/chat/MultimodalInput.vue'
import type { ImageInfo } from '@/utils/imageUtils'

const chatStore = useChatStore()
const configStore = useConfigStore()

const inputMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const showSettings = ref(false)
const showRoleDropdown = ref(false)

const canSend = computed(() => inputMessage.value.trim().length > 0 && !chatStore.isStreaming)

async function handleMultimodalSend(text: string, images: ImageInfo[]) {
  if (!chatStore.activeSessionId) {
    chatStore.createSession()
  }

  if (!chatStore.activeSessionId) return

  if (!configStore.isReady) {
    chatStore.addMessage(chatStore.activeSessionId, {
      role: 'user',
      content: text.trim() || '[Image message]'
    })
    chatStore.addMessage(chatStore.activeSessionId, {
      role: 'system',
      content:
        'API is not configured yet. The input test was recorded locally; add a provider in Settings to get AI responses.'
    })
    return
  }

  try {
    if (images.length > 0) {
      await chatStore.sendMultimodalMessage(text, images)
    } else if (text.trim()) {
      await chatStore.sendMessage(text)
    }
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

async function handleToolExecuted(result: string) {
  if (!chatStore.activeSessionId) return

  try {
    await chatStore.sendMessage(`[Tool execution result]\n${result}\n\nContinue from this result.`)
  } catch (error) {
    console.error('Failed to send tool result:', error)
  }
}

function handleStop() {
  chatStore.stopStreaming()
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function selectRole(roleId: string) {
  chatStore.setRole(roleId)
  showRoleDropdown.value = false
}

function clearCurrentSession() {
  if (chatStore.activeSessionId && confirm('Clear the current conversation?')) {
    chatStore.clearSession(chatStore.activeSessionId)
  }
}

function closeDropdowns(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.role-dropdown-wrapper')) {
    showRoleDropdown.value = false
  }
}

watch(
  () => chatStore.activeSession?.messages.length,
  () => {
    nextTick(scrollToBottom)
  }
)

watch(
  () => chatStore.activeSession?.messages.map((message) => message.content).join('\n'),
  () => {
    nextTick(scrollToBottom)
  }
)

watch(
  () => chatStore.streamingMessageId,
  () => {
    nextTick(scrollToBottom)
  }
)

onMounted(() => {
  scrollToBottom()
  document.addEventListener('click', closeDropdowns)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdowns)
})
</script>

<template>
  <div class="chat-page">
    <SessionPanel class="session-panel" />

    <section class="chat-workspace">
      <header class="chat-toolbar">
        <div class="toolbar-left">
          <div class="metric">
            <span class="metric-label">Messages</span>
            <strong>{{ chatStore.sessionStats.count }}</strong>
          </div>

          <div class="role-dropdown-wrapper">
            <button class="role-btn" @click.stop="showRoleDropdown = !showRoleDropdown">
              <span>{{ chatStore.currentRole.title }}</span>
              <span class="caret">▾</span>
            </button>
            <div v-if="showRoleDropdown" class="role-dropdown">
              <button
                v-for="role in ROLE_MODES"
                :key="role.id"
                class="role-option"
                :class="{ active: role.id === chatStore.currentRoleId }"
                @click="selectRole(role.id)"
              >
                <span class="role-title">{{ role.title }}</span>
                <span class="role-desc">{{ role.desc }}</span>
              </button>
            </div>
          </div>

          <label class="rag-toggle">
            <input
              type="checkbox"
              :checked="chatStore.settings.useRAG"
              @change="
                chatStore.updateSettings({ useRAG: ($event.target as HTMLInputElement).checked })
              "
            />
            Project context
          </label>
        </div>

        <div class="toolbar-actions">
          <button
            class="toolbar-btn"
            :class="{ active: showSettings }"
            @click="showSettings = !showSettings"
          >
            Parameters
          </button>
          <button class="toolbar-btn danger" @click="clearCurrentSession">Clear</button>
        </div>
      </header>

      <div v-if="showSettings" class="settings-panel">
        <label class="setting-item">
          <span>Temperature</span>
          <strong>{{ chatStore.settings.temperature }}</strong>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            :value="chatStore.settings.temperature"
            @input="
              chatStore.updateSettings({
                temperature: parseFloat(($event.target as HTMLInputElement).value)
              })
            "
          />
        </label>
        <label class="setting-item">
          <span>Context turns</span>
          <strong>{{ chatStore.settings.contextLength }}</strong>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            :value="chatStore.settings.contextLength"
            @input="
              chatStore.updateSettings({
                contextLength: parseInt(($event.target as HTMLInputElement).value)
              })
            "
          />
        </label>
        <label class="checkbox-setting">
          <input
            type="checkbox"
            :checked="chatStore.settings.enableMemory"
            @change="
              chatStore.updateSettings({
                enableMemory: ($event.target as HTMLInputElement).checked
              })
            "
          />
          Keep conversation memory
        </label>
        <label class="checkbox-setting">
          <input
            type="checkbox"
            :checked="chatStore.settings.enableStream"
            @change="
              chatStore.updateSettings({
                enableStream: ($event.target as HTMLInputElement).checked
              })
            "
          />
          Stream response
        </label>
      </div>

      <div ref="messagesContainer" class="chat-messages">
        <MessageList
          v-if="chatStore.activeSession"
          :messages="chatStore.activeSession.messages"
          @tool-executed="handleToolExecuted"
        />
        <div v-else class="empty-state">
          <h3>No active session</h3>
          <p>Create or select a conversation from the session list.</p>
        </div>
      </div>

      <MultimodalInput
        v-model="inputMessage"
        :can-send="canSend"
        :is-streaming="chatStore.isStreaming"
        :placeholder="`${chatStore.currentRole.title}: ask about code, docs, diffs, or project context...`"
        @send="handleMultimodalSend"
        @stop="handleStop"
      />
    </section>
  </div>
</template>

<style scoped>
.chat-page {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  height: 100%;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 8px;
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

.chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: #ffffff;
}

.toolbar-left,
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.metric {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-light);
  font-size: 0.78rem;
}

.metric strong {
  color: var(--text);
}

.metric-label {
  text-transform: uppercase;
  font-size: 0.68rem;
  font-weight: 700;
}

.role-dropdown-wrapper {
  position: relative;
}

.role-btn,
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 560;
}

.role-btn:hover,
.toolbar-btn:hover,
.toolbar-btn.active {
  border-color: #9fb0c8;
  background: #f8fafc;
}

.toolbar-btn.danger {
  color: var(--error);
}

.caret {
  color: var(--text-light);
  font-size: 0.72rem;
}

.role-dropdown {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  width: 280px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
}

.role-option {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.role-option:hover,
.role-option.active {
  background: #f8fafc;
}

.role-title {
  color: var(--text);
  font-weight: 650;
}

.role-desc {
  color: var(--text-light);
  font-size: 0.78rem;
}

.rag-toggle,
.checkbox-setting {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-light);
  font-size: 0.82rem;
  cursor: pointer;
}

.rag-toggle input,
.checkbox-setting input {
  accent-color: var(--primary);
}

.settings-panel {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  background: #f8fafc;
}

.setting-item {
  display: grid;
  grid-template-columns: auto 32px 140px;
  align-items: center;
  gap: 8px;
  color: var(--text-light);
  font-size: 0.8rem;
}

.setting-item strong {
  color: var(--text);
}

.setting-item input[type='range'] {
  accent-color: var(--primary);
}

.chat-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px;
  background: #ffffff;
}

.empty-state {
  display: grid;
  height: 100%;
  place-content: center;
  color: var(--text-light);
  text-align: center;
}

.empty-state h3 {
  margin-bottom: 4px;
  color: var(--text);
  font-size: 1rem;
}

@media (max-width: 900px) {
  .chat-page {
    grid-template-columns: 1fr;
  }

  .session-panel {
    display: none;
  }

  .chat-toolbar,
  .settings-panel {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
