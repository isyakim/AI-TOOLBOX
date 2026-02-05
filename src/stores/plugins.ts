/**
 * Plugin System Store
 * 插件系统的核心状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ===== 类型定义 =====

/** 插件输入字段类型 */
export type PluginFieldType = 'text' | 'textarea' | 'select' | 'number' | 'toggle' | 'file'

/** 插件输入字段定义 */
export interface PluginField {
  id: string
  label: string
  type: PluginFieldType
  placeholder?: string
  defaultValue?: string | number | boolean
  options?: { label: string; value: string }[] // for select type
  required?: boolean
  rows?: number // for textarea
}

/** 后处理器脚本 */
export interface PostProcessor {
  enabled: boolean
  script: string // JavaScript code to transform the result
}

/** 插件定义 */
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
  postProcessor?: PostProcessor
  tags?: string[]
  downloads?: number
  rating?: number
  createdAt: string
  updatedAt: string
  isBuiltIn?: boolean
  isInstalled?: boolean
  source?: 'local' | 'marketplace'
}

/** 插件分类 */
export type PluginCategory = 
  | 'productivity' 
  | 'writing' 
  | 'coding' 
  | 'translation' 
  | 'analysis' 
  | 'creative'
  | 'education'
  | 'business'
  | 'utility'
  | 'other'

export const PLUGIN_CATEGORIES: { id: PluginCategory; name: string; icon: string }[] = [
  { id: 'productivity', name: '效率工具', icon: '⚡' },
  { id: 'writing', name: '写作助手', icon: '✍️' },
  { id: 'coding', name: '编程开发', icon: '💻' },
  { id: 'translation', name: '翻译语言', icon: '🌐' },
  { id: 'analysis', name: '数据分析', icon: '📊' },
  { id: 'creative', name: '创意设计', icon: '🎨' },
  { id: 'education', name: '教育学习', icon: '📚' },
  { id: 'business', name: '商业办公', icon: '💼' },
  { id: 'utility', name: '实用工具', icon: '🔧' },
  { id: 'other', name: '其他', icon: '📦' }
]

