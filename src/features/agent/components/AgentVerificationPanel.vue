<script setup lang="ts">
import type { AgentTaskStatus, CommandProposal, VerificationResult } from '@/shared/types/ipc'

defineProps<{
  taskStatus: AgentTaskStatus
  commands: CommandProposal[]
  results: VerificationResult[]
}>()
const emit = defineEmits<{
  discover: []
  approve: [proposalId: string]
  run: [proposalId: string]
}>()
</script>

<template>
  <section class="workflow-section">
    <div class="section-title">
      <div>
        <span>3</span>
        <h3>Verification</h3>
      </div>
      <button :disabled="taskStatus !== 'verifying'" @click="emit('discover')">
        Discover package scripts
      </button>
    </div>
    <div v-for="command in commands" :key="command.id" class="command-row">
      <div>
        <strong>npm run {{ command.scriptName }}</strong
        ><code>{{ command.command }}</code>
      </div>
      <button v-if="!command.approved" @click="emit('approve', command.id)">Approve</button>
      <button v-else class="primary" @click="emit('run', command.id)">Run</button>
    </div>
    <details v-for="result in results" :key="result.id">
      <summary>
        {{ result.scriptName }} / exit {{ result.exitCode }} / {{ result.durationMs }}ms
      </summary>
      <pre><code>{{ result.output || '(no output)' }}</code></pre>
    </details>
  </section>
</template>
