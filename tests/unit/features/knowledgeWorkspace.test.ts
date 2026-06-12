/* eslint-disable vue/one-component-per-file */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useKnowledgeWorkspace } from '@/features/knowledge/composables/useKnowledgeWorkspace'
import { RAGService } from '@/services/ragService'
import { useConfigStore } from '@/stores/config'

describe('useKnowledgeWorkspace', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.assign(window, {
      api: {
        getConfig: vi.fn().mockResolvedValue({
          projectPath: 'C:/missing-project',
          extensions: ['.ts', '.unknown']
        }),
        setConfig: vi.fn().mockResolvedValue({ success: true }),
        setWorkspace: vi.fn().mockResolvedValue({ success: false, message: 'Missing' })
      }
    })
  })

  it('drops an unavailable stored workspace and persists supported extensions', async () => {
    let workspace: ReturnType<typeof useKnowledgeWorkspace> | undefined
    const app = createApp(
      defineComponent({
        setup() {
          workspace = useKnowledgeWorkspace()
          return () => null
        }
      })
    )
    app.use(createPinia())
    app.mount(document.createElement('div'))

    await workspace!.restore()

    expect(workspace!.projectPath.value).toBe('')
    expect(workspace!.selectedExtensions.value).toEqual(['.ts'])
    expect(window.api.setConfig).toHaveBeenCalledWith('knowledge-workspace', {
      projectPath: '',
      extensions: ['.ts']
    })
    app.unmount()
  })

  it('stops status polling when the owner component unmounts', async () => {
    vi.useFakeTimers()
    const pinia = createPinia()
    setActivePinia(pinia)
    const config = useConfigStore()
    config.configs.push({
      id: 'provider',
      providerId: 'openai',
      providerName: 'OpenAI',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'key',
      models: ['model'],
      selectedModel: 'model',
      isActive: true
    })
    config.activeConfigId = 'provider'
    vi.spyOn(RAGService, 'init').mockResolvedValue({ success: true })
    vi.spyOn(RAGService, 'indexProject').mockImplementation(() => new Promise(() => undefined))
    vi.spyOn(RAGService, 'getIndexStatus').mockResolvedValue({
      success: true,
      status: 'ready',
      rootPath: 'C:/project',
      totalFiles: 1,
      indexedFiles: 1,
      totalChunks: 1,
      currentFile: '',
      startedAt: 0,
      completedAt: 1,
      message: 'done'
    })
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    const app = createApp(
      defineComponent({
        setup() {
          const workspace = useKnowledgeWorkspace()
          workspace.startPolling()
          return () => null
        }
      })
    )
    app.use(pinia)
    app.mount(document.createElement('div'))
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
    expect(setIntervalSpy).toHaveBeenCalled()
    app.unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
