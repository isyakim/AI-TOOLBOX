import { app } from 'electron'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import type { ProjectMap, WorkspaceProject } from '../../src/shared/types/ipc'

const execFileAsync = promisify(execFile)
const PROJECTS_FILE = 'workspace-projects.json'
const MAPS_FILE = 'project-maps.json'
const INDEX_MANIFEST_FILE = 'project-index-manifest.json'

interface ProjectState {
  projects: WorkspaceProject[]
  activeProjectId: string | null
}

export interface ProjectIndexManifest {
  indexVersion: number
  embeddingModel: string
  files: Record<string, string>
}

function projectsPath(): string {
  return join(app.getPath('userData'), PROJECTS_FILE)
}

function mapsPath(): string {
  return join(app.getPath('userData'), MAPS_FILE)
}

function indexManifestPath(): string {
  return join(app.getPath('userData'), INDEX_MANIFEST_FILE)
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf-8')) as T
  } catch {
    return fallback
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, JSON.stringify(value, null, 2), 'utf-8')
}

export async function listWorkspaceProjects(): Promise<WorkspaceProject[]> {
  return (await readProjectState()).projects
}

export async function getActiveWorkspaceProjectId(): Promise<string | null> {
  return (await readProjectState()).activeProjectId
}

export async function setActiveWorkspaceProject(id: string): Promise<void> {
  const state = await readProjectState()
  if (!state.projects.some((project) => project.id === id))
    throw new Error('Workspace project not found.')
  state.activeProjectId = id
  await writeJson(projectsPath(), state)
}

export async function registerWorkspaceProject(rootPath: string): Promise<WorkspaceProject> {
  const realPath = await fs.realpath(rootPath)
  const stats = await fs.stat(realPath)
  if (!stats.isDirectory()) throw new Error('Workspace project must be a directory.')

  const state = await readProjectState()
  const projects = state.projects
  const id = createHash('sha256').update(realPath).digest('hex').slice(0, 24)
  const existing = projects.find((project) => project.id === id)
  const project: WorkspaceProject = {
    id,
    name: basename(realPath),
    rootPath: realPath,
    branch: await readGitBranch(realPath),
    languageStats: existing?.languageStats || {},
    indexVersion: existing?.indexVersion || 0,
    lastIndexedAt: existing?.lastIndexedAt || null,
    failedFiles: existing?.failedFiles || []
  }
  const next = [...projects.filter((item) => item.id !== id), project]
  await writeJson(projectsPath(), { projects: next, activeProjectId: state.activeProjectId || id })
  return project
}

export async function updateWorkspaceProject(
  id: string,
  updates: Partial<WorkspaceProject>
): Promise<WorkspaceProject> {
  const state = await readProjectState()
  const projects = state.projects
  const index = projects.findIndex((project) => project.id === id)
  if (index < 0) throw new Error('Workspace project not found.')
  projects[index] = { ...projects[index], ...updates, id: projects[index].id }
  await writeJson(projectsPath(), { ...state, projects })
  return projects[index]
}

export async function getWorkspaceProject(id: string): Promise<WorkspaceProject | null> {
  return (await listWorkspaceProjects()).find((project) => project.id === id) || null
}

export async function saveProjectMap(projectMap: ProjectMap): Promise<void> {
  const maps = await readJson<Record<string, ProjectMap>>(mapsPath(), {})
  maps[projectMap.project.id] = projectMap
  await writeJson(mapsPath(), maps)
}

export async function getStoredProjectMap(projectId: string): Promise<ProjectMap | null> {
  const maps = await readJson<Record<string, ProjectMap>>(mapsPath(), {})
  return maps[projectId] || null
}

export async function getProjectIndexManifest(
  projectId: string
): Promise<ProjectIndexManifest | null> {
  const manifests = await readJson<Record<string, ProjectIndexManifest>>(indexManifestPath(), {})
  return manifests[projectId] || null
}

export async function saveProjectIndexManifest(
  projectId: string,
  manifest: ProjectIndexManifest
): Promise<void> {
  const manifests = await readJson<Record<string, ProjectIndexManifest>>(indexManifestPath(), {})
  manifests[projectId] = manifest
  await writeJson(indexManifestPath(), manifests)
}

async function readGitBranch(rootPath: string): Promise<string | null> {
  try {
    const result = await execFileAsync(
      'git',
      ['-C', rootPath, 'rev-parse', '--abbrev-ref', 'HEAD'],
      {
        windowsHide: true,
        timeout: 3000
      }
    )
    return result.stdout.trim() || null
  } catch {
    return null
  }
}

async function readProjectState(): Promise<ProjectState> {
  const value = await readJson<WorkspaceProject[] | ProjectState>(projectsPath(), [])
  if (Array.isArray(value)) return { projects: value, activeProjectId: value[0]?.id || null }
  return {
    projects: Array.isArray(value.projects) ? value.projects : [],
    activeProjectId: typeof value.activeProjectId === 'string' ? value.activeProjectId : null
  }
}
