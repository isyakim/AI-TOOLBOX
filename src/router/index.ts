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
    meta: { title: 'Chat' }
  },
  {
    path: '/plugins',
    name: 'Plugins',
    component: () => import('@/pages/PluginMarketPage.vue'),
    meta: { title: 'Plugins' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/pages/SettingsPage.vue'),
    meta: { title: 'Settings' }
  },
  {
    path: '/knowledge',
    name: 'Knowledge',
    component: () => import('@/pages/KnowledgeBasePage.vue'),
    meta: { title: 'Knowledge' }
  },
  {
    path: '/project-map',
    name: 'ProjectMap',
    component: () => import('@/pages/ProjectMapPage.vue'),
    meta: { title: 'Project Map' }
  },
  {
    path: '/agent',
    name: 'AgentTasks',
    component: () => import('@/pages/AgentTasksPage.vue'),
    meta: { title: 'Agent Tasks' }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/pages/AboutPage.vue'),
    meta: { title: 'About' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
