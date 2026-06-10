import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveWorkspacePath } from '../../../electron/main/workspace'

const created: string[] = []

afterEach(async () => {
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function workspace() {
  const path = await mkdtemp(join(tmpdir(), 'ai-toolbox-workspace-'))
  created.push(path)
  return path
}

describe('resolveWorkspacePath', () => {
  it('allows a relative path inside the workspace', async () => {
    const root = await workspace()
    await mkdir(join(root, 'src'))
    expect(await resolveWorkspacePath(root, 'src/index.ts')).toBe(join(root, 'src', 'index.ts'))
  })

  it('rejects traversal and absolute paths', async () => {
    const root = await workspace()
    await expect(resolveWorkspacePath(root, '../secret.txt')).rejects.toThrow('outside')
    await expect(resolveWorkspacePath(root, join(root, 'file.txt'))).rejects.toThrow('Absolute')
  })

  it('rejects a symlink that escapes the workspace', async () => {
    const root = await workspace()
    const outside = await workspace()
    await writeFile(join(outside, 'secret.txt'), 'secret')
    await symlink(outside, join(root, 'linked'), 'junction')
    await expect(resolveWorkspacePath(root, 'linked/secret.txt')).rejects.toThrow('link')
  })
})
