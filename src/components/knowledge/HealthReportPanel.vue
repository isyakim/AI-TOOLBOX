<script setup lang="ts">
import type { ProjectHealthReport } from '@/shared/types/ipc'

defineProps<{ report: ProjectHealthReport | null }>()
</script>

<template>
  <section class="panel">
    <h2>Project health</h2>
    <p v-if="!report" class="empty">
      Run a health check to inspect README quality, dependencies, tests, and structure.
    </p>
    <div v-else class="findings">
      <article v-for="finding in report.findings" :key="finding.title">
        <div>
          <strong>{{ finding.title }}</strong>
          <p>{{ finding.detail }}</p>
        </div>
        <span :class="finding.status">{{ finding.status }}</span>
      </article>
    </div>
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

.empty {
  padding: 42px 8px;
  color: var(--text-light);
  text-align: center;
}

.findings {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

article {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

article p {
  margin-top: 3px;
  color: var(--text-light);
  font-size: 0.76rem;
}

article > span {
  flex: 0 0 auto;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
}

.good {
  color: #15803d;
}
.watch {
  color: #a16207;
}
.needs-work {
  color: #b91c1c;
}
</style>
