<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ActivityLog from '@/components/knowledge/ActivityLog.vue'
import HealthReportPanel from '@/components/knowledge/HealthReportPanel.vue'
import IndexStatusPanel from '@/components/knowledge/IndexStatusPanel.vue'
import ProjectSelector from '@/components/knowledge/ProjectSelector.vue'
import {
  KNOWLEDGE_EXTENSIONS,
  useKnowledgeWorkspace
} from '@/features/knowledge/composables/useKnowledgeWorkspace'
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue'

const workspace = useKnowledgeWorkspace()
const clearDialogOpen = ref(false)

async function clearKnowledge() {
  await workspace.clearKnowledge()
  clearDialogOpen.value = false
}

onMounted(() => void workspace.restore())
</script>

<template>
  <div class="knowledge-page">
    <header class="page-header">
      <div>
        <p>LOCAL PROJECT</p>
        <h1>Project knowledge</h1>
      </div>
      <div class="header-actions">
        <button @click="clearDialogOpen = true">Clear index</button>
        <button :disabled="workspace.isInitializing.value" @click="workspace.initialize">
          {{ workspace.isInitializing.value ? 'Initializing...' : 'Initialize database' }}
        </button>
      </div>
    </header>

    <ProjectSelector
      :project-path="workspace.projectPath.value"
      :extensions="workspace.selectedExtensions.value"
      :extension-options="KNOWLEDGE_EXTENSIONS"
      :can-index="workspace.canIndex.value"
      :is-indexing="workspace.isIndexing.value"
      :is-checking="workspace.isChecking.value"
      @choose="workspace.chooseDirectory"
      @toggle-extension="workspace.toggleExtension"
      @index="workspace.indexProject"
      @health-check="workspace.runHealthCheck"
    />

    <div class="main-grid">
      <IndexStatusPanel
        :status="workspace.indexStatus.value"
        :progress="workspace.progressPercent.value"
      />
      <HealthReportPanel :report="workspace.healthReport.value" />
    </div>
    <ActivityLog :entries="workspace.activityLog.value" />
  </div>

  <ConfirmDialog
    :open="clearDialogOpen"
    title="Clear project knowledge"
    message="This removes all indexed project chunks and the local index manifest. Source files are not changed."
    confirm-label="Clear index"
    destructive
    @confirm="clearKnowledge"
    @cancel="clearDialogOpen = false"
  />
</template>

<style scoped>
.knowledge-page {
  display: grid;
  height: 100%;
  gap: 14px;
  overflow: auto;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #f8fafc;
}

.page-header,
.header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.page-header p,
.page-header h1 {
  margin: 0;
}

.page-header p {
  color: var(--text-light);
  font-size: 0.68rem;
  font-weight: 700;
}

.header-actions button {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
  color: var(--text);
  cursor: pointer;
}

.header-actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

@media (max-width: 900px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}
</style>
