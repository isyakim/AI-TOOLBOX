<script setup lang="ts">
import type { RAGIndexStatus } from '@/shared/types/ipc'

defineProps<{ status: RAGIndexStatus; progress: number }>()
</script>

<template>
  <section class="panel">
    <h2>Index status</h2>
    <div class="metrics">
      <div>
        <span>Status</span><strong>{{ status.status }}</strong>
      </div>
      <div>
        <span>Files</span><strong>{{ status.indexedFiles }} / {{ status.totalFiles }}</strong>
      </div>
      <div>
        <span>Chunks</span><strong>{{ status.totalChunks }}</strong>
      </div>
      <div>
        <span>Current</span><strong>{{ status.currentFile || '-' }}</strong>
      </div>
    </div>
    <div class="progress"><span :style="{ width: `${progress}%` }"></span></div>
    <p>{{ status.message || 'No active index job.' }}</p>
  </section>
</template>

<style scoped>
.panel {
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
}

h2,
p {
  margin: 0;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.metrics div {
  display: grid;
  min-width: 0;
  gap: 3px;
  padding: 10px;
  border-radius: 6px;
  background: #f8fafc;
}

.metrics span,
p {
  color: var(--text-light);
  font-size: 0.74rem;
}

.metrics strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress {
  height: 6px;
  margin: 14px 0 9px;
  overflow: hidden;
  border-radius: 3px;
  background: #e2e8f0;
}

.progress span {
  display: block;
  height: 100%;
  background: var(--primary);
}
</style>
