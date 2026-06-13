import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let application: ElectronApplication
let page: Page
let agentFixturePath: string

test.beforeAll(async () => {
  agentFixturePath = await fs.mkdtemp(join(tmpdir(), 'ai-toolbox-agent-e2e-'))
  await fs.writeFile(join(agentFixturePath, 'target.txt'), 'before\n', 'utf-8')
  await fs.writeFile(
    join(agentFixturePath, 'package.json'),
    JSON.stringify({ scripts: { 'test:fixture': `node -e "console.log('e2e verified')"` } }),
    'utf-8'
  )
  application = await electron.launch({ args: ['.'] })
  page = await application.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  if (application) await application.close()
  if (agentFixturePath) await fs.rm(agentFixturePath, { recursive: true, force: true })
})

test('starts on the chat workbench and accepts local input', async () => {
  await expect(page.locator('.chat-page')).toBeVisible()
  const composer = page.locator('.message-input')
  await composer.fill('1')
  await expect(composer).toHaveValue('1')
  await page.locator('.send-btn').click()
  await expect(page.locator('.message-content.plain-text').last()).toContainText('1')
})

test('navigates to the focused product areas', async () => {
  for (const destination of ['Knowledge', 'Plugins', 'Settings', 'About', 'Chat']) {
    await page.locator('.nav-item').filter({ hasText: destination }).click()
    await expect(page).toHaveURL(new RegExp(`#/${destination.toLowerCase()}`))
  }
})

test('shows the ten built-in developer plugins', async () => {
  await page.locator('.nav-item').filter({ hasText: 'Plugins' }).click()
  await expect(page.locator('.plugin-card')).toHaveCount(10)
  await expect(page.getByText('PR Review', { exact: true })).toBeVisible()
  await expect(page.getByText('Release Notes', { exact: true })).toBeVisible()
})

test('updates chat parameters without leaving the workbench', async () => {
  await page.locator('.nav-item').filter({ hasText: 'Chat' }).click()
  await page.getByRole('button', { name: 'Parameters' }).click()
  const temperature = page.locator('.parameters-panel input[type="range"]').first()
  await temperature.fill('1.2')
  await expect(page.locator('.parameters-panel')).toContainText('1.2')
})

test('saves and deletes a provider configuration', async () => {
  await page.locator('.nav-item').filter({ hasText: 'Settings' }).click()
  await page.getByLabel('Provider').selectOption('ollama')
  await page.getByLabel('Base URL').fill('http://127.0.0.1:11434/v1/')
  await page.getByRole('textbox', { name: 'Model', exact: true }).fill('qwen3:8b')
  await page.getByRole('button', { name: 'Save configuration' }).click()

  await expect(
    page
      .getByText('Existing provider configuration updated.')
      .or(page.getByText('Provider configuration saved.'))
  ).toBeVisible()
  const savedConfiguration = page
    .locator('article')
    .filter({ hasText: 'http://127.0.0.1:11434/v1' })
  await expect(savedConfiguration).toBeVisible()
  await savedConfiguration.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete configuration' }).click()
  await expect(savedConfiguration).toHaveCount(0)
  await expect(
    page.evaluate(() => window.api.getConfig('provider-config'))
  ).resolves.toBeUndefined()
})

test('supports API-key-free Ollama configuration', async () => {
  await page.locator('.nav-item').filter({ hasText: 'Settings' }).click()
  await page.getByLabel('Provider').selectOption('ollama')
  await expect(page.getByLabel(/API key/)).toBeDisabled()
  await expect(page.getByLabel('Base URL')).toHaveValue('http://127.0.0.1:11434/v1')
})

test('exposes project selection and renders typed index status', async () => {
  await page.locator('.nav-item').filter({ hasText: 'Knowledge' }).click()
  await expect(page.getByRole('button', { name: 'Choose folder' })).toBeEnabled()
  await expect(page.getByRole('heading', { name: 'Index status' })).toBeVisible()
  await expect(page.getByText('idle', { exact: true })).toBeVisible()
})

test('exposes the project map as a first-class product area', async () => {
  await page.locator('.nav-item').filter({ hasText: 'Project Map' }).click()
  await expect(page.getByRole('heading', { name: 'Project map', exact: true })).toBeVisible()
  await expect(page.getByText(/Index the active project/)).toBeVisible()
})

test('exposes the approval-gated Agent task workflow', async () => {
  await page.evaluate(async (rootPath) => {
    const project = await window.api.registerWorkspaceProject(rootPath)
    await window.api.setActiveWorkspaceProject(project.id)
  }, agentFixturePath)
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await page.locator('.nav-item').filter({ hasText: 'Agent Tasks' }).click()
  await expect(page.getByRole('heading', { name: 'Agent tasks', exact: true })).toBeVisible()
  await page.getByPlaceholder('Describe the concrete task').fill('Update and verify target.txt')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await page
    .getByPlaceholder('One implementation step per line')
    .fill('Update target.txt\nRun tests')
  await page.getByRole('button', { name: 'Submit plan for approval' }).click()
  await page.getByRole('button', { name: 'Approve plan' }).click()
  await page.getByPlaceholder('Relative file path').fill('target.txt')
  await page.getByPlaceholder('Complete replacement content').fill('after\n')
  await page.getByRole('button', { name: 'Generate Diff preview' }).click()
  await expect(page.getByText('WRITE target.txt')).toBeVisible()
  await page.getByRole('button', { name: 'Approve ChangeSet' }).click()
  await page.getByRole('button', { name: 'Execute approved changes' }).click()
  await expect(page.getByText('Applied 1 file change(s).')).toBeVisible()
  await page.getByRole('button', { name: 'Discover package scripts' }).click()
  await expect(page.getByText('npm run test:fixture')).toBeVisible()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByText(/test:fixture \/ exit 0/)).toBeVisible()
  await expect(fs.readFile(join(agentFixturePath, 'target.txt'), 'utf-8')).resolves.toBe('after\n')
})
