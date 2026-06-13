import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type {
  AgentTask,
  ChangeSet,
  CommandProposal,
  VerificationResult
} from '../../src/shared/types/ipc'

const STORE_FILE = 'agent-execution.json'

export interface AgentStore {
  tasks: AgentTask[]
  changeSets: ChangeSet[]
  proposals: CommandProposal[]
  results: VerificationResult[]
}

const emptyStore = (): AgentStore => ({ tasks: [], changeSets: [], proposals: [], results: [] })

function storePath(): string {
  return join(app.getPath('userData'), STORE_FILE)
}

export async function readAgentStore(): Promise<AgentStore> {
  try {
    const value = JSON.parse(await fs.readFile(storePath(), 'utf-8')) as Partial<AgentStore>
    return {
      tasks: Array.isArray(value.tasks) ? value.tasks : [],
      changeSets: Array.isArray(value.changeSets) ? value.changeSets : [],
      proposals: Array.isArray(value.proposals) ? value.proposals : [],
      results: Array.isArray(value.results) ? value.results : []
    }
  } catch {
    return emptyStore()
  }
}

export async function writeAgentStore(store: AgentStore): Promise<void> {
  const path = storePath()
  const tempPath = `${path}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(tempPath, JSON.stringify(store, null, 2), 'utf-8')
  await fs.rename(tempPath, path)
}
