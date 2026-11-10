import { expect, test } from '@playwright/test'

test.describe('app shell', () => {
  test('shows the app name', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'Paper Playground' })).toBeVisible()
  })

  test('uses Tokyo Night when the system is dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('./')
    await expect(page.getByTestId('theme-name')).toHaveText('Tokyo Night')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(26, 27, 38)')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#16161e')
  })

  test('uses Tokyo Night Day when the system is light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('./')
    await expect(page.getByTestId('theme-name')).toHaveText('Tokyo Night Day')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(225, 226, 231)')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#d0d5e3')
  })

  test('follows a system theme change without a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('./')
    await expect(page.getByTestId('theme-name')).toHaveText('Tokyo Night')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.getByTestId('theme-name')).toHaveText('Tokyo Night Day')
  })

  test('a data-theme override wins over the system setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('./')
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark'
    })
    await expect(page.getByTestId('theme-name')).toHaveText('Tokyo Night')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(26, 27, 38)')
  })

  test('has no horizontal scroll', async ({ page }) => {
    await page.goto('./')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('every button is at least 44 x 44 px and has an accessible name', async ({ page }) => {
    await page.goto('./')
    for (const button of await page.getByRole('button').all()) {
      const box = await button.boundingBox()
      expect(box, 'button should be rendered').not.toBeNull()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
      const name = (await button.getAttribute('aria-label')) ?? (await button.innerText())
      expect(name.trim(), 'button needs an accessible name').not.toBe('')
    }
  })
})
