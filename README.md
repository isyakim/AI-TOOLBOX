# 🤖 AI Toolbox (AI 工具箱)

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/isyakim/AI-TOOLBOX)
[![Tech Stack](https://img.shields.io/badge/tech-Vue3%20%2B%20TS%20%2B%20Electron-brightgreen.svg)](https://github.com/isyakim/AI-TOOLBOX)

**AI Toolbox** 是一款面向开发者的专业级桌面 AI 效率应用。基于 **Electron + Vue 3 + TypeScript** 深度定制，旨在提供极致、安全、可控的 AI 交互体验。不仅仅是一个对话界面，它更是你本地文件系统的智能管家。

---

## ✨ 核心特性

### 🎨 AI UI Architect (全新旗舰功能)
**从创意到代码，瞬间实现** — 通过自然语言描述或上传设计图，一键生成完整可运行的前端代码。
- **Vision 驱动**: 支持上传原型图、手绘白板图或网页截图，AI 自动解析并生成代码
- **多技术栈**: 内置 Vue 3、React、Next.js 14、Svelte、原生 HTML 五大技术栈模板
- **实时预览**: 内置沙箱环境，即时在应用内预览生成的 UI 效果
- **一键脚手架**: 结合内置文件操作，自动创建项目结构并生成组件文件
- **代码高亮**: Prism.js 驱动的语法高亮，支持多文件标签页切换

### 🚀 极致架构
采用 `electron-vite` 驱动，秒级启动与热更新，全链条 TypeScript 类型安全。

### 💬 智能对话增强
- **角色矩阵**: 内置 4 种专业人格 (Helper, Coder, Product, Challenger)
- **Markdown & 代码高亮**: 集成 `Marked` + `PrismJS`，完美渲染复杂公式与多语言代码块
- **会话持久化**: 毫秒级关键字搜索，会话历史本地加密存储

### 📁 文件系统联动
- **AI 操作授权**: AI 能够根据指令读取、写入或删除本地文件
- **安全审批流**: 每一个高危操作都需经过用户在 UI 面板确认

### 🛠️ 多合一工具集
内置翻译、摘要、代码辅助、文本优化、纠错、原理解析等高频工具。

### ⚙️ 灵活端点配置
兼容 OpenAI 格式，预设 12 个主流 API 服务商 (DeepSeek, Anthropic, OpenRouter 等)，支持连接实时测试。

### 🧩 插件化生态系统
**用 JSON 定义你的专属 AI 工具**
- **可视化创建器**: 无需编码，通过表单创建自定义插件（输入字段、系统提示词、后处理脚本）
- **沙箱执行**: 安全的 JavaScript 沙箱运行用户脚本，转换 AI 输出
- **插件市场**: 一键安装社区插件，支持导入/导出 JSON 配置
- **内置精品插件**: 邮件写作助手、代码审查专家、SQL 生成器、费曼学习法导师等

### 🎨 多模态交互
**让 AI 看得见、听得懂**
- **Vision 图片识别**: 支持上传、粘贴、拖拽图片，让 AI 分析图像内容（最多 4 张）
- **语音输入**: Web Speech API 实时语音转文字，边说边录
- **TTS 播报**: 一键朗读 AI 回复，支持中文语音合成
- **图片预览**: 消息中的图片支持点击放大，沉浸式预览

### 🎭 自定义主题引擎
**打造专属视觉体验**
- **HSL 色轮选择**: 直观的色相选择器，360° 自由调色
- **毛玻璃效果调节**: 模糊深度、透明度、色彩饱和度可调
- **8 款精美预设**: 经典蓝、梦幻紫、翡翠绿、日落橙、玫瑰红等
- **暗色模式**: 完整的深色主题支持，护眼又时尚
- **主题导入/导出**: JSON 格式分享你的主题配置

### ⚙️ 工业级工程化
**符合开源最佳实践**
- **自动化 CI/CD**: GitHub Actions 多平台自动构建发布
- **静默更新**: electron-updater 差量更新机制
- **完整测试**: Vitest 单元测试 + Playwright E2E 测试
- **详尽文档**: 贡献指南、API 文档、开发规范

---

## 🛠️ 技术路线

| 模块 | 技术选型 | 作用 |
| :--- | :--- | :--- |
| **框架** | Vue 3 (Composition API) | 响应式 UI 与业务组件化 |
| **构建** | electron-vite | 电信级的本地开发与生产构建 |
| **状态** | Pinia | 跨页面的持久化状态管理 (Store) |
| **语言** | TypeScript | 全局类型定义与代码质量保证 |
| **样式** | Scoped CSS + CSS Variables | 现代化的主题切换与 UI 响应式 |
| **IPC** | ContextBridge | 安全的主进程与渲染进程桥接 |
| **测试** | Vitest + Playwright | 单元测试与 E2E 测试 |
| **更新** | electron-updater | 静默差量自动更新 |

---

## 🚀 快速开始

### 1. 环境依赖
确保您的电脑已安装 [Node.js](https://nodejs.org/) (建议 v18+)

### 2. 克隆与安装
```bash
git clone https://github.com/isyakim/AI-TOOLBOX.git
cd AI-TOOLBOX
npm install
```

### 3. 开发运行
```bash
npm run dev
```

### 4. 构建发布
```bash
# 构建 macOS 版本
npm run build:mac

# 构建 Windows 版本
npm run build:win

# 构建 Linux 版本
npm run build:linux
```

---

## 📂 项目结构

```text
├── electron/          # 主进程与预加载逻辑
│   ├── main/          # IPC 通信与窗口控制
│   └── preload/       # 进程间 API 桥接
├── src/               # 渲染进程 (Vue 3 应用)
│   ├── assets/        # 静态资源
│   ├── components/    # 通用业务组件
│   ├── data/          # 服务商预设数据
│   ├── pages/         # 页面视图 (Chat, Tools, Settings)
│   ├── services/      # AI 核心请求服务
│   ├── stores/        # Pinia 状态管理
│   └── styles/        # 全局设计规范
└── tsconfig.json      # TypeScript 全局配置
```

---

## 🗺️ 未来规划 (Roadmap)

我们致力于将 AI Toolbox 打造为 GitHub 上的精选开源项目，以下是正在计划中的进阶功能：

- [ ] **Local RAG (知识库)**: 集成本地向量数据库，支持对 PDF/Markdown 等文档的智能问答。
- [ ] **插件化系统**: 允许用户通过简单的 JS 脚本扩展自定义 AI Tool。
- [ ] **多模态解析**: 支持图片识图、语音实时转写与播报。
- [ ] **CI/CD 自动化**: 集成 GitHub Actions 实现多平台自动打包与发布下载。

---

## 📄 开源协议
本项目采用 [MIT License](LICENSE) 协议。

---
> 如果这个项目对你有帮助，欢迎点一个 **Star** ⭐！
