<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useThemeStore, THEME_PRESETS, type ThemeConfig } from '@/stores/theme'

const themeStore = useThemeStore()

const activeTab = ref<'presets' | 'customize' | 'export'>('presets')

// 色轮相关
const colorWheelRef = ref<HTMLCanvasElement | null>(null)
const isDragging = ref(false)

// 预设列表
const presetList = computed(() => 
  Object.entries(THEME_PRESETS).map(([id, config]) => ({
    id,
    ...config
  }))
)

// 当前配置
const config = computed(() => themeStore.config)

// 判断当前是否为某个预设
const currentPresetId = computed(() => {
  for (const [id, preset] of Object.entries(THEME_PRESETS)) {
    if (
      preset.primaryHue === config.value.primaryHue &&
      preset.primarySaturation === config.value.primarySaturation &&
      preset.isDark === config.value.isDark
    ) {
      return id
    }
  }
  return null
})

// 导出/导入
const exportJson = ref('')
const importJson = ref('')
const importError = ref('')

// ===== 色轮交互 =====
function drawColorWheel() {
  const canvas = colorWheelRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const size = canvas.width
  const center = size / 2
  const radius = center - 10

  // 清空画布
  ctx.clearRect(0, 0, size, size)

  // 绘制色轮
  for (let angle = 0; angle < 360; angle++) {
    const startAngle = (angle - 1) * Math.PI / 180
    const endAngle = (angle + 1) * Math.PI / 180

    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.arc(center, center, radius, startAngle, endAngle)
    ctx.closePath()

    ctx.fillStyle = `hsl(${angle}, ${config.value.primarySaturation}%, ${config.value.primaryLightness}%)`
    ctx.fill()
  }

  // 绘制中心圆（显示当前颜色）
  ctx.beginPath()
  ctx.arc(center, center, radius * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = `hsl(${config.value.primaryHue}, ${config.value.primarySaturation}%, ${config.value.primaryLightness}%)`
  ctx.fill()
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 3
  ctx.stroke()

  // 绘制选择器指示点
  const indicatorAngle = (config.value.primaryHue - 90) * Math.PI / 180
  const indicatorX = center + Math.cos(indicatorAngle) * (radius * 0.75)
  const indicatorY = center + Math.sin(indicatorAngle) * (radius * 0.75)

  ctx.beginPath()
  ctx.arc(indicatorX, indicatorY, 12, 0, Math.PI * 2)
  ctx.fillStyle = 'white'
  ctx.fill()
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 2
  ctx.stroke()
}

function handleWheelClick(event: MouseEvent) {
  const canvas = colorWheelRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left - canvas.width / 2
  const y = event.clientY - rect.top - canvas.height / 2

  const angle = Math.atan2(y, x)
  let hue = (angle * 180 / Math.PI + 90 + 360) % 360

  themeStore.updateTheme({ primaryHue: Math.round(hue) })
  drawColorWheel()
}

function startDrag() {
  isDragging.value = true
}

function stopDrag() {
  isDragging.value = false
}

function handleDrag(event: MouseEvent) {
  if (isDragging.value) {
    handleWheelClick(event)
  }
}

// ===== 导出/导入 =====
function handleExport() {
  exportJson.value = themeStore.exportTheme()
  activeTab.value = 'export'
}

function handleImport() {
  importError.value = ''
  if (themeStore.importTheme(importJson.value)) {
    importJson.value = ''
    activeTab.value = 'presets'
  } else {
    importError.value = '无效的主题配置 JSON'
  }
}

function copyExportJson() {
  navigator.clipboard.writeText(exportJson.value)
}

onMounted(() => {
  themeStore.loadFromStorage()
  drawColorWheel()
})
</script>

<template>
  <div class="theme-settings">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
    </div>

    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-content">
        <span class="header-icon">🎨</span>
        <div class="header-text">
          <h1>主题引擎</h1>
          <p>自定义应用外观，打造专属视觉体验</p>
        </div>
      </div>
    </header>

    <!-- 标签导航 -->
    <div class="tab-nav">
      <button 
        :class="{ active: activeTab === 'presets' }"
        @click="activeTab = 'presets'"
      >
        🎭 预设主题
      </button>
      <button 
        :class="{ active: activeTab === 'customize' }"
        @click="activeTab = 'customize'"
      >
        ⚙️ 自定义
      </button>
      <button 
        :class="{ active: activeTab === 'export' }"
        @click="handleExport"
      >
        📦 导入/导出
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="content-area">
      <!-- 预设主题 -->
      <div v-if="activeTab === 'presets'" class="presets-grid">
        <div 
          v-for="preset in presetList"
          :key="preset.id"
          class="preset-card"
          :class="{ active: currentPresetId === preset.id }"
          @click="themeStore.applyPreset(preset.id)"
        >
          <div 
            class="preset-preview"
            :style="{
              background: preset.isDark 
                ? `linear-gradient(135deg, hsl(${preset.surfaceHue}, ${preset.surfaceSaturation}%, ${preset.surfaceLightness}%), hsl(${preset.surfaceHue}, ${preset.surfaceSaturation}%, ${(preset.surfaceLightness || 10) + 5}%))`
                : `linear-gradient(135deg, hsl(${preset.surfaceHue}, ${preset.surfaceSaturation}%, ${preset.surfaceLightness}%), hsl(${preset.surfaceHue}, ${preset.surfaceSaturation}%, ${(preset.surfaceLightness || 96) - 3}%))`
            }"
          >
            <div 
              class="preview-accent"
              :style="{ background: `hsl(${preset.primaryHue}, ${preset.primarySaturation}%, ${preset.primaryLightness}%)` }"
            ></div>
            <div class="preview-elements">
              <div class="preview-bar"></div>
              <div class="preview-content"></div>
            </div>
          </div>
          <div class="preset-info">
            <span class="preset-name">{{ preset.presetName }}</span>
            <span v-if="preset.isDark" class="dark-badge">🌙 暗色</span>
          </div>
        </div>
      </div>

      <!-- 自定义设置 -->
      <div v-if="activeTab === 'customize'" class="customize-panel">
        <div class="customize-grid">
          <!-- 色轮选择器 -->
          <div class="control-group color-wheel-group">
            <h3>🎨 主题色相</h3>
            <canvas 
              ref="colorWheelRef"
              width="200"
              height="200"
              class="color-wheel"
              @click="handleWheelClick"
              @mousedown="startDrag"
              @mouseup="stopDrag"
              @mouseleave="stopDrag"
              @mousemove="handleDrag"
            ></canvas>
            <div class="hue-value">
              Hue: {{ config.primaryHue }}°
            </div>
          </div>

          <!-- 颜色调整 -->
          <div class="control-group">
            <h3>🔆 颜色参数</h3>
            
            <div class="slider-item">
              <label>饱和度 <span>{{ config.primarySaturation }}%</span></label>
              <input 
                type="range" 
                min="0" max="100" 
                :value="config.primarySaturation"
                @input="themeStore.updateTheme({ primarySaturation: +($event.target as HTMLInputElement).value }); drawColorWheel()"
              />
            </div>
            
            <div class="slider-item">
              <label>亮度 <span>{{ config.primaryLightness }}%</span></label>
              <input 
                type="range" 
                min="20" max="80" 
                :value="config.primaryLightness"
                @input="themeStore.updateTheme({ primaryLightness: +($event.target as HTMLInputElement).value }); drawColorWheel()"
              />
            </div>

            <div class="slider-item">
              <label>圆角尺寸 <span>{{ config.borderRadius }}px</span></label>
              <input 
                type="range" 
                min="0" max="24" 
                :value="config.borderRadius"
                @input="themeStore.updateTheme({ borderRadius: +($event.target as HTMLInputElement).value })"
              />
            </div>
          </div>

          <!-- 毛玻璃效果 -->
          <div class="control-group">
            <h3>✨ 毛玻璃效果</h3>
            
            <div class="slider-item">
              <label>模糊深度 <span>{{ config.glassBlur }}px</span></label>
              <input 
                type="range" 
                min="0" max="30" 
                :value="config.glassBlur"
                @input="themeStore.updateTheme({ glassBlur: +($event.target as HTMLInputElement).value })"
              />
            </div>
            
            <div class="slider-item">
              <label>透明度 <span>{{ config.glassOpacity }}%</span></label>
              <input 
                type="range" 
                min="40" max="100" 
                :value="config.glassOpacity"
                @input="themeStore.updateTheme({ glassOpacity: +($event.target as HTMLInputElement).value })"
              />
            </div>

            <div class="slider-item">
              <label>色彩饱和 <span>{{ config.glassSaturation }}%</span></label>
              <input 
                type="range" 
                min="100" max="200" 
                :value="config.glassSaturation"
                @input="themeStore.updateTheme({ glassSaturation: +($event.target as HTMLInputElement).value })"
              />
            </div>
          </div>

          <!-- 模式切换 -->
          <div class="control-group">
            <h3>🌓 显示模式</h3>
            
            <div class="mode-toggle">
              <button 
                :class="{ active: !config.isDark }"
                @click="themeStore.updateTheme({ isDark: false })"
              >
                ☀️ 浅色模式
              </button>
              <button 
                :class="{ active: config.isDark }"
                @click="themeStore.updateTheme({ isDark: true })"
              >
                🌙 暗色模式
              </button>
            </div>

            <button class="reset-btn" @click="themeStore.resetTheme(); drawColorWheel()">
              🔄 恢复默认主题
            </button>
          </div>
        </div>

        <!-- 实时预览 -->
        <div class="live-preview">
          <h3>📱 实时预览</h3>
          <div class="preview-container">
            <div class="preview-sidebar">
              <div class="preview-logo"></div>
              <div class="preview-nav-item active"></div>
              <div class="preview-nav-item"></div>
              <div class="preview-nav-item"></div>
            </div>
            <div class="preview-main">
              <div class="preview-header">
                <div class="preview-title"></div>
                <div class="preview-button"></div>
              </div>
              <div class="preview-card">
                <div class="preview-text"></div>
                <div class="preview-text short"></div>
              </div>
              <div class="preview-card glass">
                <div class="preview-text"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 导入/导出 -->
      <div v-if="activeTab === 'export'" class="export-panel">
        <div class="export-section">
          <h3>📤 导出当前主题</h3>
          <p>将当前主题配置复制分享给他人</p>
          <textarea readonly :value="exportJson" class="json-textarea"></textarea>
          <button class="primary-btn" @click="copyExportJson">
            📋 复制到剪贴板
          </button>
        </div>

        <div class="import-section">
          <h3>📥 导入主题</h3>
          <p>粘贴 JSON 配置来应用新主题</p>
          <textarea 
            v-model="importJson" 
            placeholder='{"primaryHue": 270, ...}'
            class="json-textarea"
          ></textarea>
          <p v-if="importError" class="error-msg">{{ importError }}</p>
          <button class="primary-btn" @click="handleImport">
            ✨ 应用主题
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-settings {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
}

