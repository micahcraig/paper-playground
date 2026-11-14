import { expect, test } from '@playwright/test'
import { openApp, paintedPixels, sketchFrame } from './helpers.ts'

/**
 * Screens other than the Pixel Fold, in CSS px. These are approximate and not
 * checked on real devices; the Pixel Fold sizes are the main projects.
 */
export const OTHER_FOLDABLES = [
  { name: 'narrow cover (Galaxy Z Fold cover)', width: 344, height: 882 },
  { name: 'tall flip (Galaxy Z Flip, Razr)', width: 412, height: 915 },
  { name: 'large inner (Galaxy Z Fold 7)', width: 984, height: 1092 },
  { name: 'short landscape (folded phone sideways)', width: 844, height: 390 },
  // Estimated from the reported panel resolutions at 3x; Apple publishes no CSS sizes.
  { name: 'iPhone Fold, folded (estimate)', width: 466, height: 678 },
  { name: 'iPhone Fold, unfolded (estimate)', width: 890, height: 626 },
] as const

test.describe('other foldables', () => {
  // The viewport is set per test, so one project is enough.
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'unfolded', 'runs once, in the unfolded project')
  })

  for (const size of OTHER_FOLDABLES) {
    test(`${size.name}: ${size.width} x ${size.height} fits, with usable buttons and a running sketch`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height })
      await openApp(page)

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, 'no sideways scrolling').toBeLessThanOrEqual(0)

      for (const button of await page.getByRole('button').all()) {
        if (!(await button.isVisible())) continue
        const box = (await button.boundingBox())!
        // The symbol strip scrolls sideways, so keys past the edge are fine; others must fit.
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
        const name = (await button.getAttribute('aria-label')) ?? (await button.innerText())
        expect(name.trim(), 'button needs an accessible name').not.toBe('')
      }
      const bar = await page.locator('.bar').boundingBox()
      for (const button of await page.locator('.bar button').all()) {
        const box = (await button.boundingBox())!
        expect(box.x + box.width, 'top bar buttons stay on screen').toBeLessThanOrEqual(bar!.x + bar!.width + 0.5)
      }

      expect(await paintedPixels(await sketchFrame(page))).toBeGreaterThan(1000)
    })
  }

  test('a narrow cover screen shows the Live dot alone, still named Live', async ({ page }) => {
    await page.setViewportSize({ width: 344, height: 882 })
    await openApp(page)
    const live = page.getByRole('button', { name: 'Live' })
    await expect(live).toBeVisible()
    await expect(live.locator('.live-label')).toBeHidden()
  })

  test('the floating preview grows on wider narrow screens', async ({ page }) => {
    await page.setViewportSize({ width: 466, height: 678 })
    await openApp(page)
    const preview = (await page.getByRole('region', { name: 'Preview' }).boundingBox())!
    expect([preview.width, preview.height]).toEqual([182, 182])
  })

  test('a short screen starts with the console hidden, and it can still be shown', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await openApp(page)
    const toggle = page.getByRole('button', { name: 'Toggle console' })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('console')).toBeHidden()
    await toggle.click()
    await expect(page.getByTestId('console')).toBeVisible()
  })

  test('a large inner screen uses larger code type and an even split', async ({ page }) => {
    await page.setViewportSize({ width: 984, height: 1092 })
    await openApp(page)
    await expect(page.locator('.cm-scroller')).toHaveCSS('font-size', '16px')
    const editor = (await page.getByRole('region', { name: 'Editor' }).boundingBox())!
    const preview = (await page.getByRole('region', { name: 'Preview' }).boundingBox())!
    expect(Math.abs(editor.width - preview.width)).toBeLessThanOrEqual(2)
  })
})
