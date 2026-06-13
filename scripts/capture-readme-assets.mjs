import { _electron as electron } from '@playwright/test'
import GIFEncoder from 'gif-encoder-2'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const assets = join(root, 'docs', 'assets')
const captureDir = join(root, '.readme-capture')
const fixture = await fs.mkdtemp(join(tmpdir(), 'ai-toolbox-readme-'))
const userData = await fs.mkdtemp(join(tmpdir(), 'ai-toolbox-user-data-'))
await fs.mkdir(assets, { recursive: true })
await fs.rm(captureDir, { recursive: true, force: true })
await fs.mkdir(captureDir, { recursive: true })
await fs.writeFile(join(fixture, 'target.txt'), 'before\n', 'utf-8')
await fs.writeFile(
  join(fixture, 'package.json'),
  JSON.stringify({ scripts: { 'test:fixture': `node -e "console.log('verification passed')"` } }),
  'utf-8'
)

const application = await electron.launch({ args: ['.', `--user-data-dir=${userData}`], cwd: root })
const page = await application.firstWindow()
await page.waitForLoadState('domcontentloaded')

try {
  await page.evaluate(async (rootPath) => {
    const project = await window.api.registerWorkspaceProject(rootPath)
    await window.api.setActiveWorkspaceProject(project.id)
  }, fixture)
  await page.reload()
  await page.locator('.nav-item').filter({ hasText: 'Agent Tasks' }).click()
  await page.getByPlaceholder('Describe the concrete task').fill('Update and verify target.txt')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await page
    .getByPlaceholder('One implementation step per line')
    .fill('Update target.txt\nRun tests')
  await page.getByRole('button', { name: 'Submit plan for approval' }).click()
  await capture(page, '01-plan.png')

  await page.getByRole('button', { name: 'Approve plan' }).click()
  await page.getByPlaceholder('Relative file path').fill('target.txt')
  await page.getByPlaceholder('Complete replacement content').fill('after\n')
  await page.getByRole('button', { name: 'Generate Diff preview' }).click()
  await capture(page, '02-diff.png')

  await page.getByRole('button', { name: 'Approve ChangeSet' }).click()
  await page.getByRole('button', { name: 'Execute approved changes' }).click()
  await page.getByRole('button', { name: 'Discover package scripts' }).click()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await page.getByText(/test:fixture \/ exit 0/).waitFor()
  await capture(page, '03-verified.png')
  await fs.copyFile(join(captureDir, '03-verified.png'), join(assets, 'ai-toolbox-agent.png'))
  await createGif(
    ['01-plan.png', '02-diff.png', '03-verified.png'].map((name) => join(captureDir, name)),
    join(assets, 'ai-toolbox-agent.gif')
  )
} finally {
  await application.close()
  await fs.rm(captureDir, { recursive: true, force: true })
  await fs.rm(fixture, { recursive: true, force: true })
  await fs.rm(userData, { recursive: true, force: true })
}

async function capture(page, name) {
  await page.screenshot({ path: join(captureDir, name) })
}

async function createGif(paths, outputPath) {
  const width = 960
  const height = 640
  const encoder = new GIFEncoder(width, height, 'octree', true, paths.length)
  encoder.setRepeat(0)
  encoder.setDelay(1200)
  encoder.start()
  for (const path of paths) {
    const pixels = await sharp(path)
      .resize(width, height, { fit: 'fill' })
      .ensureAlpha()
      .raw()
      .toBuffer()
    encoder.addFrame(pixels)
  }
  encoder.finish()
  await fs.writeFile(outputPath, encoder.out.getData())
}
