<script setup lang="ts">
import type { AgentTaskStatus, ChangeSet } from '@/shared/types/ipc'
import type { ProposedFileChange } from '../types'

defineProps<{
  taskStatus: AgentTaskStatus
  changeSet: ChangeSet | null
  executionMessage: string
}>()
const proposedFiles = defineModel<ProposedFileChange[]>('files', { required: true })
const emit = defineEmits<{
  add: []
  remove: [index: number]
  preview: []
  approve: []
  execute: []
}>()
</script>

<template>
  <section class="workflow-section" :class="{ disabled: taskStatus !== 'executing' && !changeSet }">
    <div class="section-title">
      <div>
        <span>2</span>
        <h3>ChangeSet</h3>
      </div>
      <button @click="emit('add')">Add file</button>
    </div>
    <div v-if="!changeSet" class="file-editor-list">
      <div v-for="(file, index) in proposedFiles" :key="index" class="file-editor">
        <input v-model="file.path" placeholder="Relative file path" />
        <select v-model="file.action">
          <option value="write">Write</option>
          <option value="delete">Delete</option>
        </select>
        <button v-if="proposedFiles.length > 1" @click="emit('remove', index)">Remove</button>
        <textarea
          v-if="file.action === 'write'"
          v-model="file.content"
          rows="6"
          placeholder="Complete replacement content"
        />
      </div>
      <button class="primary" :disabled="taskStatus !== 'executing'" @click="emit('preview')">
        Generate Diff preview
      </button>
    </div>
    <div v-else class="changeset">
      <div class="summary">
        <strong>{{ changeSet.files.length }} files</strong>
        <span class="added">+{{ changeSet.additions }}</span>
        <span class="deleted">-{{ changeSet.deletions }}</span>
        <span>{{ changeSet.approval }}</span>
      </div>
      <p v-for="risk in changeSet.risks" :key="risk" class="risk">{{ risk }}</p>
      <details v-for="file in changeSet.files" :key="file.path" open>
        <summary>{{ file.action.toUpperCase() }} {{ file.path }}</summary>
        <pre><code>{{ file.diff }}</code></pre>
      </details>
      <div class="actions">
        <button v-if="changeSet.approval === 'pending'" class="primary" @click="emit('approve')">
          Approve ChangeSet
        </button>
        <button v-if="changeSet.approval === 'approved'" class="danger" @click="emit('execute')">
          Execute approved changes
        </button>
        <span>{{ executionMessage }}</span>
      </div>
    </div>
  </section>
</template>
