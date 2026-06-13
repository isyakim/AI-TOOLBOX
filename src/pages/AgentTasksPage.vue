<script setup lang="ts">
import { onMounted } from 'vue'
import AgentChangeSetPanel from '@/features/agent/components/AgentChangeSetPanel.vue'
import AgentPlanPanel from '@/features/agent/components/AgentPlanPanel.vue'
import AgentTaskSidebar from '@/features/agent/components/AgentTaskSidebar.vue'
import AgentVerificationPanel from '@/features/agent/components/AgentVerificationPanel.vue'
import { useAgentTaskWorkspace } from '@/features/agent/composables/useAgentTaskWorkspace'
import '@/features/agent/agent.css'

const workflow = useAgentTaskWorkspace()
const { agent, workspace } = workflow

onMounted(() => void agent.load())
</script>

<template>
  <div class="agent-page">
    <AgentTaskSidebar
      v-model:objective="workflow.objective.value"
      :tasks="agent.tasks"
      :active-task-id="agent.activeTaskId"
      :can-create="Boolean(workspace.activeProjectId)"
      @create="workflow.createTask"
      @select="agent.selectTask"
    />

    <main class="task-workspace">
      <div v-if="!workspace.activeProject" class="empty-main">
        Select and index a project before creating an Agent task.
      </div>
      <div v-else-if="!agent.activeTask" class="empty-main">
        Create a task to begin with an approval-gated plan.
      </div>
      <template v-else>
        <header class="task-header">
          <div>
            <p>{{ workspace.activeProject.name }} / {{ agent.activeTask.id.slice(0, 8) }}</p>
            <h2>{{ agent.activeTask.objective }}</h2>
          </div>
          <span class="status">{{ agent.activeTask.status.replace('_', ' ') }}</span>
        </header>

        <p v-if="agent.error" class="error">{{ agent.error }}</p>

        <AgentPlanPanel
          v-model="workflow.planText.value"
          :task="agent.activeTask"
          @generate="workflow.generatePlan"
          @save="workflow.savePlan"
          @approve="agent.run(agent.approvePlan)"
        />
        <AgentChangeSetPanel
          v-model:files="workflow.proposedFiles"
          :task-status="agent.activeTask.status"
          :change-set="agent.changeSet"
          :execution-message="workflow.executionMessage.value"
          @add="workflow.addFile"
          @remove="workflow.removeFile"
          @preview="workflow.previewChanges"
          @approve="agent.run(agent.approveChanges)"
          @execute="workflow.executeChanges"
        />
        <AgentVerificationPanel
          :task-status="agent.activeTask.status"
          :commands="agent.commands"
          :results="agent.results"
          @discover="agent.run(agent.loadCommands)"
          @approve="(id) => agent.run(() => agent.approveCommand(id))"
          @run="(id) => agent.run(() => agent.runCommand(id))"
        />

        <button
          v-if="!['completed', 'failed', 'cancelled'].includes(agent.activeTask.status)"
          class="cancel-task"
          @click="agent.run(agent.cancelTask)"
        >
          Cancel task
        </button>
      </template>
    </main>
  </div>
</template>
