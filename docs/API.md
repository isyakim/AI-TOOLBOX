# AI Toolbox API 文档

本文档详细介绍 AI Toolbox 的核心 API 和扩展接口。

## 📋 目录

- [Store API](#store-api)
- [服务 API](#服务-api)
- [工具函数](#工具函数)
- [IPC 通信](#ipc-通信)

---

## 🗃️ Store API

### useThemeStore

主题配置管理。

```typescript
import { useThemeStore, THEME_PRESETS } from '@/stores'

const themeStore = useThemeStore()

// 当前配置
themeStore.config
// ThemeConfig {
//   primaryHue: number        // 0-360
//   primarySaturation: number // 0-100
//   primaryLightness: number  // 0-100
//   surfaceHue: number
//   surfaceSaturation: number
//   surfaceLightness: number
//   glassBlur: number         // 0-30 px
//   glassOpacity: number      // 0-100 %
//   glassSaturation: number   // 0-200 %
//   isDark: boolean
//   borderRadius: number      // 0-24 px
//   presetName: string
// }

// 计算的 CSS 变量
themeStore.cssVariables
// Record<string, string>

// 更新主题
themeStore.updateTheme({ primaryHue: 270, isDark: true })

// 应用预设
themeStore.applyPreset('purple')
// 可用预设: 'default', 'purple', 'emerald', 'sunset', 'rose', 'dark', 'midnight', 'forest'

// 重置主题
themeStore.resetTheme()

// 导出/导入
const json = themeStore.exportTheme()
themeStore.importTheme(json)
```

### useChatStore

聊天会话管理。

```typescript
import { useChatStore, ROLE_MODES } from '@/stores'

const chatStore = useChatStore()

// 会话列表
chatStore.sessions
// Session[]

// 当前会话
chatStore.activeSession
// Session | null

// 创建/切换/删除会话
chatStore.createSession()
chatStore.switchSession(sessionId)
chatStore.deleteSession(sessionId)

// 发送消息
await chatStore.sendMessage('Hello')

// 发送多模态消息 (带图片)
await chatStore.sendMultimodalMessage('描述这张图', images)

// 停止流式响应
chatStore.stopStreaming()

// 切换角色
chatStore.setRole('coder')
// 可用角色: 'default', 'coder', 'writer', 'analyst', 'teacher'
```

### usePluginStore

插件管理。

```typescript
import { usePluginStore, PLUGIN_CATEGORIES } from '@/stores'

const pluginStore = usePluginStore()

// 插件列表
pluginStore.installedPlugins
pluginStore.marketplacePlugins
pluginStore.builtinPlugins

// 安装/卸载插件
pluginStore.installPlugin(plugin)
pluginStore.uninstallPlugin(pluginId)

// 使用插件
pluginStore.setActivePlugin(plugin)

// 导入/导出
const json = pluginStore.exportPlugin(pluginId)
pluginStore.importPlugin(json)
```

---

## 🔧 服务 API

### AIClient

AI API 客户端。

```typescript
import { createAIClient, getAIClient, destroyAIClient } from '@/services/aiClient'

// 创建客户端
createAIClient({
  apiUrl: 'https://api.openai.com/v1',
  apiKey: 'sk-xxx',
  model: 'gpt-4'
})

// 获取客户端
const client = getAIClient()

// 发送消息
await client.chat(messages, {
  onToken: (token) => console.log(token),
  onError: (error) => console.error(error)
})

// 取消请求
client.abort()

// 销毁客户端
destroyAIClient()
```

### speechService

语音服务。

```typescript
import { speechService } from '@/services/speechService'

// 检查支持
speechService.isRecognitionSupported
speechService.isSynthesisSupported

// 语音识别
speechService.startRecognition({
  onResult: (result) => {
    // result.transcript: 识别文本
    // result.isFinal: 是否为最终结果
  },
  onEnd: () => console.log('识别结束'),
  onError: (error) => console.error(error)
})

speechService.stopRecognition()

// 语音合成 (TTS)
speechService.speak('Hello World', {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  onEnd: () => console.log('播放完成')
})

speechService.stopSpeaking()
```

### pluginExecutor

插件执行器。

```typescript
import { pluginExecutor } from '@/services/pluginExecutor'

// 执行插件
const result = await pluginExecutor.execute(plugin, inputs, {
  onToken: (token) => console.log(token),
  onComplete: (rawOutput, processedOutput, stats) => {
    console.log('原始输出:', rawOutput)
    console.log('处理后输出:', processedOutput)
    console.log('统计:', stats)
  }
})
```

---

## 🔨 工具函数

### imageUtils

图片处理工具。

```typescript
import {
  fileToBase64,
  fileToDataUrl,
  getImageDimensions,
  compressImage,
  processImageFile,
  getImageFromClipboard,
  buildVisionContent,
  revokeImageUrls,
  isValidImageType,
  MAX_IMAGE_SIZE,
  MAX_IMAGES
} from '@/utils/imageUtils'

// 文件转 Base64
const base64 = await fileToBase64(file)

// 文件转 Data URL
const dataUrl = await fileToDataUrl(file)

// 获取图片尺寸
const { width, height } = await getImageDimensions(file)

// 压缩图片
const compressed = await compressImage(file, {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.8
})

// 处理图片文件
const imageInfo = await processImageFile(file, true)
// ImageInfo {
//   file: File
//   url: string        // Object URL
//   base64: string
//   width: number
//   height: number
//   size: number
//   type: string
// }

// 从剪贴板读取图片
const imageFile = await getImageFromClipboard()

// 构建 Vision API 内容
const content = buildVisionContent('描述这张图', images)
// [
//   { type: 'text', text: '描述这张图' },
//   { type: 'image_url', image_url: { url: 'data:...' } }
// ]

// 释放 Object URLs
revokeImageUrls(images)

// 验证图片类型
isValidImageType('image/jpeg') // true
```

---

## 📡 IPC 通信

### 自动更新

```typescript
// 渲染进程

// 检查更新
const result = await window.electron.invoke('check-for-updates')

// 下载更新
await window.electron.invoke('download-update')

// 安装更新
await window.electron.invoke('install-update')

// 获取版本
const version = await window.electron.invoke('get-app-version')

// 监听更新事件
window.electron.on('app-update', (event, { event, data }) => {
  switch (event) {
    case 'checking-for-update':
      console.log('检查更新中...')
      break
    case 'update-available':
      console.log('有可用更新:', data.version)
      break
    case 'update-not-available':
      console.log('已是最新版本')
      break
    case 'download-progress':
      console.log('下载进度:', data.percent)
      break
    case 'update-downloaded':
      console.log('更新已下载')
      break
    case 'update-error':
      console.error('更新错误:', data)
      break
  }
})
```

### 文件系统

```typescript
// 读取文件
const content = await window.electron.invoke('read-file', path)

// 写入文件
await window.electron.invoke('write-file', path, content)

// 选择文件
const files = await window.electron.invoke('show-open-dialog', {
  filters: [{ name: 'Images', extensions: ['jpg', 'png'] }]
})

// 保存文件
const path = await window.electron.invoke('show-save-dialog', {
  defaultPath: 'export.json'
})
```

---

## 🎨 CSS 变量参考

主题系统提供以下 CSS 变量：

```css
/* 主色调 */
--primary: hsl(221, 83%, 53%);
--primary-dark: hsl(221, 83%, 43%);
--primary-light: hsl(221, 83%, 68%);
--primary-hue: 221;
--primary-sat: 83%;

/* 表面颜色 */
--surface: hsl(220, 14%, 96%);
--secondary: hsl(220, 14%, 92%);
--surface-light: hsl(220, 14%, 98%);

/* 文字颜色 */
--text: hsl(222, 47%, 11%);
--text-light: hsl(215, 16%, 47%);

/* 边框 */
--border: hsla(220, 14%, 80%, 0.5);

/* 毛玻璃效果 */
--glass-blur: 12px;
--glass-opacity: 0.85;
--glass-saturation: 120%;
--glass-bg: hsla(220, 14%, 100%, 0.85);

/* 圆角 */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;

/* 渐变背景 */
--bg-gradient-start: hsl(225, 19%, 96%);
--bg-gradient-end: hsl(230, 9%, 94%);
```

---

## 📝 类型定义

完整的 TypeScript 类型定义请参考：

- `src/stores/theme.ts` - 主题类型
- `src/stores/chat.ts` - 聊天类型
- `src/stores/plugins.ts` - 插件类型
- `src/services/aiClient.ts` - AI 客户端类型
- `src/utils/imageUtils.ts` - 图片工具类型
