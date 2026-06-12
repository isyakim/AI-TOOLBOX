<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ROLE_MODES } from '@/features/chat/roles'
import type { ChatSettings, RoleMode } from '@/features/chat/types'

const props = defineProps<{
  messageCount: number
  currentRole: RoleMode
  currentRoleId: string
  settings: ChatSettings
  parametersOpen: boolean
}>()

const emit = defineEmits<{
  selectRole: [roleId: string]
  updateSettings: [settings: Partial<ChatSettings>]
  toggleParameters: []
  clear: []
}>()

const rolesOpen = ref(false)

function closeDropdown(event: MouseEvent) {
  if (!(event.target as HTMLElement).closest('.role-picker')) rolesOpen.value = false
}

function selectRole(roleId: string) {
  emit('selectRole', roleId)
  rolesOpen.value = false
}

onMounted(() => document.addEventListener('click', closeDropdown))
onBeforeUnmount(() => document.removeEventListener('click', closeDropdown))
</script>

<template>
  <header class="chat-toolbar">
    <div class="toolbar-left">
      <div class="metric">
        <span>Messages</span>
        <strong>{{ messageCount }}</strong>
      </div>

      <div class="role-picker">
        <button class="role-button" @click.stop="rolesOpen = !rolesOpen">
          {{ currentRole.title }} <span>▾</span>
        </button>
        <div v-if="rolesOpen" class="role-menu">
          <button
            v-for="role in ROLE_MODES"
            :key="role.id"
            :class="{ active: role.id === currentRoleId }"
            @click="selectRole(role.id)"
          >
            <strong>{{ role.title }}</strong>
            <span>{{ role.desc }}</span>
          </button>
        </div>
      </div>

      <label class="context-toggle">
        <input
          type="checkbox"
          :checked="settings.useRAG"
          @change="emit('updateSettings', { useRAG: ($event.target as HTMLInputElement).checked })"
        />
        Project context
      </label>
    </div>

    <div class="toolbar-actions">
      <button :class="{ active: props.parametersOpen }" @click="emit('toggleParameters')">
        Parameters
      </button>
      <button class="danger" @click="emit('clear')">Clear</button>
    </div>
  </header>
</template>

<style scoped>
.chat-toolbar,
.toolbar-left,
.toolbar-actions {
  display: flex;
  align-items: center;
}

.chat-toolbar {
  min-height: 58px;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: #ffffff;
}

.toolbar-left,
.toolbar-actions {
  gap: 8px;
}

.metric {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-right: 12px;
  border-right: 1px solid var(--border);
}

.metric span,
.context-toggle {
  color: var(--text-light);
  font-size: 0.76rem;
}

.role-picker {
  position: relative;
}

.role-button,
.toolbar-actions button {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  cursor: pointer;
}

.role-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  width: 280px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
}

.role-menu button {
  display: grid;
  width: 100%;
  gap: 3px;
  padding: 9px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.role-menu button:hover,
.role-menu button.active {
  background: #f1f5f9;
}

.role-menu span {
  color: var(--text-light);
  font-size: 0.72rem;
}

.context-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-actions button.active {
  border-color: var(--primary);
}

.toolbar-actions button.danger {
  color: var(--error);
}

@media (max-width: 760px) {
  .metric,
  .context-toggle {
    display: none;
  }
}
</style>
