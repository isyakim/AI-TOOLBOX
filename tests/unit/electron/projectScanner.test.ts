import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanProject } from '../../../electron/main/projectScanner'

const created: string[] = []

afterEach(async () => {
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

async function project(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'ai-toolbox-project-'))
  created.push(path)
  return path
}

describe('scanProject', () => {
  it('respects gitignore, secret names, binary files, and user exclusions', async () => {
    const root = await project()
    await mkdir(join(root, 'src'))
    await mkdir(join(root, 'generated'))
    await writeFile(join(root, '.gitignore'), 'ignored.ts\n')
    await writeFile(join(root, 'src', 'main.ts'), 'export const main = true')
    await writeFile(join(root, 'ignored.ts'), 'ignored')
    await writeFile(join(root, '.env'), 'TOKEN=secret')
    await writeFile(join(root, 'generated', 'file.ts'), 'generated')
    await writeFile(join(root, 'binary.ts'), Buffer.from([0, 1, 2]))

    const result = await scanProject({
      rootPath: root,
      extensions: ['.ts'],
      excludePatterns: ['generated/']
    })

    expect(result.files.map((file) => file.relativePath)).toEqual(['src/main.ts'])
    expect(result.languageStats).toEqual({ TypeScript: 1 })
  })

  it('does not follow a symlink outside the project', async () => {
    const root = await project()
    const outside = await project()
    await writeFile(join(outside, 'secret.ts'), 'export const secret = true')
    await symlink(outside, join(root, 'linked'), 'junction')

    const result = await scanProject({ rootPath: root, extensions: ['.ts'] })

    expect(result.files).toEqual([])
  })
})