/* 背景装饰 */
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
  opacity: 0.4;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, var(--primary-light), var(--primary));
  top: -100px;
  right: -100px;
  animation: float 20s ease-in-out infinite;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  bottom: -50px;
  left: -50px;
  animation: float 15s ease-in-out infinite reverse;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(30px, -30px) scale(1.1); }
}

/* 页面头部 */
.page-header {
  position: relative;
  z-index: 10;
  padding: 24px 32px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon {
  font-size: 2.5rem;
}

.header-text h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text);
}

.header-text p {
  margin: 4px 0 0 0;
  color: var(--text-light);
  font-size: 0.95rem;
}

/* 标签导航 */
.tab-nav {
  position: relative;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 0 32px;
  margin-bottom: 20px;
}

.tab-nav button {
  padding: 10px 20px;
  border: none;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  color: var(--text-light);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-nav button:hover {
  background: var(--surface);
  color: var(--text);
}

.tab-nav button.active {
  background: var(--primary);
  color: white;
}

/* 内容区域 */
.content-area {
  flex: 1;
  position: relative;
  z-index: 10;
  padding: 0 32px 32px;
  overflow-y: auto;
}

/* 预设网格 */
.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.preset-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.preset-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.preset-card.active {
  border-color: var(--primary);
}

.preset-preview {
  height: 100px;
  position: relative;
  padding: 12px;
}

.preview-accent {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.preview-elements {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-bar {
  width: 60px;
  height: 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
}

.preview-content {
  width: 40px;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.preset-info {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preset-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.dark-badge {
  font-size: 0.75rem;
  color: var(--text-light);
}

/* 自定义面板 */
.customize-panel {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
}

.customize-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.control-group {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border-radius: var(--radius-lg);
  padding: 20px;
}

.control-group h3 {
  margin: 0 0 16px 0;
  font-size: 1rem;
  color: var(--text);
}

/* 色轮 */
.color-wheel-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.color-wheel {
  cursor: crosshair;
  border-radius: 50%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.hue-value {
  margin-top: 12px;
  font-size: 0.9rem;
  color: var(--text-light);
}

/* 滑块 */
.slider-item {
  margin-bottom: 16px;
}

.slider-item:last-child {
  margin-bottom: 0;
}

.slider-item label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.85rem;
  color: var(--text);
}

.slider-item label span {
  color: var(--primary);
  font-weight: 600;
}

.slider-item input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--secondary);
  appearance: none;
  outline: none;
}

.slider-item input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* 模式切换 */
.mode-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.mode-toggle button {
  flex: 1;
  padding: 10px;
  border: 2px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-toggle button:hover {
  border-color: var(--primary);
}

.mode-toggle button.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.reset-btn {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: var(--secondary);
}

/* 实时预览 */
.live-preview {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border-radius: var(--radius-lg);
  padding: 20px;
}

.live-preview h3 {
  margin: 0 0 16px 0;
  font-size: 1rem;
  color: var(--text);
}

.preview-container {
  display: flex;
  height: 300px;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.preview-sidebar {
  width: 60px;
  background: var(--surface);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-logo {
  width: 36px;
  height: 36px;
  background: var(--primary);
  border-radius: var(--radius-sm);
  margin: 0 auto 8px;
}

.preview-nav-item {
  width: 100%;
  height: 32px;
  background: var(--secondary);
  border-radius: var(--radius-sm);
}

.preview-nav-item.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
}

.preview-main {
  flex: 1;
  background: var(--secondary);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-title {
  width: 120px;
  height: 24px;
  background: var(--surface);
  border-radius: var(--radius-sm);
}

.preview-button {
  width: 80px;
  height: 32px;
  background: var(--primary);
  border-radius: var(--radius-md);
}

.preview-card {
  flex: 1;
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-card.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
}

.preview-text {
  width: 100%;
  height: 12px;
  background: var(--secondary);
  border-radius: 6px;
}

.preview-text.short {
  width: 60%;
}

/* 导出面板 */
.export-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.export-section,
.import-section {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  border-radius: var(--radius-lg);
  padding: 24px;
}

.export-section h3,
.import-section h3 {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  color: var(--text);
}

.export-section p,
.import-section p {
  margin: 0 0 16px 0;
  color: var(--text-light);
  font-size: 0.9rem;
}

.json-textarea {
  width: 100%;
  height: 200px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  font-family: 'Fira Code', monospace;
  font-size: 0.85rem;
  resize: none;
  margin-bottom: 16px;
}

.primary-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(var(--primary-hue), var(--primary-sat), 50%, 0.3);
}

.error-msg {
  color: #ef4444;
  font-size: 0.85rem;
  margin-bottom: 12px;
}

@media (max-width: 900px) {
  .customize-panel {
    grid-template-columns: 1fr;
  }
  
  .customize-grid {
    grid-template-columns: 1fr;
  }
  
  .export-panel {
    grid-template-columns: 1fr;
  }
}
</style>
