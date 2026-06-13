<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useAgentStore } from '@/stores/agent'
import { useWorkspaceStore } from '@/stores/workspace'
import { generateAgentPlan } from '@/services/agentPlanner'

const agent = useAgentStore()
const workspace = useWorkspaceStore()
const objective = ref('')
const planText = ref('')
const executionMessage = ref('')
const proposedFiles = reactive<
  Array<{ path: string; action: 'write' | 'delete'; content: string }>
>([{ path: '', action: 'write', content: '' }])

watch(
  () => agent.activeTask,
  (task) => {
    planText.value = task?.plan.map((step) => step.title).join('\n') || ''
  },
  { immediate: true }
)

async function createTask() {
  const created = await agent.run(() => agent.create(objective.value))
  if (created) objective.value = ''
}

async function savePlan() {
  const steps = planText.value
    .split(/\r?\n/)
    .map((step) => step.trim())
    .filter(Boolean)
  await agent.run(() => agent.savePlan(steps))
}

async function generatePlan() {
  if (!agent.activeTask) return
  const steps = await agent.run(() =>
    generateAgentPlan(agent.activeTask!.objective, workspace.projectMap)
  )
  if (steps) planText.value = steps.join('\n')
}

async function previewChanges() {
  const files = proposedFiles
    .filter((file) => file.path.trim())
    .map((file) => ({
      path: file.path.trim(),
      action: file.action,
      content: file.action === 'write' ? file.content : undefined
    }))
  await agent.run(() => agent.previewChanges(files))
}

async function executeChanges() {
  const result = await agent.run(() => agent.executeChanges())
  if (result && typeof result === 'object' && 'success' in result) {
    executionMessage.value = result.success
      ? `Applied ${result.completed.length} file change(s).`
      : `Stopped at ${result.failed?.path}: ${result.failed?.message}`
  }
}

function addFile() {
  proposedFiles.push({ path: '', action: 'write', content: '' })
}

onMounted(() => void agent.load())
</script>

<template>
  <div class="agent-page">
    <aside class="task-list">
      <header>
        <p>CONTROLLED EXECUTION</p>
        <h1>Agent tasks</h1>
      </header>
      <form class="new-task" @submit.prevent="createTask">
        <textarea v-model="objective" rows="3" placeholder="Describe the concrete task" />
        <button class="primary" :disabled="!objective.trim() || !workspace.activeProjectId">
          Create draft
        </button>
      </form>
      <button
        v-for="task in agent.tasks"
        :key="task.id"
        class="task-row"
        :class="{ active: task.id === agent.activeTaskId }"
        @click="agent.selectTask(task.id)"
      >
        <strong>{{ task.objective }}</strong>
        <span>{{ task.status.replace('_', ' ') }}</span>
      </button>
      <p v-if="!agent.tasks.length" class="empty">No tasks for the active project.</p>
    </aside>

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

        <section class="workflow-section">
          <div class="section-title">
            <div>
              <span>1</span>
              <h3>Plan approval</h3>
            </div>
            <button
              v-if="agent.activeTask.status === 'awaiting_approval'"
              class="primary"
              @click="agent.run(agent.approvePlan)"
            >
              Approve plan
            </button>
          </div>
          <textarea
            v-model="planText"
            rows="5"
            :disabled="agent.activeTask.status !== 'draft'"
            placeholder="One implementation step per line"
          />
          <div v-if="agent.activeTask.status === 'draft'" class="actions">
            <button @click="generatePlan">Generate structured plan</button>
            <button class="primary" :disabled="!planText.trim()" @click="savePlan">
              Submit plan for approval
            </button>
          </div>
        </section>

        <section
          class="workflow-section"
          :class="{ disabled: agent.activeTask.status !== 'executing' && !agent.changeSet }"
        >
          <div class="section-title">
            <div>
              <span>2</span>
              <h3>ChangeSet</h3>
            </div>
            <button @click="addFile">Add file</button>
          </div>
          <div v-if="!agent.changeSet" class="file-editor-list">
            <div v-for="(file, index) in proposedFiles" :key="index" class="file-editor">
              <input v-model="file.path" placeholder="Relative file path" />
              <select v-model="file.action">
                <option value="write">Write</option>
                <option value="delete">Delete</option>
              </select>
              <button v-if="proposedFiles.length > 1" @click="proposedFiles.splice(index, 1)">
                Remove
              </button>
              <textarea
                v-if="file.action === 'write'"
                v-model="file.content"
                rows="6"
                placeholder="Complete replacement content"
              />
            </div>
            <button
              class="primary"
              :disabled="agent.activeTask.status !== 'executing'"
              @click="previewChanges"
            >
              Generate Diff preview
            </button>
          </div>
          <div v-else class="changeset">
            <div class="summary">
              <strong>{{ agent.changeSet.files.length }} files</strong>
              <span class="added">+{{ agent.changeSet.additions }}</span>
              <span class="deleted">-{{ agent.changeSet.deletions }}</span>
              <span>{{ agent.changeSet.approval }}</span>
            </div>
            <p v-for="risk in agent.changeSet.risks" :key="risk" class="risk">{{ risk }}</p>
            <details v-for="file in agent.changeSet.files" :key="file.path" open>
              <summary>{{ file.action.toUpperCase() }} {{ file.path }}</summary>
              <pre><code>{{ file.diff }}</code></pre>
            </details>
            <div class="actions">
              <button
                v-if="agent.changeSet.approval === 'pending'"
                class="primary"
                @click="agent.run(agent.approveChanges)"
              >
                Approve ChangeSet
              </button>
              <button
                v-if="agent.changeSet.approval === 'approved'"
                class="danger"
                @click="executeChanges"
              >
                Execute approved changes
              </button>
              <span>{{ executionMessage }}</span>
            </div>
          </div>
        </section>

        <section class="workflow-section">
          <div class="section-title">
            <div>
              <span>3</span>
              <h3>Verification</h3>
            </div>
            <button
              :disabled="agent.activeTask.status !== 'verifying'"
              @click="agent.run(agent.loadCommands)"
            >
              Discover package scripts
            </button>
          </div>
          <div v-for="command in agent.commands" :key="command.id" class="command-row">
            <div>
              <strong>npm run {{ command.scriptName }}</strong
              ><code>{{ command.command }}</code>
            </div>
            <button
              v-if="!command.approved"
              @click="agent.run(() => agent.approveCommand(command.id))"
            >
              Approve
            </button>
            <button v-else class="primary" @click="agent.run(() => agent.runCommand(command.id))">
              Run
            </button>
          </div>
          <details v-for="result in agent.results" :key="result.id">
            <summary>
              {{ result.scriptName }} / exit {{ result.exitCode }} / {{ result.durationMs }}ms
            </summary>
            <pre><code>{{ result.output || '(no output)' }}</code></pre>
          </details>
        </section>

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

