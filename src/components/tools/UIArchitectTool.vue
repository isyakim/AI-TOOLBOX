<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { getAIClient, type ChatMessage } from '@/services/aiClient'
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-css'

const props = defineProps<{
  isReady: boolean
}>()

// ===== 类型定义 =====
interface TechStack {
  id: string
  name: string
  icon: string
  color: string
  template: string
}

interface GeneratedFile {
  name: string
  content: string
  language: string
}

// ===== 技术栈配置 =====
const techStacks: TechStack[] = [
  { 
    id: 'vue-ts', 
    name: 'Vue 3 + TypeScript', 
    icon: '🟢', 
    color: '#42b883',
    template: 'Vue 3 Composition API + TypeScript + 现代 CSS (支持 CSS 变量)'
  },
  { 
    id: 'react-ts', 
    name: 'React + TypeScript', 
    icon: '⚛️', 
    color: '#61dafb',
    template: 'React 18 函数组件 + TypeScript + CSS Modules'
  },
  { 
    id: 'nextjs', 
    name: 'Next.js 14', 
    icon: '▲', 
    color: '#ffffff',
    template: 'Next.js 14 App Router + TypeScript + Tailwind CSS'
  },
  { 
    id: 'html-css', 
    name: 'HTML + CSS + JS', 
    icon: '🌐', 
    color: '#e44d26',
    template: '纯净 HTML5 + 现代 CSS3 + Vanilla JavaScript'
  },
  { 
    id: 'svelte', 
    name: 'Svelte', 
    icon: '🔥', 
    color: '#ff3e00',
    template: 'Svelte 4 + TypeScript + 内置样式'
  }
]

// ===== 状态管理 =====
const description = ref('')
const selectedStack = ref<TechStack>(techStacks[0])
const uploadedImages = ref<string[]>([])
const isDragOver = ref(false)
const isGenerating = ref(false)
const generationProgress = ref(0)
const generatedFiles = ref<GeneratedFile[]>([])
const activeFileIndex = ref(0)
const showPreview = ref(false)
const previewHtml = ref('')
const customInstructions = ref('')
const showAdvanced = ref(false)

// ===== 计算属性 =====
const canGenerate = computed(() => 
  (description.value.trim().length > 0 || uploadedImages.value.length > 0) && 
  props.isReady && 
  !isGenerating.value
)

const activeFile = computed(() => generatedFiles.value[activeFileIndex.value])

const highlightedCode = computed(() => {
  if (!activeFile.value) return ''
  const lang = activeFile.value.language
  const grammar = Prism.languages[lang] || Prism.languages.markup
  return Prism.highlight(activeFile.value.content, grammar, lang)
})

// ===== 图片上传处理 =====
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files) processFiles(files)
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) processFiles(input.files)
}

function processFiles(files: FileList) {
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) return
    if (uploadedImages.value.length >= 4) return

    const reader = new FileReader()
    reader.onload = (event) => {
      uploadedImages.value.push(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  })
}

function removeImage(index: number) {
  uploadedImages.value.splice(index, 1)
}

// ===== AI 代码生成 =====
async function generateCode() {
  if (!canGenerate.value) return

  const aiClient = getAIClient()
  if (!aiClient) return

  isGenerating.value = true
  generationProgress.value = 0
  generatedFiles.value = []
  activeFileIndex.value = 0

  // 构建系统提示词
  const systemPrompt = buildSystemPrompt()
  const userContent = buildUserContent()

  // 模拟进度
  const progressInterval = setInterval(() => {
    if (generationProgress.value < 90) {
      generationProgress.value += Math.random() * 15
    }
  }, 500)

  let rawOutput = ''

  try {
    await aiClient.chat([
      { role: 'system', content: systemPrompt } as ChatMessage,
      { role: 'user', content: userContent } as ChatMessage
    ], {
      onToken: (token) => {
        rawOutput += token
      }
    })

    generationProgress.value = 100
    clearInterval(progressInterval)

    // 解析生成的文件
    parseGeneratedCode(rawOutput)
    
    // 如果生成了 HTML/CSS/JS，准备预览
    preparePreview()

  } catch (error: any) {
    console.error('Generation error:', error)
    generatedFiles.value = [{
      name: 'error.txt',
      content: `❌ 生成失败: ${error.message}`,
      language: 'text'
    }]
  } finally {
    isGenerating.value = false
    clearInterval(progressInterval)
  }
}

