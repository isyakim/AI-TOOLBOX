<script setup lang="ts">
import type { AgentTask } from '@/shared/types/ipc'

defineProps<{
  tasks: AgentTask[]
  activeTaskId: string | null
  canCreate: boolean
}>()

const objective = defineModel<string>('objective', { required: true })
const emit = defineEmits<{ create: []; select: [taskId: string] }>()
</script>

<template>
  <aside class="task-list">
    <header>
      <p>CONTROLLED EXECUTION</p>
      <h1>Agent tasks</h1>
    </header>
    <form class="new-task" @submit.prevent="emit('create')">
      <textarea v-model="objective" rows="3" placeholder="Describe the concrete task" />
      <button class="primary" :disabled="!objective.trim() || !canCreate">Create draft</button>
    </form>
    <button
      v-for="task in tasks"
      :key="task.id"
      class="task-row"
      :class="{ active: task.id === activeTaskId }"
      @click="emit('select', task.id)"
    >
      <strong>{{ task.objective }}</strong>
      <span>{{ task.status.replace('_', ' ') }}</span>
    </button>
    <p v-if="!tasks.length" class="empty">No tasks for the active project.</p>
  </aside>
</template>
