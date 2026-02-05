<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePluginStore, PLUGIN_CATEGORIES, type Plugin, type PluginCategory } from '@/stores/plugins'
import { useConfigStore } from '@/stores'
import PluginRunner from '@/components/tools/PluginRunner.vue'

const pluginStore = usePluginStore()
const configStore = useConfigStore()

// 是否显示运行器
const showRunner = computed(() => pluginStore.activePlugin !== null)

// Tab 切换
const activeTab = ref<'installed' | 'marketplace' | 'create'>('installed')

// 插件详情弹窗
const showDetailModal = ref(false)
const selectedPlugin = ref<Plugin | null>(null)

// 创建/编辑状态
const isEditing = ref(false)
const editingPlugin = ref<Partial<Plugin>>({
  name: '',
  icon: '🔌',
  description: '',
  author: '',
  version: '1.0.0',
  category: 'other',
  systemPrompt: '',
  fields: [],
  postProcessor: { enabled: false, script: '' },
  tags: []
})

// 导入弹窗
const showImportModal = ref(false)
const importJson = ref('')
const importError = ref('')

// ===== 计算属性 =====
const categories = computed(() => [
  { id: 'all' as const, name: '全部', icon: '📦' },
  ...PLUGIN_CATEGORIES
])

// ===== 方法 =====
function selectCategory(category: PluginCategory | 'all') {
  pluginStore.activeCategory = category
}

function viewPluginDetail(plugin: Plugin) {
  selectedPlugin.value = plugin
  showDetailModal.value = true
}

function closeDetailModal() {
  showDetailModal.value = false
  selectedPlugin.value = null
}

function installPlugin(plugin: Plugin) {
  pluginStore.installPlugin(plugin)
}

function uninstallPlugin(plugin: Plugin) {
  if (confirm(`确定要卸载「${plugin.name}」吗？`)) {
    pluginStore.uninstallPlugin(plugin.id)
    closeDetailModal()
  }
}

function usePlugin(plugin: Plugin) {
  pluginStore.setActivePlugin(plugin)
  activeTab.value = 'installed'
}

// 创建插件相关
function startCreatePlugin() {
  isEditing.value = false
  editingPlugin.value = {
    name: '',
    icon: '🔌',
    description: '',
    author: '我',
    version: '1.0.0',
    category: 'other',
    systemPrompt: '',
    fields: [{ id: 'input', label: '输入', type: 'textarea', placeholder: '', required: true }],
    postProcessor: { enabled: false, script: '' },
    tags: []
  }
  activeTab.value = 'create'
}

function editPlugin(plugin: Plugin) {
  if (plugin.isBuiltIn) {
    alert('内置插件不可编辑')
    return
  }
  isEditing.value = true
  editingPlugin.value = JSON.parse(JSON.stringify(plugin))
  activeTab.value = 'create'
  closeDetailModal()
}

function addField() {
  if (!editingPlugin.value.fields) {
    editingPlugin.value.fields = []
  }
  editingPlugin.value.fields.push({
    id: `field_${Date.now()}`,
    label: '新字段',
    type: 'text',
    placeholder: '',
    required: false
  })
}

function removeField(index: number) {
  editingPlugin.value.fields?.splice(index, 1)
}

function savePlugin() {
  if (!editingPlugin.value.name || !editingPlugin.value.systemPrompt) {
    alert('请填写插件名称和系统提示词')
    return
  }
  
  if (isEditing.value && editingPlugin.value.id) {
    pluginStore.updateCustomPlugin(editingPlugin.value.id, editingPlugin.value)
  } else {
    pluginStore.addCustomPlugin(editingPlugin.value as any)
  }
  
  activeTab.value = 'installed'
}

function cancelEdit() {
  activeTab.value = 'installed'
}

// 导入导出
function openImportModal() {
  importJson.value = ''
  importError.value = ''
  showImportModal.value = true
}

function performImport() {
  const result = pluginStore.importPlugin(importJson.value)
  if (result.success) {
    showImportModal.value = false
    activeTab.value = 'installed'
  } else {
    importError.value = result.message
  }
}