function buildSystemPrompt(): string {
  const stack = selectedStack.value
  return `你是一位资深全栈工程师和 UI/UX 专家。请根据用户提供的描述或设计图，生成高质量、生产级别的代码。

## 技术栈要求
${stack.template}

## 输出格式规范
请按照以下格式输出每个文件，使用 markdown 代码块，并在代码块前标注文件名：

\`\`\`filename:组件名.vue\`\`\`
\`\`\`vue
// 代码内容
\`\`\`

## 设计规范
1. 使用现代化的 UI 设计，包括：
   - 精致的阴影和圆角
   - 适当的渐变色
   - 流畅的过渡动画
   - 响应式布局
2. 代码需要完整可运行，包含所有必要的导入
3. 使用语义化的 HTML 和无障碍属性
4. 包含必要的注释说明

${customInstructions.value ? `## 用户自定义要求\n${customInstructions.value}` : ''}`
}

function buildUserContent(): any[] {
  const content: any[] = []
  
  if (description.value) {
    content.push({ type: 'text', text: description.value })
  }
  
  uploadedImages.value.forEach(img => {
    content.push({ 
      type: 'image_url', 
      image_url: { url: img }
    })
  })
  
  return content.length > 0 ? content : [{ type: 'text', text: '创建一个现代化的登录页面' }]
}

function parseGeneratedCode(output: string) {
  const files: GeneratedFile[] = []
  
  // 匹配 ```filename:xxx``` 格式
  const fileBlocks = output.split(/```filename:([^\n`]+)```\s*\n*/)
  
  for (let i = 1; i < fileBlocks.length; i += 2) {
    const fileName = fileBlocks[i]?.trim()
    const codeBlock = fileBlocks[i + 1]
    
    if (!fileName || !codeBlock) continue
    
    // 从代码块中提取语言和内容
    const match = codeBlock.match(/```(\w+)?\s*([\s\S]*?)```/)
    if (match) {
      const lang = match[1] || getLanguageFromFileName(fileName)
      const content = match[2].trim()
      files.push({ name: fileName, content, language: lang })
    }
  }
  
  // 如果没有匹配到标准格式，尝试其他格式
  if (files.length === 0) {
    const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g
    let match
    let index = 0
    while ((match = codeBlockRegex.exec(output)) !== null) {
      const lang = match[1] || 'javascript'
      const content = match[2].trim()
      const ext = getExtensionFromLanguage(lang)
      files.push({
        name: `component_${index}.${ext}`,
        content,
        language: lang
      })
      index++
    }
  }
  
  // 如果仍然没有，返回原始内容
  if (files.length === 0) {
    files.push({
      name: 'output.txt',
      content: output,
      language: 'text'
    })
  }
  
  generatedFiles.value = files
}

function getLanguageFromFileName(name: string): string {
  if (name.endsWith('.vue')) return 'vue'
  if (name.endsWith('.tsx')) return 'tsx'
  if (name.endsWith('.ts')) return 'typescript'
  if (name.endsWith('.jsx')) return 'jsx'
  if (name.endsWith('.js')) return 'javascript'
  if (name.endsWith('.css')) return 'css'
  if (name.endsWith('.html')) return 'html'
  if (name.endsWith('.svelte')) return 'svelte'
  return 'javascript'
}

function getExtensionFromLanguage(lang: string): string {
  const map: Record<string, string> = {
    vue: 'vue', typescript: 'ts', tsx: 'tsx', jsx: 'jsx',
    javascript: 'js', css: 'css', html: 'html', svelte: 'svelte'
  }
  return map[lang] || 'txt'
}

// ===== 预览功能 =====
function preparePreview() {
  // 查找 HTML 和 CSS 文件
  const htmlFile = generatedFiles.value.find(f => f.language === 'html' || f.name.endsWith('.html'))
  const cssFile = generatedFiles.value.find(f => f.language === 'css' || f.name.endsWith('.css'))
  const jsFile = generatedFiles.value.find(f => 
    (f.language === 'javascript' || f.name.endsWith('.js')) && !f.name.includes('.vue')
  )
  
  if (htmlFile) {
    let html = htmlFile.content
    
    // 注入 CSS
    if (cssFile) {
      const styleTag = '<' + 'style>' + cssFile.content + '</' + 'style>'
      html = html.replace('</head>', styleTag + '</head>')
    }
    
    // 注入 JS
    if (jsFile) {
      const scriptTag = '<' + 'script>' + jsFile.content + '</' + 'script>'
      html = html.replace('</body>', scriptTag + '</body>')
    }
    
    previewHtml.value = html
  } else if (selectedStack.value.id === 'html-css') {
    // 如果是 HTML/CSS 技术栈但没有单独的 HTML 文件，尝试组合
    const css = cssFile?.content || ''
    const js = jsFile?.content || ''
    const styleTag = '<' + 'style>' + css + '</' + 'style>'
    const scriptTag = '<' + 'script>' + js + '</' + 'script>'
    previewHtml.value = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' + styleTag + '</head><body><div id="app">预览需要 HTML 内容</div>' + scriptTag + '</body></html>'
  }
}

function togglePreview() {
  showPreview.value = !showPreview.value
}

// ===== 文件操作 =====
function selectFile(index: number) {
  activeFileIndex.value = index
}

async function copyCode() {
  if (activeFile.value) {
    await navigator.clipboard.writeText(activeFile.value.content)
  }
}

async function copyAllFiles() {
  const allCode = generatedFiles.value
    .map(f => `// ===== ${f.name} =====\n${f.content}`)
    .join('\n\n')
  await navigator.clipboard.writeText(allCode)
}

