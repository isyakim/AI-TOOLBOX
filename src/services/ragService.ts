import type {
  ProjectHealthReport,
  RAGConfigPayload,
  RAGIndexStatus,
  RAGQueryResponse,
  RAGQueryResult
} from '@/shared/types/ipc'

export interface RAGCitation {
  source: string
  path?: string
  relativePath?: string
  snippet: string
  score?: number
}

export interface ProjectIndexOptions {
  rootPath: string
  extensions: string[]
}

export interface ProviderRAGConfig {
  apiKey: string
  baseUrl: string
  selectedModel?: string
  embeddingModel?: string
}

export function toRAGConfig(config: ProviderRAGConfig): RAGConfigPayload {
  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.selectedModel,
    embeddingModel: config.embeddingModel
  }
}

export class RAGService {
  static init(config: ProviderRAGConfig) {
    return window.api.ragInit(toRAGConfig(config))
  }

  static query(query: string, config: ProviderRAGConfig, limit = 3): Promise<RAGQueryResponse> {
    return window.api.ragQuery({ query, limit, config: toRAGConfig(config) })
  }

  static indexProject(
    options: ProjectIndexOptions,
    config: ProviderRAGConfig
  ): Promise<RAGIndexStatus> {
    return window.api.ragIndexProject({ ...options, config: toRAGConfig(config) })
  }

  static getIndexStatus(): Promise<RAGIndexStatus> {
    return window.api.ragIndexStatus()
  }

  static runProjectHealthCheck(
    rootPath: string
  ): Promise<{ success: boolean; report?: ProjectHealthReport; message?: string }> {
    return window.api.projectHealthCheck({ rootPath })
  }

  static mapResultsToCitations(results: RAGQueryResult[] = []): RAGCitation[] {
    return results
      .filter((result) => result.metadata?.source !== 'system')
      .map((result) => ({
        source: result.metadata?.relativePath || result.metadata?.source || 'unknown',
        path: result.metadata?.path,
        relativePath: result.metadata?.relativePath,
        snippet: result.metadata?.snippet || result.text?.slice(0, 360) || '',
        score: result._distance
      }))
  }
}
