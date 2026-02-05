import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/chat'
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('@/pages/ChatPage.vue'),
    meta: { title: '智能对话', icon: '💬' }
  },
  {
    path: '/tools',
    name: 'Tools',
    component: () => import('@/pages/ToolsPage.vue'),
    meta: { title: 'AI工具集', icon: '🛠️' }
  },
  {
    path: '/ui-architect',
    name: 'UIArchitect',
    component: () => import('@/pages/UIArchitectPage.vue'),
    meta: { title: 'UI架构师', icon: '🎨', featured: true }
  },
  {
    path: '/plugins',
    name: 'Plugins',
    component: () => import('@/pages/PluginMarketPage.vue'),
    meta: { title: '插件中心', icon: '🧩' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/pages/SettingsPage.vue'),
    meta: { title: '设置', icon: '⚙️' }
  },
  {
    path: '/theme',
    name: 'Theme',
    component: () => import('@/pages/ThemeSettingsPage.vue'),
    meta: { title: '主题引擎', icon: '🎨', featured: true }
  },
  {
    path: '/knowledge',
    name: 'Knowledge',
    component: () => import('@/pages/KnowledgeBasePage.vue'),
    meta: { title: '知识库', icon: '📂' }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/pages/AboutPage.vue'),
    meta: { title: '关于', icon: '📝' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