async function saveToProject() {
  const api = (window as any).api
  if (!api?.fileAction) {
    alert('文件操作功能不可用')
    return
  }

  const basePath = await promptProjectPath()
  if (!basePath) return

  for (const file of generatedFiles.value) {
    await api.fileAction({
      action: 'write',
      path: `${basePath}/${file.name}`,
      content: file.content
    })
  }
  
  alert(`✅ 已保存 ${generatedFiles.value.length} 个文件到 ${basePath}`)
}

function promptProjectPath(): Promise<string | null> {
  return new Promise(resolve => {
    const path = window.prompt('请输入项目保存路径:', './generated-ui')
    resolve(path)
  })
}

// ===== 清空重置 =====
function resetAll() {
  description.value = ''
  uploadedImages.value = []
  generatedFiles.value = []
  showPreview.value = false
  previewHtml.value = ''
}
</script>

<template>
  <div class="ui-architect">
    <!-- 左侧: 输入区域 -->
    <div class="input-section">
      <!-- 技术栈选择器 -->
      <div class="section-block stack-selector">
        <h3 class="section-title">
          <span class="title-icon">⚡</span>
          选择技术栈
        </h3>
        <div class="stack-grid">
          <button 
            v-for="stack in techStacks" 
            :key="stack.id"
            class="stack-btn"
            :class="{ active: selectedStack.id === stack.id }"
            :style="{ '--stack-color': stack.color }"
            @click="selectedStack = stack"
          >
            <span class="stack-icon">{{ stack.icon }}</span>
            <span class="stack-name">{{ stack.name }}</span>
          </button>
        </div>
      </div>

      <!-- 描述输入 -->
      <div class="section-block description-input">
        <h3 class="section-title">
          <span class="title-icon">✨</span>
          描述你的 UI
        </h3>
        <textarea 
          v-model="description"
          class="description-textarea"
          placeholder="例如: 创建一个现代风格的登录页面，包含邮箱和密码输入框，支持社交账号登录，使用渐变背景..."
          rows="4"
        ></textarea>
      </div>

      <!-- 图片上传区 -->
      <div class="section-block image-upload">
        <h3 class="section-title">
          <span class="title-icon">🎨</span>
          上传原型图 / 参考截图
          <span class="optional-badge">可选</span>
        </h3>
        <div 
          class="upload-zone"
          :class="{ 'drag-over': isDragOver, 'has-images': uploadedImages.length > 0 }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
        >
          <input 
            type="file" 
            accept="image/*" 
            multiple 
            class="file-input"
            @change="handleFileSelect"
          >
          
          <div v-if="uploadedImages.length === 0" class="upload-placeholder">
            <div class="upload-icon">📁</div>
            <p class="upload-text">拖放图片到这里，或点击上传</p>
            <p class="upload-hint">支持 PNG、JPG、WEBP，最多 4 张</p>
          </div>

          <div v-else class="image-grid">
            <div 
              v-for="(img, idx) in uploadedImages" 
              :key="idx" 
              class="image-item"
            >
              <img :src="img" class="preview-img" />
              <button class="remove-btn" @click.stop="removeImage(idx)">×</button>
            </div>
            <label v-if="uploadedImages.length < 4" class="add-more-btn">
              <input type="file" accept="image/*" hidden @change="handleFileSelect">
              <span>+</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 高级选项 -->
      <div class="section-block advanced-options">
        <button class="toggle-advanced" @click="showAdvanced = !showAdvanced">
          <span>{{ showAdvanced ? '▼' : '▶' }}</span>
          高级选项
        </button>
        <div v-if="showAdvanced" class="advanced-content">
          <textarea 
            v-model="customInstructions"
            class="custom-input"
            placeholder="自定义指令，例如: 使用特定的配色方案、品牌风格、无障碍要求等..."
            rows="3"
          ></textarea>
        </div>
      </div>

      <!-- 生成按钮 -->
      <div class="action-bar">
        <button 
          class="generate-btn"
          :class="{ generating: isGenerating }"
          :disabled="!canGenerate"
          @click="generateCode"
        >
          <span v-if="isGenerating" class="btn-content">
            <span class="spinner"></span>
            正在生成... {{ Math.round(generationProgress) }}%
          </span>
          <span v-else class="btn-content">
            <span class="btn-icon">🚀</span>
            生成代码
          </span>
        </button>
        <button v-if="generatedFiles.length > 0" class="reset-btn" @click="resetAll">
          重新开始
        </button>
      </div>
    </div>

    <!-- 右侧: 结果区域 -->
    <div class="output-section" :class="{ 'has-result': generatedFiles.length > 0 }">
      <div v-if="generatedFiles.length === 0" class="empty-state">
        <div class="empty-icon">🎨</div>
        <h3>等待生成</h3>
        <p>描述你想要的 UI，或上传参考图片</p>
        <div class="feature-list">
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span>Vision AI 识别设计图</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span>多技术栈支持</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span>生产级代码输出</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">✓</span>
            <span>实时预览</span>
          </div>
        </div>
      </div>

      <template v-else>
        <!-- 文件标签栏 -->
        <div class="file-tabs">
          <div class="tabs-wrapper">
            <button 
              v-for="(file, idx) in generatedFiles" 
              :key="file.name"
              class="file-tab"
              :class="{ active: idx === activeFileIndex }"
              @click="selectFile(idx)"
            >
              <span class="file-icon">📄</span>
              {{ file.name }}
            </button>
          </div>
          <div class="tabs-actions">
            <button v-if="previewHtml" class="preview-toggle" @click="togglePreview">
              {{ showPreview ? '📝 代码' : '👁 预览' }}
            </button>
            <button class="action-btn" title="复制当前文件" @click="copyCode">📋</button>
            <button class="action-btn" title="复制全部" @click="copyAllFiles">📦</button>
            <button class="action-btn save-btn" title="保存到项目" @click="saveToProject">💾</button>
          </div>
        </div>

        <!-- 代码/预览区域 -->
        <div class="code-area">
          <!-- 代码视图 -->
          <pre v-if="!showPreview" class="code-block"><code v-html="highlightedCode"></code></pre>
          
          <!-- 预览视图 -->
          <div v-else class="preview-container">
            <iframe 
              :srcdoc="previewHtml"
              class="preview-iframe"
              sandbox="allow-scripts allow-same-origin"
            ></iframe>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ui-architect {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 24px;
  height: 100%;
  min-height: 500px;
}

