<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '@/stores'

const chatStore = useChatStore()

function createSession() {
  chatStore.createSession()
}

function handleSearch(e: Event) {
  const value = (e.target as HTMLInputElement).value
  chatStore.setSearchKeyword(value)
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return date.toLocaleDateString('zh-CN')
}

function deleteSession(id: string, e: Event) {
  e.stopPropagation()
  if (confirm('确定要删除这个会话吗？')) {
    chatStore.deleteSession(id)
  }
}
</script>

<template>
  <aside class="session-panel">
    <div class="panel-header">
      <div class="header-text">
        <span class="eyebrow">会话集</span>
        <h3>全部对话</h3>
      </div>
      <button class="add-btn" @click="createSession" title="新建会话">
        ＋
      </button>
    </div>

    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input 
        type="text" 
        placeholder="搜索会话或关键字..."
        :value="chatStore.searchKeyword"
        @input="handleSearch"
      />
    </div>

    <div class="session-list">
      <div 
        v-for="session in chatStore.filteredSessions" 
        :key="session.id"
        class="session-item"
        :class="{ active: session.id === chatStore.activeSessionId }"
        @click="chatStore.switchSession(session.id)"
      >
        <div class="session-content">
          <span class="session-title">{{ session.title }}</span>
          <span class="session-meta">
            {{ session.messages.length }} 条 · {{ formatTime(session.updatedAt) }}
          </span>
        </div>
        <button 
          class="delete-btn"
          @click="deleteSession(session.id, $event)"
          title="删除会话"
        >
          🗑️
        </button>
      </div>

      <div v-if="chatStore.filteredSessions.length === 0" class="empty-list">
        {{ chatStore.searchKeyword ? '未找到匹配的会话' : '暂无会话' }}
      </div>
    </div>
  </aside>
</template>

<style scoped>
.session-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-md);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.eyebrow {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-light);
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.add-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  background: var(--primary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.add-btn:hover {
  transform: scale(1.05);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  margin-bottom: var(--space-md);
}

.search-icon {
  font-size: 0.9rem;
}

.search-box input {
  border: none;
  flex: 1;
  font-size: 0.9rem;
  background: transparent;
}

.search-box input:focus {
  outline: none;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: white;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
}

.session-item:hover {
  border-color: var(--border);
}

.session-item.active {
  background: rgba(0, 122, 255, 0.08);
  border-color: var(--primary);
}

.session-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.session-title {
  font-weight: 500;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  font-size: 0.75rem;
  color: var(--text-light);
}

.delete-btn {
  opacity: 0;
  background: transparent;
  border: none;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
}

.session-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

.empty-list {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-light);
  font-size: 0.9rem;
}
</style>
