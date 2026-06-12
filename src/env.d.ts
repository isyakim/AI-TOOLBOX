/// <reference types="vite/client" />

import type { AIToolboxAPI } from './shared/types/ipc'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}

declare global {
  interface Window {
    api: AIToolboxAPI
  }
}

export type { ProjectHealthReport } from './shared/types/ipc'