/* ===== 通用区块样式 ===== */
.section-block {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 20px;
  border: 1px solid var(--border);
  transition: all 0.2s ease;
}

.section-block:hover {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text);
}

.title-icon {
  font-size: 1.1rem;
}

.optional-badge {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-light);
  background: var(--secondary);
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: auto;
}

/* ===== 左侧输入区 ===== */
.input-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-right: 8px;
}

/* 技术栈选择器 */
.stack-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.stack-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.stack-btn:hover {
  border-color: var(--stack-color);
  background: color-mix(in srgb, var(--stack-color) 5%, transparent);
}

.stack-btn.active {
  border-color: var(--stack-color);
  background: color-mix(in srgb, var(--stack-color) 12%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--stack-color) 20%, transparent);
}

.stack-icon {
  font-size: 1.2rem;
}

.stack-name {
  font-weight: 500;
  color: var(--text);
}

/* 描述输入 */
.description-textarea {
  width: 100%;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  line-height: 1.6;
  resize: vertical;
  background: var(--secondary);
  color: var(--text);
  transition: all 0.2s;
}

.description-textarea:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.description-textarea::placeholder {
  color: var(--text-light);
}

/* 图片上传区 */
.upload-zone {
  position: relative;
  border: 2px dashed var(--border);
  border-radius: var(--radius-md);
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--secondary);
  min-height: 140px;
}