function exportPlugin(plugin: Plugin) {
  const json = pluginStore.exportPlugin(plugin.id)
  if (json) {
    navigator.clipboard.writeText(json)
    alert('插件配置已复制到剪贴板')
  }
}

// 格式化下载数
function formatDownloads(num?: number): string {
  if (!num) return '0'
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return num.toString()
}
</script>

<template>
  <div class="plugin-marketplace">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="grid-pattern"></div>
    </div>

    <!-- 插件运行器（当有活动插件时显示） -->
    <div v-if="showRunner" class="runner-wrapper">
      <PluginRunner />
    </div>

    <!-- 市场界面（当没有活动插件时显示） -->
    <template v-else>
    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="logo-badge">
            <span class="logo-icon">🧩</span>
          </div>
          <div class="header-text">
            <h1>插件中心</h1>
            <p>扩展你的 AI 能力边界</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="action-btn import-btn" @click="openImportModal">
            <span>📥</span> 导入
          </button>
          <button class="action-btn create-btn" @click="startCreatePlugin">
            <span>✨</span> 创建插件
          </button>
        </div>
      </div>
    </header>

    <!-- 标签页导航 -->
    <nav class="tab-nav">
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'installed' }"
        @click="activeTab = 'installed'"
      >
        <span class="tab-icon">📦</span>
        已安装
        <span class="tab-badge">{{ pluginStore.allInstalledPlugins.length }}</span>
      </button>
      <button 
        class="tab-btn" 
        :class="{ active: activeTab === 'marketplace' }"
        @click="activeTab = 'marketplace'"
      >
        <span class="tab-icon">🏪</span>
        插件市场
      </button>
      <button 
        v-if="activeTab === 'create'"
        class="tab-btn active"
      >
        <span class="tab-icon">✏️</span>
        {{ isEditing ? '编辑插件' : '创建插件' }}
      </button>
    </nav>

    <!-- 搜索和分类 -->
    <div v-if="activeTab !== 'create'" class="filter-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input 
          v-model="pluginStore.searchQuery"
          type="text" 
          placeholder="搜索插件..."
          class="search-input"
        >
      </div>
      <div class="category-pills">
        <button 
          v-for="cat in categories" 
          :key="cat.id"
          class="category-pill"
          :class="{ active: pluginStore.activeCategory === cat.id }"
          @click="selectCategory(cat.id)"
        >
          {{ cat.icon }} {{ cat.name }}
        </button>
      </div>
    </div>

    <!-- 已安装插件列表 -->
    <main v-if="activeTab === 'installed'" class="content-area">
      <div v-if="pluginStore.filteredInstalledPlugins.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>暂无已安装插件</h3>
        <p>去插件市场探索更多工具吧</p>
        <button class="primary-btn" @click="activeTab = 'marketplace'">浏览市场</button>
      </div>
      
      <div v-else class="plugin-grid">
        <div 
          v-for="plugin in pluginStore.filteredInstalledPlugins" 
          :key="plugin.id"
          class="plugin-card"
          :class="{ 'is-active': pluginStore.activePlugin?.id === plugin.id }"
          @click="viewPluginDetail(plugin)"
        >
          <div class="card-header">
            <span class="plugin-icon">{{ plugin.icon }}</span>
            <div class="plugin-badges">
              <span v-if="plugin.isBuiltIn" class="badge built-in">内置</span>
              <span v-else-if="plugin.source === 'local'" class="badge custom">自定义</span>
            </div>
          </div>
          <h3 class="plugin-name">{{ plugin.name }}</h3>
          <p class="plugin-desc">{{ plugin.description }}</p>
          <div class="card-footer">
            <span class="plugin-author">by {{ plugin.author }}</span>
            <button class="use-btn" @click.stop="usePlugin(plugin)">使用</button>
          </div>
        </div>
      </div>
    </main>

    <!-- 插件市场 -->
    <main v-if="activeTab === 'marketplace'" class="content-area">
      <!-- 热门推荐 -->
      <section v-if="!pluginStore.searchQuery && pluginStore.activeCategory === 'all'" class="featured-section">
        <h2 class="section-title">🔥 热门插件</h2>
        <div class="featured-grid">
          <div 
            v-for="plugin in pluginStore.popularPlugins" 
            :key="plugin.id"
            class="featured-card"
            @click="viewPluginDetail(plugin)"
          >
            <span class="plugin-icon large">{{ plugin.icon }}</span>
            <div class="featured-info">
              <h4>{{ plugin.name }}</h4>
              <p>{{ plugin.description }}</p>
              <div class="featured-meta">
                <span class="downloads">📥 {{ formatDownloads(plugin.downloads) }}</span>
                <span class="rating">⭐ {{ plugin.rating?.toFixed(1) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 全部插件 -->
      <section class="all-plugins-section">
        <h2 v-if="!pluginStore.searchQuery && pluginStore.activeCategory === 'all'" class="section-title">
          📦 全部插件
        </h2>
        
        <div v-if="pluginStore.filteredMarketplacePlugins.length === 0" class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>没有找到匹配的插件</h3>
          <p>试试其他关键词或分类</p>
        </div>
        
        <div v-else class="plugin-grid">
          <div 
            v-for="plugin in pluginStore.filteredMarketplacePlugins" 
            :key="plugin.id"
            class="plugin-card marketplace-card"
            @click="viewPluginDetail(plugin)"
          >
            <div class="card-header">
              <span class="plugin-icon">{{ plugin.icon }}</span>
              <div class="plugin-stats">
                <span class="stat">📥 {{ formatDownloads(plugin.downloads) }}</span>
                <span class="stat">⭐ {{ plugin.rating?.toFixed(1) }}</span>
              </div>
            </div>
            <h3 class="plugin-name">{{ plugin.name }}</h3>
            <p class="plugin-desc">{{ plugin.description }}</p>
            <div class="card-footer">
              <span class="plugin-author">by {{ plugin.author }}</span>
              <button class="install-btn" @click.stop="installPlugin(plugin)">安装</button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- 创建/编辑插件 -->
    <main v-if="activeTab === 'create'" class="content-area create-area">
      <div class="create-form">
        <div class="form-section">
          <h3>基本信息</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>插件图标</label>
              <input v-model="editingPlugin.icon" type="text" class="icon-input" maxlength="2">
            </div>
            <div class="form-group flex-2">
              <label>插件名称 *</label>
              <input v-model="editingPlugin.name" type="text" placeholder="例如：周报生成器">
            </div>
            <div class="form-group flex-1">
              <label>版本</label>
              <input v-model="editingPlugin.version" type="text" placeholder="1.0.0">
            </div>
            <div class="form-group flex-1">
              <label>分类</label>
              <select v-model="editingPlugin.category">
                <option v-for="cat in PLUGIN_CATEGORIES" :key="cat.id" :value="cat.id">
                  {{ cat.icon }} {{ cat.name }}
                </option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>插件描述</label>
            <textarea v-model="editingPlugin.description" rows="2" placeholder="简要描述插件功能..."></textarea>
          </div>
        </div>

        <div class="form-section">
          <h3>系统提示词 (System Prompt) *</h3>
          <p class="hint">定义 AI 的角色和行为规则</p>
          <textarea 
            v-model="editingPlugin.systemPrompt" 
            rows="6" 
            placeholder="你是一位专业的...&#10;&#10;请按照以下格式输出：&#10;1. ..."
            class="code-textarea"
          ></textarea>
        </div>

        <div class="form-section">
          <div class="section-header">
            <h3>输入字段</h3>
            <button class="add-field-btn" @click="addField">+ 添加字段</button>
          </div>
          <div v-for="(field, index) in editingPlugin.fields" :key="field.id" class="field-editor">
            <div class="field-row">
              <input v-model="field.id" type="text" placeholder="字段ID" class="field-id">
              <input v-model="field.label" type="text" placeholder="显示标签">
              <select v-model="field.type">
                <option value="text">单行文本</option>
                <option value="textarea">多行文本</option>
                <option value="select">下拉选择</option>
                <option value="number">数字</option>
                <option value="toggle">开关</option>
              </select>
              <label class="checkbox-label">
                <input type="checkbox" v-model="field.required"> 必填
              </label>
              <button class="remove-field-btn" @click="removeField(index)">🗑️</button>
            </div>
            <input v-model="field.placeholder" type="text" placeholder="占位提示文字" class="field-placeholder">
            
            <!-- Select 选项编辑 -->
            <div v-if="field.type === 'select'" class="options-editor">
              <span class="options-hint">选项格式：label:value，每行一个</span>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-header">
            <h3>后处理器 (可选)</h3>
            <label class="checkbox-label">
              <input type="checkbox" v-model="editingPlugin.postProcessor!.enabled"> 启用
            </label>
          </div>
          <p class="hint">使用 JavaScript 处理 AI 输出。可用变量：result (AI输出), inputs (用户输入)</p>
          <textarea 
            v-if="editingPlugin.postProcessor?.enabled"
            v-model="editingPlugin.postProcessor!.script" 
            rows="4" 
            placeholder="// 示例：为输出添加前缀&#10;return '## 处理结果\n' + result;"
            class="code-textarea"
          ></textarea>
        </div>

        <div class="form-actions">
          <button class="cancel-btn" @click="cancelEdit">取消</button>
          <button class="save-btn" @click="savePlugin">
            {{ isEditing ? '保存修改' : '创建插件' }}
          </button>
        </div>
      </div>
    </main>

    <!-- 插件详情弹窗 -->
    <Teleport to="body">
      <div v-if="showDetailModal" class="modal-overlay" @click.self="closeDetailModal">
        <div class="detail-modal">
          <button class="close-btn" @click="closeDetailModal">×</button>
          
          <div v-if="selectedPlugin" class="modal-content">
            <div class="modal-header">
              <span class="plugin-icon xlarge">{{ selectedPlugin.icon }}</span>
              <div class="modal-title">
                <h2>{{ selectedPlugin.name }}</h2>
                <p class="plugin-meta">
                  v{{ selectedPlugin.version }} · by {{ selectedPlugin.author }}
                  <span v-if="selectedPlugin.isBuiltIn" class="badge built-in">内置</span>
                </p>
              </div>
            </div>
            
            <p class="modal-desc">{{ selectedPlugin.description }}</p>
            
            <div class="modal-tags">
              <span v-for="tag in selectedPlugin.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
            
            <div class="modal-stats" v-if="selectedPlugin.downloads || selectedPlugin.rating">
              <div class="stat-item">
                <span class="stat-value">{{ formatDownloads(selectedPlugin.downloads) }}</span>
                <span class="stat-label">下载量</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ selectedPlugin.rating?.toFixed(1) || '-' }}</span>
                <span class="stat-label">评分</span>
              </div>
            </div>
            
            <div class="modal-fields">
              <h4>输入字段</h4>
              <ul>
                <li v-for="field in selectedPlugin.fields" :key="field.id">
                  <strong>{{ field.label }}</strong>
                  <span class="field-type">{{ field.type }}</span>
                  <span v-if="field.required" class="required-badge">必填</span>
                </li>
              </ul>
            </div>
            
            <div class="modal-actions">
              <template v-if="pluginStore.isInstalled(selectedPlugin.id)">
                <button class="primary-btn" @click="usePlugin(selectedPlugin)">
                  🚀 使用插件
                </button>
                <button 
                  v-if="!selectedPlugin.isBuiltIn" 
                  class="secondary-btn"
                  @click="editPlugin(selectedPlugin)"
                >
                  ✏️ 编辑
                </button>
                <button 
                  v-if="!selectedPlugin.isBuiltIn" 
                  class="secondary-btn"
                  @click="exportPlugin(selectedPlugin)"
                >
                  📤 导出
                </button>
                <button 
                  v-if="!selectedPlugin.isBuiltIn" 
                  class="danger-btn"
                  @click="uninstallPlugin(selectedPlugin)"
                >
                  🗑️ 卸载
                </button>
              </template>
              <template v-else>
                <button class="primary-btn install" @click="installPlugin(selectedPlugin)">
                  📥 安装插件
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 导入弹窗 -->
    <Teleport to="body">
      <div v-if="showImportModal" class="modal-overlay" @click.self="showImportModal = false">
        <div class="import-modal">
          <h3>📥 导入插件</h3>
          <p>粘贴插件的 JSON 配置</p>
          <textarea 
            v-model="importJson" 
            rows="10" 
            placeholder='{"name": "我的插件", ...}'
            class="code-textarea"
          ></textarea>
          <p v-if="importError" class="error-msg">{{ importError }}</p>
          <div class="modal-actions">
            <button class="cancel-btn" @click="showImportModal = false">取消</button>
            <button class="primary-btn" @click="performImport">导入</button>
          </div>
        </div>
      </div>
    </Teleport>
    </template>
  </div>
