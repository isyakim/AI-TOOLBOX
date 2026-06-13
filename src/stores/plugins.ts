import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type PluginFieldType = 'text' | 'textarea' | 'select' | 'number' | 'toggle' | 'file'
export type PluginPermission = 'ai:chat' | 'file:read' | 'file:write' | 'rag:query' | 'chat:context'
export type PluginCategory = 'coding' | 'analysis' | 'writing' | 'utility' | 'other'

export interface PluginField {
  id: string
  label: string
  type: PluginFieldType
  placeholder?: string
  defaultValue?: string | number | boolean
  options?: Array<{ label: string; value: string }>
  required?: boolean
  rows?: number
}

export interface Plugin {
  schemaVersion: 2
  id: string
  name: string
  icon: string
  description: string
  author: string
  version: string
  category: PluginCategory
  systemPrompt: string
  fields: PluginField[]
  permissions: PluginPermission[]
  compatibleAppVersion: string
  permissionReasons: Partial<Record<PluginPermission, string>>
  outputType: 'markdown' | 'json' | 'changeset'
  tags: string[]
  createdAt: string
  updatedAt: string
  isBuiltIn?: boolean
  isInstalled?: boolean
  source?: 'builtin' | 'file'
  filePath?: string
}

export const PLUGIN_CATEGORIES: Array<{ id: PluginCategory; name: string; icon: string }> = [
  { id: 'coding', name: 'Coding', icon: 'CODE' },
  { id: 'analysis', name: 'Analysis', icon: 'AN' },
  { id: 'writing', name: 'Writing', icon: 'DOC' },
  { id: 'utility', name: 'Utility', icon: 'UTIL' },
  { id: 'other', name: 'Other', icon: 'EXT' }
]

function normalizePlugin(
  plugin: Partial<Plugin> & Pick<Plugin, 'id' | 'name' | 'version' | 'systemPrompt' | 'fields'>
): Plugin {
  const permissions: PluginPermission[] = Array.isArray(plugin.permissions)
    ? plugin.permissions.filter((permission): permission is PluginPermission =>
        ['ai:chat', 'file:read', 'file:write', 'rag:query', 'chat:context'].includes(permission)
      )
    : ['ai:chat']
  const categories: PluginCategory[] = ['coding', 'analysis', 'writing', 'utility', 'other']
  const normalized: Plugin = {
    icon: 'EXT',
    description: '',
    author: 'Unknown',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isInstalled: true,
    ...plugin,
    category: categories.includes(plugin.category || 'other')
      ? plugin.category || 'other'
      : 'other',
    permissions,
    compatibleAppVersion: plugin.compatibleAppVersion || '>=2.0.0',
    permissionReasons: plugin.permissionReasons || {
      'ai:chat': 'Required to generate the workflow result.'
    },
    outputType: plugin.outputType || 'markdown',
    schemaVersion: 2 as const
  }
  return normalized
}

function parsePlugin(json: string): Plugin {
  const value = JSON.parse(json) as Partial<Plugin>
  if (
    !value.id ||
    !value.name ||
    !value.version ||
    !value.systemPrompt ||
    !Array.isArray(value.fields)
  ) {
    throw new Error('Plugin requires id, name, version, systemPrompt, and fields.')
  }
  return normalizePlugin(value as Plugin)
}

