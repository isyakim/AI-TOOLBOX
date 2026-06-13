<script setup lang="ts">
import type { AgentTask } from '@/shared/types/ipc'

defineProps<{ task: AgentTask }>()
const planText = defineModel<string>({ required: true })
const emit = defineEmits<{ generate: []; save: []; approve: [] }>()
</script>

<template>
  <section class="workflow-section">
    <div class="section-title">
      <div>
        <span>1</span>
        <h3>Plan approval</h3>
      </div>
      <button v-if="task.status === 'awaiting_approval'" class="primary" @click="emit('approve')">
        Approve plan
      </button>
    </div>
    <textarea
      v-model="planText"
      rows="5"
      :disabled="task.status !== 'draft'"
      placeholder="One implementation step per line"
    />
    <div v-if="task.status === 'draft'" class="actions">
      <button @click="emit('generate')">Generate structured plan</button>
      <button class="primary" :disabled="!planText.trim()" @click="emit('save')">
        Submit plan for approval
      </button>
    </div>
  </section>
</template>