<style scoped>
.agent-page {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-columns: 280px minmax(0, 1fr);
  background: #f8fafc;
}
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding: 18px 14px;
  border-right: 1px solid var(--border);
  background: #fff;
}
.task-list header p,
.task-header p {
  margin: 0;
  color: var(--text-light);
  font-size: 0.68rem;
  font-weight: 700;
}
.task-list h1,
.task-header h2 {
  margin: 3px 0 12px;
}
.new-task {
  display: grid;
  gap: 7px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.task-row {
  display: grid;
  gap: 4px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}
.task-row.active {
  border-color: #93c5fd;
  background: #eff6ff;
}
.task-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
}
.task-row span,
.empty {
  color: var(--text-light);
  font-size: 0.72rem;
}
.task-workspace {
  min-width: 0;
  overflow: auto;
  padding: 20px;
}
.empty-main {
  display: grid;
  height: 100%;
  place-items: center;
  color: var(--text-light);
}
.task-header,
.section-title,
.section-title > div,
.summary,
.actions,
.command-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.status {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.72rem;
  text-transform: uppercase;
}
.workflow-section {
  display: grid;
  gap: 12px;
  padding: 18px 0;
  border-top: 1px solid var(--border);
}
.workflow-section.disabled {
  opacity: 0.62;
}
.section-title h3 {
  margin: 0;
  font-size: 0.95rem;
}
.section-title span {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 4px;
  background: #172033;
  color: #fff;
  font-size: 0.72rem;
}
textarea,
input,
select {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 9px;
  background: #fff;
  color: var(--text);
  font: inherit;
}
button {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  color: var(--text);
  cursor: pointer;
}
button.primary {
  border-color: var(--primary);
  background: var(--primary);
  color: #fff;
}
button.danger {
  border-color: #b91c1c;
  background: #b91c1c;
  color: #fff;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.file-editor-list,
.changeset {
  display: grid;
  gap: 10px;
}
.file-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px auto;
  gap: 8px;
}
.file-editor textarea {
  grid-column: 1 / -1;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.76rem;
}
.summary {
  justify-content: flex-start;
}
.added {
  color: #15803d;
}
.deleted {
  color: #b91c1c;
}
.risk,
.error {
  padding: 8px 10px;
  border: 1px solid #fbbf24;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
  font-size: 0.76rem;
}
details {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
}
summary {
  padding: 9px 11px;
  cursor: pointer;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.76rem;
}
pre {
  max-height: 360px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  background: #111827;
  color: #e5e7eb;
  font-size: 0.74rem;
}
.command-row {
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
}
.command-row > div {
  display: grid;
  gap: 3px;
}
.command-row code {
  color: var(--text-light);
  font-size: 0.72rem;
}
.cancel-task {
  color: #b91c1c;
}
@media (max-width: 900px) {
  .agent-page {
    grid-template-columns: 1fr;
  }
  .task-list {
    max-height: 260px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
  .file-editor {
    grid-template-columns: 1fr;
  }
  .file-editor textarea {
    grid-column: auto;
  }
}
</style>
