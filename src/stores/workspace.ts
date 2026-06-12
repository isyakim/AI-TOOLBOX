import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ProjectMap, WorkspaceProject } from '@/shared/types/ipc'

export const useWorkspaceStore = defineStore('workspace', () => {
  const projects = ref<WorkspaceProject[]>([])
  const activeProjectId = ref<string | null>(null)
  const projectMap = ref<ProjectMap | null>(null)

  const activeProject = computed(
    () => projects.value.find((project) => project.id === activeProjectId.value) || null
  )

  async function load(): Promise<void> {
    projects.value = await window.api.listWorkspaceProjects()
    const storedId = await window.api.getActiveWorkspaceProjectId()
    activeProjectId.value = projects.value.some((project) => project.id === storedId)
      ? storedId
      : projects.value[0]?.id || null
    await loadProjectMap()
  }

  async function register(rootPath: string): Promise<WorkspaceProject> {
    const project = await window.api.registerWorkspaceProject(rootPath)
    projects.value = [...projects.value.filter((item) => item.id !== project.id), project]
    await setActive(project.id)
    return project
  }

  async function setActive(projectId: string): Promise<void> {
    await window.api.setActiveWorkspaceProject(projectId)
    activeProjectId.value = projectId
    await loadProjectMap()
  }

  async function refresh(): Promise<void> {
    const activeId = activeProjectId.value
    projects.value = await window.api.listWorkspaceProjects()
    activeProjectId.value = projects.value.some((project) => project.id === activeId)
      ? activeId
      : projects.value[0]?.id || null
    await loadProjectMap()
  }

  async function loadProjectMap(): Promise<void> {
    if (!activeProjectId.value) {
      projectMap.value = null
      return
    }
    const result = await window.api.getProjectMap(activeProjectId.value)
    projectMap.value = result.success ? result.projectMap || null : null
  }

  return {
    projects,
    activeProjectId,
    projectMap,
    activeProject,
    load,
    register,
    setActive,
    refresh,
    loadProjectMap
  }
})
