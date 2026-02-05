<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChatStore, useConfigStore } from '@/stores'
import { ROLE_MODES } from '@/stores/chat'
import SessionPanel from '@/components/chat/SessionPanel.vue'
import MessageList from '@/components/chat/MessageList.vue'
import MultimodalInput from '@/components/chat/MultimodalInput.vue'
import type { ImageInfo } from '@/utils/imageUtils'
import { speechService } from '@/services/speechService'

const chatStore = useChatStore()
const configStore = useConfigStore()

const inputMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const multimodalInputRef = ref<InstanceType<typeof MultimodalInput> | null>(null)
const showSettings = ref(false)
const showRoleDropdown = ref(false)

const canSend = computed(() => 
  inputMessage.value.trim().length > 0 && 
  configStore.isReady && 
  !chatStore.isStreaming
)

// 发送多模态消息（支持图片）
async function handleMultimodalSend(text: string, images: ImageInfo[]) {
  if (!chatStore.activeSessionId) return

  try {
    if (images.length > 0) {
      // 使用多模态发送
      await chatStore.sendMultimodalMessage(text, images)
    } else if (text.trim()) {
      // 普通文本发送
      await chatStore.sendMessage(text)
    }
  } catch (error) {
    console.error('发送消息失败:', error)
  }
}

async function handleToolExecuted(result: string) {
  if (!chatStore.activeSessionId) return
  
  try {
    await chatStore.sendMessage(`[工具执行结果]:\n${result}\n\n请根据此结果继续回答。`)
  } catch (error) {
    console.error('发送工具结果失败:', error)
  }
}

function handleStop() {
  chatStore.stopStreaming()
}

// TTS 播报消息
function speakMessage(content: string) {
  multimodalInputRef.value?.speakText(content)
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
  if (chatStore.activeSessionId && confirm('确定要清空当前会话吗？')) {
    chatStore.clearSession(chatStore.activeSessionId)
  }
}

function closeDropdowns(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.role-dropdown-wrapper')) {
    showRoleDropdown.value = false
  }
}

watch(() => chatStore.activeSession?.messages.length, () => {
  nextTick(() => scrollToBottom())
})

watch(() => chatStore.streamingMessageId, () => {
  nextTick(() => scrollToBottom())
})

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
    <!-- Session Panel -->
    <SessionPanel class="session-panel" />

    <!-- Chat Main Area -->
    <div class="chat-main">
      <!-- Top Info Bar -->
      <div class="chat-info-bar">
        <div class="info-left">
          <div class="info-card">
            <span class="info-label">会话概览</span>
            <span class="info-value">{{ chatStore.sessionStats.count }} 条记录</span>
            <span v-if="chatStore.sessionStats.time" class="info-hint">
              {{ chatStore.sessionStats.time }}
            </span>
          </div>
          
          <!-- Role Selector -->
          <div class="info-card role-dropdown-wrapper">
            <span class="info-label">角色设定</span>
            <button 
              class="role-pill" 
              @click.stop="showRoleDropdown = !showRoleDropdown"
            >
              {{ chatStore.currentRole.title }}
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
        </div>

        <div class="info-right">
          <button 
            class="icon-btn" 
            title="调整参数"
            :class="{ active: showSettings }"
            @click="showSettings = !showSettings"
          >
            ⚙️
          </button>
          <button 
            class="icon-btn" 
            title="清空会话"
            @click="clearCurrentSession"
          >
            🧹
          </button>
        </div>
      </div>

      <!-- Settings Panel -->
      <div v-if="showSettings" class="settings-panel">
        <div class="setting-item">
          <label>
            温度 (Temperature)
            <span class="setting-value">{{ chatStore.settings.temperature }}</span>
          </label>
          <input 
            type="range" 
            min="0" 
            max="2" 
            step="0.1"
            :value="chatStore.settings.temperature"
            @input="chatStore.updateSettings({ temperature: parseFloat(($event.target as HTMLInputElement).value) })"
          />
        </div>
        <div class="setting-item">
          <label>
            上下文长度
            <span class="setting-value">{{ chatStore.settings.contextLength }}</span>
          </label>
          <input 
            type="range" 
            min="1" 
            max="20" 
            step="1"
            :value="chatStore.settings.contextLength"
            @input="chatStore.updateSettings({ contextLength: parseInt(($event.target as HTMLInputElement).value) })"
          />
        </div>
        <div class="setting-toggles">
          <label class="toggle-label">
            <input 
              type="checkbox" 
              :checked="chatStore.settings.enableMemory"
              @change="chatStore.updateSettings({ enableMemory: ($event.target as HTMLInputElement).checked })"
            />
            🧠 上下文记忆
          </label>
          <label class="toggle-label">
            <input 
              type="checkbox" 
              :checked="chatStore.settings.enableStream"
              @change="chatStore.updateSettings({ enableStream: ($event.target as HTMLInputElement).checked })"
            />
            ⚡ 流式响应
          </label>
          <label class="toggle-label rag-toggle">
            <input 
              type="checkbox" 
              :checked="chatStore.settings.useRAG"
              @change="chatStore.updateSettings({ useRAG: ($event.target as HTMLInputElement).checked })"
            />
            📂 关联知识库 (RAG)
          </label>
        </div>
      </div>

      <!-- Messages Area -->
      <div 
        ref="messagesContainer"
        class="chat-messages"
      >
        <MessageList 
          v-if="chatStore.activeSession"
          :messages="chatStore.activeSession.messages"
          @tool-executed="handleToolExecuted"
        />
        <div v-else class="empty-state">
          <span class="empty-icon">💬</span>
          <h3>选择或创建一个对话</h3>
          <p>从左侧会话列表选择或点击 "+" 创建新对话</p>
        </div>
      </div>

      <MultimodalInput
        ref="multimodalInputRef"
        v-model="inputMessage"
        :can-send="canSend"
        :is-streaming="chatStore.isStreaming"
        :placeholder="`【${chatStore.currentRole.title}】输入消息或上传图片... (Enter 发送)`"
        @send="handleMultimodalSend"
        @stop="handleStop"
      />
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 20px;
  height: 100%;
  background: var(--secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.session-panel {
  background: rgba(255, 255, 255, 0.85);
  border-radius: var(--radius-lg);
}

.chat-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  padding: var(--space-md);
}

