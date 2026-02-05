# AI Toolbox 贡献指南

感谢你对 AI Toolbox 项目的关注！我们欢迎各种形式的贡献。

## 📋 目录

- [开发环境设置](#开发环境设置)
- [项目结构](#项目结构)
- [开发规范](#开发规范)
- [提交规范](#提交规范)
- [测试指南](#测试指南)
- [发布流程](#发布流程)

---

## 🛠️ 开发环境设置

### 前置要求

- Node.js 20+
- npm 9+
- Git

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/xKim/ai-toolbox.git
cd ai-toolbox

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 可用脚本

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动 Electron 开发模式 |
| `npm run dev:web` | 启动 Web 开发模式 |
| `npm run build` | 构建生产包 |
| `npm run build:mac` | 构建 macOS 安装包 |
| `npm run build:win` | 构建 Windows 安装包 |
| `npm run build:linux` | 构建 Linux 安装包 |
| `npm run lint` | 代码检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test:unit` | 运行单元测试 |
| `npm run test:e2e` | 运行 E2E 测试 |

---

## 📁 项目结构

```
ai-toolbox/
├── .github/
│   └── workflows/         # GitHub Actions 工作流
├── build/                 # 构建资源 (图标等)
├── e2e/                   # E2E 测试
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── index.ts       # 主进程入口
│   │   └── updater.ts     # 自动更新服务
│   ├── preload/           # 预加载脚本
│   ├── renderer/          # 渲染进程 (Vue 应用)
│   │   ├── src/
│   │   │   ├── assets/    # 静态资源
│   │   │   ├── components/# Vue 组件
│   │   │   ├── pages/     # 页面组件
│   │   │   ├── router/    # Vue Router 配置
│   │   │   ├── services/  # 业务服务
│   │   │   ├── stores/    # Pinia 状态管理
│   │   │   ├── utils/     # 工具函数
│   │   │   ├── App.vue    # 根组件
│   │   │   └── main.ts    # 渲染进程入口
│   │   └── index.html
│   └── ...
├── tests/
│   ├── setup.ts           # 测试环境设置
│   └── unit/              # 单元测试
├── electron-builder.yml   # Electron Builder 配置
├── electron.vite.config.ts# Electron Vite 配置
├── vitest.config.ts       # Vitest 配置
├── playwright.config.ts   # Playwright 配置
└── package.json
```

---

## 📝 开发规范

### 代码风格

- 使用 **TypeScript** 编写所有代码
- 使用 **ESLint** 和 **Prettier** 保持代码一致性
- 遵循 Vue 3 Composition API 风格

### 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 组件 | PascalCase | `MessageBubble.vue` |
| 页面 | PascalCase + Page | `ChatPage.vue` |
| Store | camelCase | `useChatStore` |
| 服务 | camelCase + Service | `speechService` |
| 工具 | camelCase + Utils | `imageUtils` |

### 组件开发

```vue
<script setup lang="ts">
// 1. 导入
import { ref, computed, onMounted } from 'vue'
import { useStore } from '@/stores'

// 2. Props 和 Emits
const props = defineProps<{
  title: string
  count?: number
}>()

const emit = defineEmits<{
  'update': [value: string]
}>()

// 3. 响应式状态
const state = ref('')

// 4. 计算属性
const computed = computed(() => state.value.toUpperCase())

// 5. 方法
function handleClick() {
  emit('update', state.value)
}

// 6. 生命周期
onMounted(() => {
  // 初始化
})
</script>

<template>
  <div class="component-name">
    <!-- 模板内容 -->
  </div>
</template>

<style scoped>
/* 组件样式 */
</style>
```

---

## 📦 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 类型

| 类型 | 描述 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式 (不影响代码逻辑) |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具相关 |
| `ci` | CI 配置 |

### 示例

```bash
feat(chat): 添加多模态图片输入支持
fix(theme): 修复暗色模式下边框颜色问题
docs(readme): 更新安装说明
```

---

## 🧪 测试指南

### 单元测试 (Vitest)

```bash
# 运行所有单元测试
npm run test:unit

# 监听模式
npm run test:unit:watch

# 生成覆盖率报告
npm run test:unit:coverage
```

测试文件位于 `tests/unit/` 目录，遵循 `*.test.ts` 命名。

### E2E 测试 (Playwright)

```bash
# 运行 E2E 测试
npm run test:e2e

# 使用 UI 模式
npm run test:e2e:ui
```

测试文件位于 `e2e/` 目录，遵循 `*.spec.ts` 命名。

---

## 🚀 发布流程

### 版本号规范

遵循 [Semantic Versioning](https://semver.org/):

- `MAJOR`: 不兼容的 API 变更
- `MINOR`: 向后兼容的功能新增
- `PATCH`: 向后兼容的 Bug 修复

### 发布步骤

1. **更新版本号**
   ```bash
   npm version patch|minor|major
   ```

2. **创建 Release Tag**
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

3. **自动构建**
   - GitHub Actions 会自动构建多平台安装包
   - 构建成功后自动发布到 GitHub Releases

4. **验证发布**
   - 检查各平台安装包是否正常
   - 验证自动更新功能

---

## 🤝 参与贡献

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feat/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feat/amazing-feature`)
5. 创建 Pull Request

### Pull Request 指南

- 确保所有测试通过
- 确保代码检查通过
- 提供清晰的 PR 描述
- 关联相关 Issue

---

## 📞 联系方式

- **GitHub Issues**: [提交问题](https://github.com/xKim/ai-toolbox/issues)
- **Discussions**: [参与讨论](https://github.com/xKim/ai-toolbox/discussions)

感谢你的贡献！ 🎉