// ===== 内置插件 =====
const BUILT_IN_PLUGINS: Plugin[] = [
  {
    id: 'email-writer',
    name: '邮件写作助手',
    icon: '📧',
    description: '根据场景、收件人关系和要点，自动生成专业的商务邮件',
    author: 'AI Toolbox',
    version: '1.0.0',
    category: 'business',
    systemPrompt: `你是一位专业的商务邮件撰写专家。请根据用户提供的信息撰写一封专业、得体的邮件。

要求：
1. 根据场景调整语气（正式/友好/紧急）
2. 结构清晰，包含问候、正文、结尾
3. 语言简洁专业
4. 适当使用礼貌用语`,
    fields: [
      { id: 'scenario', label: '邮件场景', type: 'select', required: true, options: [
        { label: '会议邀请', value: 'meeting' },
        { label: '项目汇报', value: 'report' },
        { label: '请求协助', value: 'request' },
        { label: '感谢回复', value: 'thanks' },
        { label: '催促跟进', value: 'followup' },
        { label: '道歉解释', value: 'apology' },
        { label: '其他', value: 'other' }
      ]},
      { id: 'recipient', label: '收件人关系', type: 'select', required: true, options: [
        { label: '上级领导', value: 'superior' },
        { label: '同事', value: 'colleague' },
        { label: '下属', value: 'subordinate' },
        { label: '客户', value: 'client' },
        { label: '合作伙伴', value: 'partner' }
      ]},
      { id: 'keyPoints', label: '核心要点', type: 'textarea', placeholder: '列出邮件需要包含的关键信息点...', rows: 4, required: true },
      { id: 'tone', label: '语气风格', type: 'select', options: [
        { label: '正式专业', value: 'formal' },
        { label: '友好亲切', value: 'friendly' },
        { label: '简洁直接', value: 'concise' }
      ]}
    ],
    tags: ['邮件', '商务', '办公'],
    isBuiltIn: true,
    isInstalled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: 'code-reviewer',
    name: '代码审查专家',
    icon: '🔍',
    description: '分析代码质量，提供优化建议、安全隐患检测和最佳实践推荐',
    author: 'AI Toolbox',
    version: '1.0.0',
    category: 'coding',
    systemPrompt: `你是一位资深代码审查专家，拥有 10+ 年编程经验。请对用户提交的代码进行全面审查。

审查维度：
1. **代码质量**: 可读性、命名规范、代码结构
2. **性能优化**: 算法效率、内存使用、潜在瓶颈
3. **安全隐患**: XSS、SQL注入、敏感信息泄露等
4. **最佳实践**: 设计模式、SOLID原则、行业规范

输出格式：
- 问题等级: 🔴 严重 / 🟡 警告 / 🔵 建议
- 问题描述
- 修复建议（附代码示例）`,
    fields: [
      { id: 'language', label: '编程语言', type: 'select', required: true, options: [
        { label: 'JavaScript/TypeScript', value: 'javascript' },
        { label: 'Python', value: 'python' },
        { label: 'Java', value: 'java' },
        { label: 'Go', value: 'go' },
        { label: 'Rust', value: 'rust' },
        { label: 'C/C++', value: 'cpp' },
        { label: '其他', value: 'other' }
      ]},
      { id: 'code', label: '待审查代码', type: 'textarea', placeholder: '粘贴需要审查的代码...', rows: 10, required: true },
      { id: 'focus', label: '重点关注', type: 'select', options: [
        { label: '全面审查', value: 'all' },
        { label: '性能优化', value: 'performance' },
        { label: '安全检测', value: 'security' },
        { label: '代码风格', value: 'style' }
      ]}
    ],
    postProcessor: {
      enabled: true,
      script: `
// 为审查结果添加统计信息
const issues = {
  critical: (result.match(/🔴/g) || []).length,
  warning: (result.match(/🟡/g) || []).length,
  info: (result.match(/🔵/g) || []).length
};
return \`## 📊 审查统计\\n🔴 严重: \${issues.critical} | 🟡 警告: \${issues.warning} | 🔵 建议: \${issues.info}\\n\\n---\\n\\n\${result}\`;
`
    },
    tags: ['代码', '审查', '安全'],
    isBuiltIn: true,
    isInstalled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: 'meeting-notes',
    name: '会议纪要生成器',
    icon: '📋',
    description: '将会议录音转写或口语化笔记转换为结构化的专业会议纪要',
    author: 'AI Toolbox',
    version: '1.0.0',
    category: 'productivity',
    systemPrompt: `你是一位专业的会议秘书。请将用户提供的会议内容整理为结构化的会议纪要。

输出格式：
## 📅 会议纪要

**会议主题**: [提取主题]
**会议时间**: [如有提及]
**参会人员**: [如有提及]

### 📌 会议要点
- 要点1
- 要点2
...

### ✅ 决议事项
| 序号 | 事项 | 责任人 | 截止日期 |
|------|------|--------|----------|
| 1 | ... | ... | ... |

### 📝 待办跟进
- [ ] 任务1
- [ ] 任务2

### 💬 其他备注
（补充信息）`,
    fields: [
      { id: 'content', label: '会议内容', type: 'textarea', placeholder: '粘贴会议录音转写内容或手写笔记...', rows: 8, required: true },
      { id: 'format', label: '输出格式', type: 'select', options: [
        { label: '完整纪要', value: 'full' },
        { label: '简洁要点', value: 'brief' },
        { label: '仅待办事项', value: 'todos' }
      ]}
    ],
    tags: ['会议', '纪要', '效率'],
    isBuiltIn: true,
    isInstalled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: 'sql-generator',
    name: 'SQL 生成器',
    icon: '🗄️',
    description: '用自然语言描述需求，自动生成 SQL 查询语句',
    author: 'AI Toolbox',
    version: '1.0.0',
    category: 'coding',
    systemPrompt: `你是一位数据库专家。根据用户的自然语言描述和表结构，生成正确的 SQL 查询语句。

要求：
1. 生成标准、高效的 SQL
2. 添加必要的注释说明
3. 考虑性能优化（索引使用、避免全表扫描）
4. 提供查询结果的预期说明

如果描述不清晰，先列出假设再生成 SQL。`,
    fields: [
      { id: 'dialect', label: '数据库类型', type: 'select', required: true, options: [
        { label: 'MySQL', value: 'mysql' },
        { label: 'PostgreSQL', value: 'postgresql' },
        { label: 'SQLite', value: 'sqlite' },
        { label: 'SQL Server', value: 'sqlserver' },
        { label: 'Oracle', value: 'oracle' }
      ]},
      { id: 'schema', label: '表结构描述', type: 'textarea', placeholder: '描述相关的表名、字段名，例如：\nusers 表: id, name, email, created_at\norders 表: id, user_id, amount, status', rows: 4 },
      { id: 'requirement', label: '查询需求', type: 'textarea', placeholder: '用自然语言描述你想要查询的数据...', rows: 3, required: true }
    ],
    tags: ['SQL', '数据库', '开发'],
    isBuiltIn: true,
    isInstalled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  },
  {
    id: 'learning-tutor',
    name: '费曼学习法导师',
    icon: '🎓',
    description: '用费曼学习法帮你深入理解复杂概念，像给小白讲解一样学习',
    author: 'AI Toolbox',
    version: '1.0.0',
    category: 'education',
    systemPrompt: `你是一位运用费曼学习法的教育专家。请帮助用户深入理解一个概念。

费曼学习法四步骤：
1. **选择概念**: 确认要学习的主题
2. **教给小白**: 用最简单的语言解释，仿佛对方是完全不懂的人
3. **发现盲点**: 找出解释中的困难点
4. **简化优化**: 用类比和故事让概念更易理解

请按以下结构输出：
## 🎯 概念名称

### 📖 一句话解释
（用一句话概括核心）

### 👶 给小白的解释
（假设对方是小学生，用生活化的例子）

### 🔍 关键点拆解
- 关键点1
- 关键点2

### 🎭 生动类比
（用日常生活中的事物做类比）

### ❓ 自测问题
帮助检验是否真正理解`,
    fields: [
      { id: 'concept', label: '想要理解的概念', type: 'text', placeholder: '例如：量子纠缠、区块链、微服务架构...', required: true },
      { id: 'background', label: '你的知识背景', type: 'select', options: [
        { label: '完全零基础', value: 'beginner' },
        { label: '有一点了解', value: 'basic' },
        { label: '有相关基础', value: 'intermediate' }
      ]},
      { id: 'field', label: '概念所属领域', type: 'text', placeholder: '例如：物理学、计算机科学...' }
    ],
    tags: ['学习', '教育', '费曼'],
    isBuiltIn: true,
    isInstalled: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
]

// ===== 市场示例插件（模拟远程数据）=====
const MARKETPLACE_PLUGINS: Plugin[] = [
  {
    id: 'market-regex-helper',
    name: '正则表达式助手',
    icon: '🔤',
    description: '自然语言生成正则表达式，附带测试用例和解释',
    author: 'RegexMaster',
    version: '1.2.0',
    category: 'coding',
    systemPrompt: '你是正则表达式专家...',
    fields: [
      { id: 'description', label: '匹配规则描述', type: 'textarea', required: true },
      { id: 'language', label: '目标语言', type: 'select', options: [
        { label: 'JavaScript', value: 'js' },
        { label: 'Python', value: 'python' },
        { label: 'Java', value: 'java' }
      ]}
    ],
    tags: ['正则', '开发', '工具'],
    downloads: 1520,
    rating: 4.8,
    isBuiltIn: false,
    isInstalled: false,
    source: 'marketplace',
    createdAt: '2024-02-15',
    updatedAt: '2024-03-01'
  },
  {
    id: 'market-api-doc',
    name: 'API 文档生成器',
    icon: '📄',
    description: '根据代码自动生成 RESTful API 文档，支持 OpenAPI 格式',
    author: 'DocGenius',
    version: '2.0.1',
    category: 'coding',
    systemPrompt: '你是API文档专家...',
    fields: [
      { id: 'code', label: '接口代码', type: 'textarea', required: true, rows: 10 },
      { id: 'format', label: '输出格式', type: 'select', options: [
        { label: 'Markdown', value: 'md' },
        { label: 'OpenAPI YAML', value: 'openapi' }
      ]}
    ],
    tags: ['API', '文档', '开发'],
    downloads: 3280,
    rating: 4.9,
    isBuiltIn: false,
    isInstalled: false,
    source: 'marketplace',
    createdAt: '2024-01-20',
    updatedAt: '2024-03-10'
  },
  {
    id: 'market-weekly-report',
    name: '周报自动生成',
    icon: '📈',
    description: '根据本周工作记录自动生成结构化周报',
    author: 'WorkFlow',
    version: '1.5.0',
    category: 'business',
    systemPrompt: '你是周报写作专家...',
    fields: [
      { id: 'tasks', label: '本周完成的工作', type: 'textarea', required: true, rows: 5 },
      { id: 'blockers', label: '遇到的问题', type: 'textarea', rows: 3 },
      { id: 'nextWeek', label: '下周计划', type: 'textarea', rows: 3 }
    ],
    tags: ['周报', '办公', '效率'],
    downloads: 5670,
    rating: 4.7,
    isBuiltIn: false,
    isInstalled: false,
    source: 'marketplace',
    createdAt: '2024-01-15',
    updatedAt: '2024-02-28'
  },
  {
    id: 'market-copywriting',
    name: '营销文案大师',
    icon: '✨',
    description: '一键生成吸引眼球的营销文案，支持多种风格和平台',
    author: 'CopyPro',
    version: '1.8.0',
    category: 'creative',
    systemPrompt: '你是顶级营销文案专家...',
    fields: [
      { id: 'product', label: '产品/服务', type: 'text', required: true },
      { id: 'platform', label: '投放平台', type: 'select', options: [
        { label: '微信公众号', value: 'wechat' },
        { label: '小红书', value: 'xiaohongshu' },
        { label: '抖音', value: 'douyin' },
        { label: '微博', value: 'weibo' }
      ]},
      { id: 'style', label: '文案风格', type: 'select', options: [
        { label: '专业权威', value: 'professional' },
        { label: '轻松活泼', value: 'casual' },
        { label: '情感共鸣', value: 'emotional' }
      ]}
    ],
    tags: ['文案', '营销', '创意'],
    downloads: 8920,
    rating: 4.6,
    isBuiltIn: false,
    isInstalled: false,
    source: 'marketplace',
    createdAt: '2024-02-01',
    updatedAt: '2024-03-05'
  },
  {
    id: 'market-data-viz',
    name: '数据可视化建议',
    icon: '📊',
    description: '根据数据特征推荐最佳图表类型，并生成 ECharts 配置',
    author: 'VizWizard',
    version: '1.0.0',
    category: 'analysis',
    systemPrompt: '你是数据可视化专家...',
    fields: [
      { id: 'data', label: '数据描述', type: 'textarea', required: true },
      { id: 'purpose', label: '展示目的', type: 'text' }
    ],
    tags: ['可视化', '图表', '数据'],
    downloads: 2340,
    rating: 4.5,
    isBuiltIn: false,
    isInstalled: false,
    source: 'marketplace',
    createdAt: '2024-02-20',
    updatedAt: '2024-02-20'
  }
]

// ===== Store 定义 =====
export const usePluginStore = defineStore('plugins', () => {
  // 已安装的插件（包括内置和用户自定义）
  const installedPlugins = ref<Plugin[]>([...BUILT_IN_PLUGINS])
  
  // 用户自定义插件
  const customPlugins = ref<Plugin[]>([])
  
  // 市场插件缓存
  const marketplacePlugins = ref<Plugin[]>([...MARKETPLACE_PLUGINS])
  
  // 当前选中的插件
  const activePlugin = ref<Plugin | null>(null)
  
  // 搜索关键词
  const searchQuery = ref('')
  
  // 当前分类
  const activeCategory = ref<PluginCategory | 'all'>('all')

  // ===== 计算属性 =====
  
  // 所有可用插件（已安装 + 自定义）
  const allInstalledPlugins = computed(() => {
    return [...installedPlugins.value, ...customPlugins.value]
  })
  
  // 过滤后的已安装插件
  const filteredInstalledPlugins = computed(() => {
    let plugins = allInstalledPlugins.value
    
    if (activeCategory.value !== 'all') {
      plugins = plugins.filter(p => p.category === activeCategory.value)
    }
    
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      plugins = plugins.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags?.some(t => t.toLowerCase().includes(query))
      )
    }
    
    return plugins
  })
  
  // 过滤后的市场插件
  const filteredMarketplacePlugins = computed(() => {
    let plugins = marketplacePlugins.value.filter(p => !isInstalled(p.id))
    
    if (activeCategory.value !== 'all') {
      plugins = plugins.filter(p => p.category === activeCategory.value)
    }
    
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      plugins = plugins.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags?.some(t => t.toLowerCase().includes(query))
      )
    }
    
    return plugins.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
  })
  
  // 热门插件
  const popularPlugins = computed(() => {
    return [...marketplacePlugins.value]
      .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, 6)
  })

  // ===== 方法 =====
  
  /** 检查插件是否已安装 */
  function isInstalled(pluginId: string): boolean {
    return allInstalledPlugins.value.some(p => p.id === pluginId)
  }
  
  /** 安装插件 */
  function installPlugin(plugin: Plugin) {
    if (isInstalled(plugin.id)) return
    
    const installedPlugin: Plugin = {
      ...plugin,
      isInstalled: true,
      source: 'marketplace'
    }
    installedPlugins.value.push(installedPlugin)
    saveToStorage()
  }
  
  /** 卸载插件 */
  function uninstallPlugin(pluginId: string) {
    const index = installedPlugins.value.findIndex(p => p.id === pluginId && !p.isBuiltIn)
    if (index !== -1) {
      installedPlugins.value.splice(index, 1)
      saveToStorage()
    }
    
    const customIndex = customPlugins.value.findIndex(p => p.id === pluginId)
    if (customIndex !== -1) {
      customPlugins.value.splice(customIndex, 1)
      saveToStorage()
    }
  }
  
  /** 添加自定义插件 */
  function addCustomPlugin(plugin: Omit<Plugin, 'id' | 'createdAt' | 'updatedAt'>) {
    const newPlugin: Plugin = {
      ...plugin,
      id: `custom-${Date.now()}`,
      isBuiltIn: false,
      isInstalled: true,
      source: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    customPlugins.value.push(newPlugin)
    saveToStorage()
    return newPlugin
  }
  
  /** 更新自定义插件 */
  function updateCustomPlugin(pluginId: string, updates: Partial<Plugin>) {
    const index = customPlugins.value.findIndex(p => p.id === pluginId)
    if (index !== -1) {
      customPlugins.value[index] = {
        ...customPlugins.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      saveToStorage()
    }
  }
  
  /** 获取插件详情 */
  function getPlugin(pluginId: string): Plugin | undefined {
    return allInstalledPlugins.value.find(p => p.id === pluginId) ||
           marketplacePlugins.value.find(p => p.id === pluginId)
  }
  
  /** 设置当前活动插件 */
  function setActivePlugin(plugin: Plugin | null) {
    activePlugin.value = plugin
  }
  
  /** 导出插件为 JSON */
  function exportPlugin(pluginId: string): string | null {
    const plugin = getPlugin(pluginId)
    if (!plugin) return null
    
    const exportData = {
      ...plugin,
      isBuiltIn: false,
      isInstalled: false,
      source: undefined,
      downloads: undefined,
      rating: undefined
    }
    return JSON.stringify(exportData, null, 2)
  }
  
  /** 从 JSON 导入插件 */
  function importPlugin(jsonString: string): { success: boolean; message: string; plugin?: Plugin } {
    try {
      const plugin = JSON.parse(jsonString) as Plugin
      
      // 验证必需字段
      if (!plugin.name || !plugin.systemPrompt || !plugin.fields) {
        return { success: false, message: '插件配置缺少必需字段' }
      }
      
      // 生成新 ID 避免冲突
      const newPlugin = addCustomPlugin({
        ...plugin,
        author: plugin.author || 'Unknown',
        version: plugin.version || '1.0.0',
        category: plugin.category || 'other',
        icon: plugin.icon || '🔌'
      })
      
      return { success: true, message: '插件导入成功', plugin: newPlugin }
    } catch (e) {
      return { success: false, message: '无效的 JSON 格式' }
    }
  }
  
  /** 保存到本地存储 */
  function saveToStorage() {
    try {
      localStorage.setItem('ai-toolbox-plugins', JSON.stringify({
        installed: installedPlugins.value.filter(p => !p.isBuiltIn),
        custom: customPlugins.value
      }))
    } catch (e) {
      console.error('Failed to save plugins:', e)
    }
  }
  
  /** 从本地存储加载 */
  function loadFromStorage() {
    try {
      const data = localStorage.getItem('ai-toolbox-plugins')
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed.installed) {
          installedPlugins.value = [...BUILT_IN_PLUGINS, ...parsed.installed]
        }
        if (parsed.custom) {
          customPlugins.value = parsed.custom
        }
      }
    } catch (e) {
      console.error('Failed to load plugins:', e)
    }
  }
  
  // 初始化时加载
  loadFromStorage()

  return {
    // State
    installedPlugins,
    customPlugins,
    marketplacePlugins,
    activePlugin,
    searchQuery,
    activeCategory,
    
    // Computed
    allInstalledPlugins,
    filteredInstalledPlugins,
    filteredMarketplacePlugins,
    popularPlugins,
    
    // Methods
    isInstalled,
    installPlugin,
    uninstallPlugin,
    addCustomPlugin,
    updateCustomPlugin,
    getPlugin,
    setActivePlugin,
    exportPlugin,
    importPlugin,
    loadFromStorage
  }
})