</template>

<style scoped>
.plugin-marketplace {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
}

.runner-wrapper {
  position: relative;
  z-index: 10;
  flex: 1;
  padding: 20px;
  overflow: hidden;
}

/* ===== 背景装饰 ===== */
.bg-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  animation: float 20s ease-in-out infinite;
}

.orb-1 {
  width: 350px;
  height: 350px;
  background: linear-gradient(135deg, #06b6d4, #0ea5e9);
  top: -80px;
  right: -80px;
}

.orb-2 {
  width: 280px;
  height: 280px;
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  bottom: -60px;
  left: -60px;
  animation-delay: -10s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(25px, -25px) scale(1.03); }
  66% { transform: translate(-15px, 15px) scale(0.97); }
}

.grid-pattern {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(99, 102, 241, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
  background-size: 32px 32px;
}

/* ===== 页面头部 ===== */
.page-header {
  position: relative;
  z-index: 10;
  padding: 20px 28px 16px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo-badge {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #06b6d4, #0ea5e9);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(6, 182, 212, 0.3);
}

.logo-icon {
  font-size: 1.6rem;
}

.header-text h1 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text);
}

.header-text p {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--text-light);
}

.header-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.import-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
}

.import-btn:hover {
  border-color: var(--primary);
}

.create-btn {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

/* ===== Tab 导航 ===== */
.tab-nav {
  position: relative;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 0 28px;
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-light);
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tab-icon {
  font-size: 1.1rem;
}

.tab-badge {
  background: var(--primary);
  color: white;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 10px;
}

/* ===== 搜索和分类 ===== */
.filter-bar {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 28px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  max-width: 400px;
}

.search-icon {
  font-size: 1rem;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 0.95rem;
  color: var(--text);
  outline: none;
}

.category-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-pill {
  padding: 6px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.category-pill:hover {
  border-color: var(--primary);
}

.category-pill.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

/* ===== 内容区域 ===== */
.content-area {
  flex: 1;
  position: relative;
  z-index: 10;
  padding: 16px 28px 28px;
  overflow-y: auto;
}

/* ===== 空状态 ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: var(--text);
}

.empty-state p {
  margin: 0 0 20px;
  color: var(--text-light);
}

.primary-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
}

/* ===== 插件网格 ===== */
.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.plugin-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.plugin-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.1);
  border-color: var(--primary);
}

