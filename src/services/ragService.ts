import type {
  ProjectHealthReport,
  ProjectMap,
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
  projectId: string
  lineStart: number
  lineEnd: number
  symbol?: string
  language?: string
  indexedAt: string
}

export interface ProjectIndexOptions {
  projectId: string
  rootPath: string
  extensions: string[]
  excludePatterns?: string[]
  force?: boolean
}

export interface ProviderRAGConfig {
  id: string
}

export function toRAGConfig(config: ProviderRAGConfig): RAGConfigPayload {
  return {
    providerId: config.id
  }
}

export class RAGService {
  static init(config: ProviderRAGConfig) {
    return window.api.ragInit(toRAGConfig(config))
  }

  static query(
    projectId: string,
    query: string,
    config: ProviderRAGConfig,
    limit = 3
  ): Promise<RAGQueryResponse> {
    return window.api.ragQuery({ projectId, query, limit, config: toRAGConfig(config) })
  }

  static indexProject(
    options: ProjectIndexOptions,
    config: ProviderRAGConfig
  ): Promise<RAGIndexStatus> {
    return window.api.ragIndexProject({ ...options, config: toRAGConfig(config) })
  }

  static getIndexStatus(projectId?: string): Promise<RAGIndexStatus> {
    return window.api.ragIndexStatus(projectId)
  }

  static getProjectMap(projectId: string): Promise<{
    success: boolean
    projectMap?: ProjectMap
    message?: string
  }> {
    return window.api.getProjectMap(projectId)
  }

  static runProjectHealthCheck(
    rootPath: string
  ): Promise<{ success: boolean; report?: ProjectHealthReport; message?: string }> {
    return window.api.projectHealthCheck({ rootPath })
  }

  static mapResultsToCitations(results: RAGQueryResult[] = []): RAGCitation[] {
    return results.map((result) => ({
      source: result.relativePath,
      path: result.path,
      relativePath: result.relativePath,
      snippet: result.snippet || result.text?.slice(0, 360) || '',
      score: result.score ?? result._distance,
      projectId: result.projectId,
      lineStart: result.lineStart,
      lineEnd: result.lineEnd,
      symbol: result.symbol,
      language: result.language,
      indexedAt: result.indexedAt
    }))
  }
}