/* Info Bar */
.chat-info-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-lg);
  padding: 14px 18px;
  gap: 16px;
}

.info-left {
  display: flex;
  gap: 24px;
}

.info-right {
  display: flex;
  gap: 8px;
}

.info-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
}

.info-label {
  font-size: 0.75rem;
  color: var(--text-light);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-weight: 600;
  color: var(--text);
}

.info-hint {
  font-size: 0.8rem;
  color: var(--text-light);
}

.role-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--secondary);
  border: 1px solid var(--border);
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.role-pill:hover {
  background: #e2e8f0;
}

.caret {
  font-size: 0.7rem;
}

.role-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 240px;
  overflow: hidden;
}

.role-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}

.role-option:hover {
  background: var(--secondary);
}

.role-option.active {
  background: rgba(0, 122, 255, 0.08);
}

.role-title {
  font-weight: 500;
  color: var(--text);
}

.role-desc {
  font-size: 0.8rem;
  color: var(--text-light);
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  background: var(--secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: #e2e8f0;
}

.icon-btn.active {
  background: rgba(0, 122, 255, 0.1);
  border-color: var(--primary);
}

/* Settings Panel */
.settings-panel {
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.setting-item {
  flex: 1;
  min-width: 180px;
}

.setting-item label {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text);
  margin-bottom: 8px;
}

.setting-value {
  font-weight: 600;
  color: var(--primary);
}

.setting-item input[type="range"] {
  width: 100%;
  accent-color: var(--primary);
}

.setting-toggles {
  display: flex;
  gap: 20px;
  align-items: center;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}

.toggle-label input {
  accent-color: var(--primary);
}

.rag-toggle {
  color: var(--primary);
  font-weight: 600;
  border-left: 2px solid var(--primary);
  padding-left: 12px;
}

/* Messages */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-xl);
  box-shadow: 0 35px 80px rgba(15, 23, 42, 0.08);
}

.empty-state {
  text-align: center;
  color: var(--text-light);
  padding: 60px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  margin: auto;
}

.empty-state h3 {
  color: var(--text);
  font-size: 1.25rem;
  margin: 0;
}

.empty-state p {
  margin: 0;
  font-size: 0.95rem;
}

.empty-icon {
  font-size: 2.5rem;
}

@media (max-width: 900px) {
  .chat-page {
    grid-template-columns: 1fr;
  }
  
  .session-panel {
    display: none;
  }
}
</style>
