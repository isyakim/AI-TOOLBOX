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