.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 5%, var(--secondary));
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-placeholder {
  pointer-events: none;
}

.upload-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
  opacity: 0.7;
}

.upload-text {
  margin: 0;
  font-weight: 500;
  color: var(--text);
}

.upload-hint {
  margin: 8px 0 0;
  font-size: 0.8rem;
  color: var(--text-light);
}

/* 图片网格 */
.image-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.image-item {
  position: relative;
  aspect-ratio: 16/10;
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.remove-btn:hover {
  transform: scale(1.1);
}

.add-more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16/10;
  border: 2px dashed var(--border);
  border-radius: var(--radius-sm);
  font-size: 2rem;
  color: var(--text-light);
  cursor: pointer;
  transition: all 0.2s;
}

.add-more-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

/* 高级选项 */
.toggle-advanced {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  font-size: 0.9rem;
  color: var(--text-light);
  cursor: pointer;
  padding: 0;
}

.toggle-advanced:hover {
  color: var(--primary);
}

.advanced-content {
  margin-top: 12px;
}

.custom-input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  resize: vertical;
  background: var(--secondary);
  color: var(--text);
}

.custom-input:focus {
  outline: none;
  border-color: var(--primary);
}

/* 操作按钮 */
.action-bar {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.generate-btn {
  flex: 1;
  padding: 16px 24px;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(99, 102, 241, 0.45);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.generate-btn.generating {
  background: linear-gradient(135deg, #8b5cf6, #a855f7);
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-icon {
  font-size: 1.2rem;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.reset-btn {
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: var(--secondary);
  border-color: var(--primary);
}

/* ===== 右侧输出区 ===== */
.output-section {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: all 0.3s ease;
}

.output-section.has-result {
  box-shadow: var(--shadow-card);
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 1.25rem;
  color: var(--text);
}

.empty-state p {
  margin: 0 0 24px;
  color: var(--text-light);
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: var(--text);
}

.feature-icon {
  color: var(--success);
  font-weight: bold;
}

/* 文件标签栏 */
.file-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--secondary);
  border-bottom: 1px solid var(--border);
}

.tabs-wrapper {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0;
}

.file-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-light);
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.file-tab:hover {
  background: var(--surface);
}

.file-tab.active {
  background: var(--surface);
  color: var(--primary);
  border-color: var(--primary);
  font-weight: 500;
}

.file-icon {
  font-size: 0.9rem;
}

.tabs-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--secondary);
  border-color: var(--primary);
}

.save-btn:hover {
  background: color-mix(in srgb, var(--success) 10%, var(--surface));
  border-color: var(--success);
}

.preview-toggle {
  padding: 8px 14px;
  border: 1px solid var(--primary);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-toggle:hover {
  background: color-mix(in srgb, var(--primary) 10%, transparent);
}

/* 代码区域 */
.code-area {
  flex: 1;
  overflow: hidden;
}

.code-block {
  margin: 0;
  padding: 20px;
  height: 100%;
  overflow: auto;
  background: #1e1e1e;
  font-family: 'Fira Code', 'SF Mono', Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.7;
  color: #d4d4d4;
}

.code-block code {
  display: block;
}

/* 预览区域 */
.preview-container {
  height: 100%;
  background: #ffffff;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: none;
}

/* ===== 响应式 ===== */
@media (max-width: 960px) {
  .ui-architect {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  
  .input-section {
    max-height: 50vh;
  }
}
</style>
