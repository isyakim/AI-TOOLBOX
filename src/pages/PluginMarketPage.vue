<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PluginRunner from '@/components/tools/PluginRunner.vue'
import {
  PLUGIN_CATEGORIES,
  usePluginStore,
  type Plugin,
  type PluginCategory
} from '@/stores/plugins'

const pluginStore = usePluginStore()
const importJson = ref('')
const statusMessage = ref('')
const showImport = ref(false)
const showRunner = computed(() => pluginStore.activePlugin !== null)
const categories = [{ id: 'all' as const, name: 'All' }, ...PLUGIN_CATEGORIES]

function selectCategory(category: PluginCategory | 'all') {
  pluginStore.activeCategory = category
}

function runPlugin(plugin: Plugin) {
  pluginStore.setActivePlugin(plugin)
}

function importFromJson() {
  const result = pluginStore.importPlugin(importJson.value)
  statusMessage.value = result.message
  if (result.success) {
    importJson.value = ''
    showImport.value = false
  }
}

async function importFromFile() {
  const result = await window.api.importPluginFile()
  if (!result.success || !result.plugin) {
    statusMessage.value = result.message || 'Import cancelled.'
    return
  }
  const imported = pluginStore.importPlugin(JSON.stringify(result.plugin))
  statusMessage.value = imported.message
}

async function exportPlugin(plugin: Plugin) {
  const json = pluginStore.exportPlugin(plugin.id)
  if (!json) return
  const result = await window.api.exportPluginFile(JSON.parse(json))
  statusMessage.value = result.success
    ? `Exported to ${result.path}`
    : result.message || 'Export cancelled.'
}

onMounted(() => {
  void pluginStore.syncFromDisk()
})
</script>

<template>
  <div class="plugins-page">
    <PluginRunner v-if="showRunner" />

    <template v-else>
      <header class="page-header">
        <div>
          <p class="eyebrow">DECLARATIVE WORKFLOWS</p>
          <h1>Developer Plugins</h1>
          <p>
            Versioned prompt workflows with explicit permissions. Plugin JavaScript execution is
            disabled.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn" @click="importFromFile">Import file</button>
          <button class="btn primary" @click="showImport = !showImport">Import JSON</button>
        </div>
      </header>

      <section v-if="showImport" class="import-panel">
        <textarea
          v-model="importJson"
          rows="10"
          placeholder="Paste a plugin JSON document"
        ></textarea>
        <div class="import-actions">
          <button class="btn" @click="showImport = false">Cancel</button>
          <button class="btn primary" :disabled="!importJson.trim()" @click="importFromJson">
            Validate and import
          </button>
        </div>
      </section>

      <div class="toolbar">
        <input v-model="pluginStore.searchQuery" type="search" placeholder="Search plugins" />
        <div class="categories">
          <button
            v-for="category in categories"
            :key="category.id"
            :class="{ active: pluginStore.activeCategory === category.id }"
            @click="selectCategory(category.id)"
          >
            {{ category.name }}
          </button>
        </div>
      </div>

      <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>

      <div v-if="pluginStore.filteredInstalledPlugins.length" class="plugin-grid">
        <article
          v-for="plugin in pluginStore.filteredInstalledPlugins"
          :key="plugin.id"
          class="plugin-card"
        >
          <div class="plugin-heading">
            <span class="plugin-icon">{{ plugin.icon }}</span>
            <div>
              <h2>{{ plugin.name }}</h2>
              <span>{{ plugin.version }} · {{ plugin.author }}</span>
            </div>
          </div>
          <p>{{ plugin.description }}</p>
          <div class="permissions">
            <span v-for="permission in plugin.permissions" :key="permission">{{ permission }}</span>
          </div>
          <div class="card-actions">
            <button class="btn primary" @click="runPlugin(plugin)">Run</button>
            <button class="btn" @click="exportPlugin(plugin)">Export</button>
            <button
              v-if="!plugin.isBuiltIn"
              class="btn danger"
              @click="pluginStore.uninstallPlugin(plugin.id)"
            >
              Remove
            </button>
          </div>
        </article>
      </div>
      <div v-else class="empty-state">No plugins match this filter.</div>
    </template>
  </div>
</template>

<style scoped>
.plugins-page {
  height: 100%;
  overflow: auto;
  color: var(--text);
}
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}
.page-header h1 {
  margin: 4px 0 6px;
  font-size: 1.5rem;
}
.page-header p {
  margin: 0;
  max-width: 680px;
  color: var(--text-light);
}
.eyebrow {
  font-family: Consolas, monospace;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--primary) !important;
}
.header-actions,
.card-actions,
.import-actions,
.categories {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
}
.toolbar input,
.import-panel textarea {
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  color: var(--text);
}
.toolbar input {
  width: min(360px, 100%);
  height: 36px;
  padding: 0 10px;
}
.categories button {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}
.categories button.active {
  border-color: var(--primary);
  color: var(--primary);
  background: #eff6ff;
}
.import-panel {
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}
.import-panel textarea {
  width: 100%;
  padding: 10px;
  resize: vertical;
  font-family: Consolas, monospace;
}
.import-actions {
  justify-content: flex-end;
  margin-top: 8px;
}
.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.plugin-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}
.plugin-card > p {
  flex: 1;
  margin: 0;
  color: var(--text-light);
  line-height: 1.5;
}
.plugin-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.plugin-heading h2 {
  margin: 0 0 2px;
  font-size: 1rem;
}
.plugin-heading span {
  color: var(--text-light);
  font-size: 0.75rem;
}
.plugin-icon {
  display: grid;
  width: 42px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: Consolas, monospace;
  color: var(--primary) !important;
}
.permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.permissions span {
  padding: 3px 6px;
  border-radius: 4px;
  background: #f1f5f9;
  color: #475569;
  font-family: Consolas, monospace;
  font-size: 0.68rem;
}
.btn {
  height: 34px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  color: var(--text);
  cursor: pointer;
}
.btn.primary {
  border-color: var(--primary);
  background: var(--primary);
  color: #fff;
}
.btn.danger {
  color: var(--error);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.status-message {
  padding: 9px 10px;
  background: #f8fafc;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-light);
}
.empty-state {
  padding: 48px;
  text-align: center;
  color: var(--text-light);
}
@media (max-width: 760px) {
  .page-header,
  .toolbar {
    flex-direction: column;
  }
  .header-actions {
    width: 100%;
  }
}
</style>
