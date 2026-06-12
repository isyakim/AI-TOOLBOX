<script setup lang="ts">
defineProps<{ entries: string[] }>()
</script>

<template>
  <section class="panel">
    <h2>Activity log</h2>
    <div class="log">
      <p v-if="!entries.length">No activity yet.</p>
      <div v-for="(entry, index) in entries" :key="`${index}-${entry}`">{{ entry }}</div>
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

h2 {
  margin: 0;
}

.log {
  height: 140px;
  margin-top: 12px;
  overflow: auto;
  padding: 10px;
  border-radius: 6px;
  background: #111827;
  color: #d1d5db;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.72rem;
}

.log div + div {
  margin-top: 4px;
}

.log p {
  color: #94a3b8;
}
</style>
