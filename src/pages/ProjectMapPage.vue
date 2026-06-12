<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'

const workspace = useWorkspaceStore()
const map = computed(() => workspace.projectMap)

onMounted(() => void workspace.loadProjectMap())
</script>

<template>
  <div class="map-page">
    <header>
      <div>
        <p>PROJECT MODEL</p>
        <h1>{{ map?.project.name || 'Project map' }}</h1>
      </div>
      <button :disabled="!workspace.activeProjectId" @click="workspace.loadProjectMap">
        Refresh
      </button>
    </header>

    <div v-if="!map" class="empty">
      Index the active project to generate symbols, imports, tests, and risk hotspots.
    </div>

    <template v-else>
      <section class="summary-band">
        <div>
          <span>Branch</span><strong>{{ map.project.branch || 'not detected' }}</strong>
        </div>
        <div>
          <span>Symbols</span><strong>{{ map.symbols.length }}</strong>
        </div>
        <div>
          <span>Relations</span><strong>{{ map.relations.length }}</strong>
        </div>
        <div>
          <span>Tests</span><strong>{{ map.testFiles.length }}</strong>
        </div>
      </section>

      <div class="map-grid">
        <section>
          <h2>Entry files</h2>
          <code v-for="path in map.entryFiles" :key="path">{{ path }}</code>
          <p v-if="!map.entryFiles.length">No conventional entry file detected.</p>
        </section>

        <section>
          <h2>Language distribution</h2>
          <div v-for="(count, language) in map.project.languageStats" :key="language" class="row">
            <span>{{ language }}</span
            ><strong>{{ count }}</strong>
          </div>
        </section>

        <section class="wide">
          <h2>Key symbols</h2>
          <div class="table">
            <div v-for="symbol in map.symbols.slice(0, 80)" :key="symbol.id" class="symbol-row">
              <strong>{{ symbol.name }}</strong>
              <span>{{ symbol.kind }}</span>
              <code>{{ symbol.path }}:{{ symbol.lineStart }}</code>
              <span>{{ symbol.exported ? 'exported' : 'local' }}</span>
            </div>
          </div>
        </section>

        <section>
          <h2>Hotspots</h2>
          <div v-for="hotspot in map.hotspots" :key="hotspot.path" class="finding">
            <code>{{ hotspot.path }}</code>
            <p>{{ hotspot.reason }}</p>
          </div>
          <p v-if="!map.hotspots.length">No high-coupling hotspot detected.</p>
        </section>

        <section>
          <h2>Large files</h2>
          <div v-for="file in map.largeFiles" :key="file.path" class="row">
            <code>{{ file.path }}</code
            ><strong>{{ Math.round(file.bytes / 1024) }} KB</strong>
          </div>
          <p v-if="!map.largeFiles.length">No indexed file exceeds 200 KB.</p>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.map-page {
  height: 100%;
  overflow: auto;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #f8fafc;
}

header,
.summary-band,
.row,
.symbol-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

header p,
header h1,
section h2,
section p {
  margin: 0;
}

header p,
.summary-band span {
  color: var(--text-light);
  font-size: 0.72rem;
}

button {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #ffffff;
}

.summary-band {
  margin: 18px 0 14px;
  padding: 14px 0;
  border-block: 1px solid var(--border);
}

.summary-band div {
  display: grid;
  gap: 3px;
}

.map-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

section,
.empty {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #ffffff;
}

section {
  display: grid;
  align-content: start;
  gap: 10px;
}

.wide {
  grid-column: 1 / -1;
}

code {
  overflow-wrap: anywhere;
  color: #1d4ed8;
  font-size: 0.76rem;
}

.table {
  display: grid;
}

.symbol-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 90px minmax(180px, 2fr) 80px;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.78rem;
}

.finding {
  padding-block: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.finding p,
section > p {
  margin-top: 4px;
  color: var(--text-light);
  font-size: 0.78rem;
}

@media (max-width: 900px) {
  .map-grid {
    grid-template-columns: 1fr;
  }

  .wide {
    grid-column: auto;
  }

  .symbol-row {
    grid-template-columns: 1fr;
  }
}
</style>
