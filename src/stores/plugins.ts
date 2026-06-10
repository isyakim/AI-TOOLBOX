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

const now = '2026-05-15T00:00:00.000Z'
const textarea = (id: string, label: string, rows = 10): PluginField => ({
  id,
  label,
  type: 'textarea',
  rows,
  required: true
})

function developerPlugin(
  config: Pick<Plugin, 'id' | 'name' | 'description' | 'systemPrompt' | 'fields' | 'tags'> &
    Partial<Pick<Plugin, 'category' | 'permissions'>>
): Plugin {
  return {
    ...config,
    icon: 'DEV',
    author: 'AI Toolbox',
    version: '1.0.0',
    category: config.category ?? 'coding',
    permissions: config.permissions ?? ['ai:chat', 'chat:context'],
    createdAt: now,
    updatedAt: now,
    isBuiltIn: true,
    isInstalled: true,
    source: 'builtin'
  }
}

export const BUILTIN_PLUGINS: Plugin[] = [
  developerPlugin({
    id: 'pr-review',
    name: 'PR Review',
    description: 'Review a diff for correctness, regressions, security risks, and missing tests.',
    tags: ['git', 'review'],
    systemPrompt:
      'Act as a senior code reviewer. Return findings first, ordered by severity, with file references and concrete fixes.',
    fields: [textarea('diff', 'PR diff', 14)]
  }),
  developerPlugin({
    id: 'commit-message',
    name: 'Commit Message',
    description: 'Generate a conventional commit message from a diff.',
    tags: ['git', 'commit'],
    systemPrompt:
      'Generate one precise conventional commit subject, an optional body, and a short changelog note.',
    fields: [textarea('diff', 'Git diff')]
  }),
  developerPlugin({
    id: 'readme-generator',
    name: 'README Generator',
    description: 'Create a trustworthy developer-facing README.',
    tags: ['docs', 'readme'],
    category: 'writing',
    permissions: ['ai:chat', 'chat:context', 'file:write'],
    systemPrompt:
      'Write a concise open-source README with positioning, quickstart, features, architecture, verification, and contribution guidance.',
    fields: [textarea('project', 'Project context')]
  }),
  developerPlugin({
    id: 'api-doc',
    name: 'API Doc',
    description: 'Document API handlers, routes, errors, and examples.',
    tags: ['api', 'docs'],
    category: 'writing',
    systemPrompt:
      'Extract and document endpoints, parameters, requests, responses, errors, authentication, and uncertain assumptions.',
    fields: [textarea('code', 'API code or routes', 14)]
  }),
  developerPlugin({
    id: 'test-case-generator',
    name: 'Test Case Generator',
    description: 'Generate focused unit, integration, and edge-case tests.',
    tags: ['tests', 'quality'],
    systemPrompt:
      'Design high-signal tests covering happy paths, edge cases, failures, regressions, and appropriate mocks.',
    fields: [
      textarea('subject', 'Code or requirement', 14),
      { id: 'framework', label: 'Framework', type: 'text' }
    ]
  }),
  developerPlugin({
    id: 'bug-repro-writer',
    name: 'Bug Repro Writer',
    description: 'Turn rough bug notes into a minimal reproducible issue.',
    tags: ['bugs', 'triage'],
    category: 'writing',
    systemPrompt:
      'Produce minimal reproduction steps, expected and actual behavior, environment, diagnostics, likely causes, and missing information.',
    fields: [textarea('bug', 'Bug details')]
  }),
  developerPlugin({
    id: 'sql-explain',
    name: 'SQL Explain',
    description: 'Explain SQL behavior, risks, indexes, and optimizations.',
    tags: ['sql', 'database'],
    category: 'analysis',
    systemPrompt:
      'Explain the query, identify correctness and performance risks, recommend indexes, and provide safer alternatives.',
    fields: [
      textarea('sql', 'SQL query', 8),
      { id: 'dialect', label: 'Dialect', type: 'text', defaultValue: 'PostgreSQL' }
    ]
  }),
  developerPlugin({
    id: 'regex-lab',
    name: 'Regex Lab',
    description: 'Create and explain regex patterns with test cases.',
    tags: ['regex', 'validation'],
    category: 'utility',
    systemPrompt:
      'Return the regex, flags, explanation, language usage, positive and negative tests, and backtracking risks.',
    fields: [
      textarea('goal', 'Matching goal', 6),
      { id: 'language', label: 'Language', type: 'text', defaultValue: 'JavaScript' }
    ]
  }),
  developerPlugin({
    id: 'prompt-eval',
    name: 'Prompt Eval',
    description: 'Evaluate ambiguity, constraints, and measurable output quality.',
    tags: ['prompt', 'eval'],
    category: 'analysis',
    systemPrompt:
      'Score the prompt, identify ambiguity and failure modes, propose evaluation cases, and return an improved prompt.',
    fields: [textarea('prompt', 'Prompt', 12), textarea('task', 'Intended task', 4)]
  }),
  developerPlugin({
    id: 'release-notes',
    name: 'Release Notes',
    description: 'Generate user-facing release notes from changes.',
    tags: ['release', 'changelog'],
    category: 'writing',
    systemPrompt:
      'Group changes into Added, Changed, Fixed, Security, and Migration Notes. Separate user impact from internal work.',
    fields: [
      textarea('changes', 'Commits, PRs, or diff', 12),
      { id: 'version', label: 'Version', type: 'text' }
    ]
  })
]