export const usePluginStore = defineStore('plugins', () => {
  const installedPlugins = ref<Plugin[]>([])
  const activePlugin = ref<Plugin | null>(null)
  const searchQuery = ref('')
  const activeCategory = ref<PluginCategory | 'all'>('all')
  const customPlugins = computed(() => installedPlugins.value.filter((plugin) => !plugin.isBuiltIn))
  const allInstalledPlugins = computed(() => installedPlugins.value)
  const filteredInstalledPlugins = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return installedPlugins.value.filter((plugin) => {
      const categoryMatches =
        activeCategory.value === 'all' || plugin.category === activeCategory.value
      return (
        categoryMatches &&
        (!query ||
          `${plugin.name} ${plugin.description} ${plugin.tags.join(' ')}`
            .toLowerCase()
            .includes(query))
      )
    })
  })

  function isInstalled(pluginId: string): boolean {
    return installedPlugins.value.some((plugin) => plugin.id === pluginId)
  }
  function setActivePlugin(plugin: Plugin | null): void {
    activePlugin.value = plugin
  }
  function getPlugin(pluginId: string): Plugin | undefined {
    return installedPlugins.value.find((plugin) => plugin.id === pluginId)
  }
  function exportPlugin(pluginId: string): string | null {
    const plugin = getPlugin(pluginId)
    if (!plugin) return null
    const { filePath, isBuiltIn, isInstalled: _installed, source, ...document } = plugin
    void filePath
    void isBuiltIn
    void source
    return JSON.stringify(document, null, 2)
  }
  async function savePlugin(plugin: Plugin): Promise<void> {
    const result = await window.api.savePluginFile(plugin)
    if (!result.success) throw new Error(result.message || 'Unable to save plugin.')
  }
  function addCustomPlugin(plugin: Omit<Plugin, 'id' | 'createdAt' | 'updatedAt'>): Plugin {
    const created = normalizePlugin({
      ...plugin,
      id: `custom-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isBuiltIn: false,
      source: 'file'
    })
    installedPlugins.value.push(created)
    void savePlugin(created)
    return created
  }
  function updateCustomPlugin(pluginId: string, updates: Partial<Plugin>): void {
    const index = installedPlugins.value.findIndex(
      (plugin) => plugin.id === pluginId && !plugin.isBuiltIn
    )
    if (index < 0) return
    installedPlugins.value[index] = normalizePlugin({
      ...installedPlugins.value[index],
      ...updates,
      updatedAt: new Date().toISOString()
    })
    void savePlugin(installedPlugins.value[index])
  }
  function uninstallPlugin(pluginId: string): void {
    installedPlugins.value = installedPlugins.value.filter(
      (plugin) => plugin.id !== pluginId || plugin.isBuiltIn
    )
    void window.api.deletePluginFile(pluginId)
  }
  function importPlugin(json: string) {
    try {
      const plugin = parsePlugin(json)
      if (installedPlugins.value.some((item) => item.isBuiltIn && item.id === plugin.id)) {
        plugin.id = `custom-${crypto.randomUUID()}`
      }
      plugin.isBuiltIn = false
      plugin.source = 'file'
      installedPlugins.value = [
        ...installedPlugins.value.filter((item) => item.id !== plugin.id),
        plugin
      ]
      void savePlugin(plugin)
      const warnings = inspectPluginPrompt(plugin.systemPrompt)
      return {
        success: true,
        message: warnings.length
          ? `Plugin imported with warnings: ${warnings.join(' ')}`
          : 'Plugin imported and migrated to schema v2.',
        plugin
      }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Invalid plugin JSON.'
      }
    }
  }
  async function syncFromDisk(): Promise<void> {
    const result = await window.api.listPlugins()
    if (result.success)
      installedPlugins.value = result.plugins.map((plugin) => normalizePlugin(plugin as Plugin))
  }

  return {
    installedPlugins,
    customPlugins,
    activePlugin,
    searchQuery,
    activeCategory,
    allInstalledPlugins,
    filteredInstalledPlugins,
    marketplacePlugins: ref<Plugin[]>([]),
    filteredMarketplacePlugins: ref<Plugin[]>([]),
    popularPlugins: ref<Plugin[]>([]),
    isInstalled,
    setActivePlugin,
    getPlugin,
    exportPlugin,
    addCustomPlugin,
    updateCustomPlugin,
    uninstallPlugin,
    importPlugin,
    syncFromDisk,
    saveToStorage: syncFromDisk,
    installPlugin: () => undefined,
    loadFromStorage: syncFromDisk
  }
})

function inspectPluginPrompt(prompt: string): string[] {
  const warnings: string[] = []
  if (/ignore (all|previous) instructions/i.test(prompt))
    warnings.push('Prompt attempts to override previous instructions.')
  if (/(api[-_ ]?key|password|credential|secret).*(print|reveal|return|send)/i.test(prompt))
    warnings.push('Prompt may request sensitive credentials.')
  if (/(delete|remove).*(directory|folder|repository)/i.test(prompt))
    warnings.push('Prompt requests destructive directory operations.')
  return warnings
}