.plugin-card.is-active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.plugin-icon {
  font-size: 2rem;
}

.plugin-icon.large {
  font-size: 2.5rem;
}

.plugin-icon.xlarge {
  font-size: 3.5rem;
}

.plugin-badges, .plugin-stats {
  display: flex;
  gap: 6px;
}

.badge {
  font-size: 0.7rem;
  padding: 3px 8px;
  border-radius: 8px;
  font-weight: 500;
}

.badge.built-in {
  background: linear-gradient(135deg, #06b6d4, #0ea5e9);
  color: white;
}

.badge.custom {
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
  color: white;
}

.stat {
  font-size: 0.75rem;
  color: var(--text-light);
}

.plugin-name {
  margin: 0 0 8px;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
}

.plugin-desc {
  margin: 0 0 16px;
  font-size: 0.85rem;
  color: var(--text-light);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.plugin-author {
  font-size: 0.8rem;
  color: var(--text-light);
}

.use-btn, .install-btn {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.use-btn {
  background: var(--primary);
  border: none;
  color: white;
}

.use-btn:hover {
  background: var(--primary-dark);
}

.install-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  color: white;
}

.install-btn:hover {
  transform: scale(1.05);
}

/* ===== 热门区域 ===== */
.featured-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text);
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.featured-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.featured-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.featured-info {
  flex: 1;
  min-width: 0;
}

.featured-info h4 {
  margin: 0 0 4px;
  font-size: 0.95rem;
  font-weight: 600;
}

.featured-info p {
  margin: 0 0 8px;
  font-size: 0.8rem;
  color: var(--text-light);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.featured-meta {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  color: var(--text-light);
}

/* ===== 创建区域 ===== */
.create-area {
  padding: 20px 28px;
}

.create-form {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.form-section h3 {
  margin: 0 0 12px;
  font-size: 1rem;
  font-weight: 600;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
}

.hint {
  font-size: 0.85rem;
  color: var(--text-light);
  margin: 0 0 12px;
}

.form-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.flex-1 { flex: 1; min-width: 120px; }
.form-group.flex-2 { flex: 2; min-width: 200px; }

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  background: var(--secondary);
  color: var(--text);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.icon-input {
  width: 60px;
  text-align: center;
  font-size: 1.5rem !important;
}

.code-textarea {
  font-family: 'Fira Code', 'SF Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
}

/* 字段编辑器 */
.field-editor {
  background: var(--secondary);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 10px;
}

.field-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.field-row input,
.field-row select {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  background: var(--surface);
}

.field-id {
  width: 100px;
}

.field-placeholder {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  background: var(--surface);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  white-space: nowrap;
}

.add-field-btn {
  padding: 6px 12px;
  background: var(--primary);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
}

.remove-field-btn {
  padding: 6px 10px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.remove-field-btn:hover {
  background: #fee2e2;
  border-color: #ef4444;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn {
  padding: 12px 24px;
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  cursor: pointer;
}

.save-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-weight: 500;
  cursor: pointer;
}

/* ===== 弹窗 ===== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.detail-modal, .import-modal {
  background: var(--surface);
  border-radius: var(--radius-lg);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: var(--secondary);
  border: none;
  border-radius: 50%;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--border);
}

.modal-content {
  padding: 24px;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.modal-title h2 {
  margin: 0;
  font-size: 1.3rem;
}

.plugin-meta {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--text-light);
}

.modal-desc {
  margin: 0 0 16px;
  color: var(--text);
  line-height: 1.6;
}

.modal-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.tag {
  padding: 4px 12px;
  background: var(--secondary);
  border-radius: 12px;
  font-size: 0.8rem;
  color: var(--text-light);
}

.modal-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--secondary);
  border-radius: var(--radius-md);
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-light);
}

.modal-fields {
  margin-bottom: 20px;
}

.modal-fields h4 {
  margin: 0 0 10px;
  font-size: 0.95rem;
}

.modal-fields ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.modal-fields li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.field-type {
  font-size: 0.75rem;
  padding: 2px 8px;
  background: var(--secondary);
  border-radius: 8px;
  color: var(--text-light);
}

.required-badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  background: #fef3c7;
  color: #92400e;
  border-radius: 6px;
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.secondary-btn {
  padding: 10px 16px;
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.secondary-btn:hover {
  border-color: var(--primary);
}

.danger-btn {
  padding: 10px 16px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: var(--radius-md);
  color: #dc2626;
  font-size: 0.9rem;
  cursor: pointer;
}

.danger-btn:hover {
  background: #fecaca;
}

.primary-btn.install {
  flex: 1;
  background: linear-gradient(135deg, #10b981, #059669);
}

/* 导入弹窗 */
.import-modal {
  padding: 24px;
}

.import-modal h3 {
  margin: 0 0 8px;
}

.import-modal > p {
  margin: 0 0 16px;
  color: var(--text-light);
}

.error-msg {
  color: #dc2626;
  font-size: 0.85rem;
  margin: 8px 0;
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .plugin-grid {
    grid-template-columns: 1fr;
  }
  
  .featured-grid {
    grid-template-columns: 1fr;
  }
  
  .category-pills {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 8px;
  }
}
</style>
