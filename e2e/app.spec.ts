import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'

let application: ElectronApplication
let page: Page

test.beforeAll(async () => {
  application = await electron.launch({ args: ['.'] })
  page = await application.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await application.close()
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
  await page.getByLabel('Base URL').fill('https://api.example.com/v1/')
  await page.getByLabel('API key').fill('e2e-placeholder-key')
  await page.getByRole('button', { name: 'Save configuration' }).click()

  await expect(
    page
      .getByText('Existing provider configuration updated.')
      .or(page.getByText('Provider configuration saved.'))
  ).toBeVisible()
  const savedConfiguration = page
    .locator('article')
    .filter({ hasText: 'https://api.example.com/v1' })
  await expect(savedConfiguration).toBeVisible()
  await savedConfiguration.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete configuration' }).click()
  await expect(savedConfiguration).toHaveCount(0)
})

test('exposes project selection and renders typed index status', async () => {
  await page.locator('.nav-item').filter({ hasText: 'Knowledge' }).click()
  await expect(page.getByRole('button', { name: 'Choose folder' })).toBeEnabled()
  await expect(page.getByRole('heading', { name: 'Index status' })).toBeVisible()
  await expect(page.getByText('idle', { exact: true })).toBeVisible()
})
