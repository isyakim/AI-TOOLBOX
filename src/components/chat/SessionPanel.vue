<script setup lang="ts">
import { useChatStore } from '@/stores/chat'
import { ref } from 'vue'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'

const chatStore = useChatStore()
const pendingDeleteId = ref<string | null>(null)

function createSession() {
  chatStore.createSession()
}

function handleSearch(event: Event) {
  chatStore.setSearchKeyword((event.target as HTMLInputElement).value)
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return new Date(timestamp).toLocaleDateString()
}

function deleteSession(id: string, event: Event) {
  event.stopPropagation()
  pendingDeleteId.value = id
}

function confirmDelete() {
  if (pendingDeleteId.value) chatStore.deleteSession(pendingDeleteId.value)
  pendingDeleteId.value = null
}
</script>

<template>
  <aside class="session-panel">
    <div class="panel-header">
      <div>
        <h2>Sessions</h2>
        <p>{{ chatStore.filteredSessions.length }} conversations</p>
      </div>
      <button class="new-btn" title="New session" @click="createSession">New</button>
    </div>

    <div class="search-box">
      <input
        type="text"
        placeholder="Search sessions"
        :value="chatStore.searchKeyword"
        @input="handleSearch"
      />
    </div>

    <div class="session-list">
      <button
        v-for="session in chatStore.filteredSessions"
        :key="session.id"
        class="session-item"
        :class="{ active: session.id === chatStore.activeSessionId }"
        @click="chatStore.switchSession(session.id)"
      >
        <span class="session-title">{{ session.title }}</span>
        <span class="session-meta">
          {{ session.messages.length }} messages · {{ formatTime(session.updatedAt) }}
        </span>
        <span class="delete-btn" title="Delete session" @click="deleteSession(session.id, $event)"
          >Delete</span
        >
      </button>

      <div v-if="chatStore.filteredSessions.length === 0" class="empty-list">
        No sessions found.
      </div>
    </div>
  </aside>
  <ConfirmDialog
    :open="Boolean(pendingDeleteId)"
    title="Delete conversation"
    message="This permanently removes the selected conversation and its messages."
    confirm-label="Delete conversation"
    destructive
    @confirm="confirmDelete"
    @cancel="pendingDeleteId = null"
  />
</template>

<style scoped>
.session-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.panel-header h2 {
  margin: 0;
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 700;
}

.panel-header p {
  margin: 2px 0 0;
  color: var(--text-light);
  font-size: 0.74rem;
}

.new-btn {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--primary);
  border-radius: 6px;
  background: var(--primary);
  color: #ffffff;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 650;
}

.search-box {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.search-box input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  outline: none;
}

.search-box input:focus {
  border-color: var(--primary);
}

.session-list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 58px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.session-item:hover {
  background: #ffffff;
  border-color: var(--border);
}

.session-item.active {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.session-title {
  width: 100%;
  overflow: hidden;
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-meta {
  color: var(--text-light);
  font-size: 0.72rem;
}

.delete-btn {
  position: absolute;
  right: 8px;
  bottom: 7px;
  display: none;
  color: var(--error);
  font-size: 0.7rem;
}

.session-item:hover .delete-btn {
  display: inline;
}

.empty-list {
  padding: 24px 10px;
  color: var(--text-light);
  font-size: 0.82rem;
  text-align: center;
}
</style>