function normalizePlugin(plugin: Plugin): Plugin {
  return {
    ...plugin,
    permissions: plugin.permissions?.length ? plugin.permissions : ['ai:chat', 'chat:context'],
    tags: plugin.tags ?? [],
    isBuiltIn: false,
    isInstalled: true,
    source: 'file'
  }
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
  return normalizePlugin({
    icon: 'EXT',
    description: '',
    author: 'Unknown',
    category: 'other',
    permissions: ['ai:chat'],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...value
  } as Plugin)
}

export const usePluginStore = defineStore('plugins', () => {
  const customPlugins = ref<Plugin[]>([])
  const activePlugin = ref<Plugin | null>(null)
  const searchQuery = ref('')
  const activeCategory = ref<PluginCategory | 'all'>('all')
  const installedPlugins = computed(() => BUILTIN_PLUGINS)
  const allInstalledPlugins = computed(() => [...BUILTIN_PLUGINS, ...customPlugins.value])
  const filteredInstalledPlugins = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return allInstalledPlugins.value.filter((plugin) => {
      const categoryMatches =
        activeCategory.value === 'all' || plugin.category === activeCategory.value
      const queryMatches =
        !query ||
        `${plugin.name} ${plugin.description} ${plugin.tags.join(' ')}`
          .toLowerCase()
          .includes(query)
      return categoryMatches && queryMatches
    })
  })

  function isInstalled(pluginId: string) {
    return allInstalledPlugins.value.some((plugin) => plugin.id === pluginId)
  }
  function setActivePlugin(plugin: Plugin | null) {
    activePlugin.value = plugin
  }
  function getPlugin(pluginId: string) {
    return allInstalledPlugins.value.find((plugin) => plugin.id === pluginId)
  }
  function exportPlugin(pluginId: string) {
    const plugin = getPlugin(pluginId)
    if (!plugin) return null
    const {
      filePath: _filePath,
      isBuiltIn: _isBuiltIn,
      isInstalled: _isInstalled,
      source: _source,
      ...document
    } = plugin
    return JSON.stringify(document, null, 2)
  }
  async function savePlugin(plugin: Plugin) {
    const result = await window.api.savePluginFile(plugin)
    if (!result.success) throw new Error(result.message || 'Unable to save plugin.')
  }
  function addCustomPlugin(plugin: Omit<Plugin, 'id' | 'createdAt' | 'updatedAt'>) {
    const created = normalizePlugin({
      ...plugin,
      id: `custom-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    customPlugins.value.push(created)
    void savePlugin(created)
    return created
  }
  function updateCustomPlugin(pluginId: string, updates: Partial<Plugin>) {
    const index = customPlugins.value.findIndex((plugin) => plugin.id === pluginId)
    if (index < 0) return
    customPlugins.value[index] = normalizePlugin({
      ...customPlugins.value[index],
      ...updates,
      updatedAt: new Date().toISOString()
    })
    void savePlugin(customPlugins.value[index])
  }
  function uninstallPlugin(pluginId: string) {
    customPlugins.value = customPlugins.value.filter((plugin) => plugin.id !== pluginId)
    void window.api.deletePluginFile(pluginId)
  }
  function importPlugin(json: string) {
    try {
      const plugin = parsePlugin(json)
      if (BUILTIN_PLUGINS.some((item) => item.id === plugin.id))
        plugin.id = `custom-${crypto.randomUUID()}`
      customPlugins.value = [...customPlugins.value.filter((item) => item.id !== plugin.id), plugin]
      void savePlugin(plugin)
      return { success: true, message: 'Plugin imported.', plugin }
    } catch (error: unknown) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Invalid plugin JSON.'
      }
    }
  }
  async function syncFromDisk() {
    const result = await window.api.listPlugins()
    if (!result.success) return
    customPlugins.value = result.plugins.map((plugin) =>
      normalizePlugin(plugin as unknown as Plugin)
    )
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
    loadFromStorage: () => undefined
  }
})
