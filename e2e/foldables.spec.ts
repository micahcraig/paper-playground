import { expect, test, type Locator, type Page } from '@playwright/test'
import { openApp, paintedPixels, settled, shown, sketchFrame } from './helpers.ts'

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

  test('half-open like a book, the editor and preview split at the hinge', async ({ page }) => {
    await openApp(page)
    const runId = await shown(page).getAttribute('data-run-id')
    await emulateFold(page, 840, 780, { orientation: 'vertical', offset: 420, maskLength: 0 })
    await expect(page.locator('.app.fold-book')).toBeVisible()

    const editor = await box(page.getByRole('region', { name: 'Editor' }))
    const preview = await box(page.getByRole('region', { name: 'Preview' }))
    expect(editor.x + editor.width).toBeLessThanOrEqual(420.5)
    expect(preview.x).toBeGreaterThanOrEqual(419.5)
    expect(await paintedPixels(await sketchFrame(page))).toBeGreaterThan(1000)

    // Laying it flat restores the usual split without reloading the sketch.
    await emulateFold(page, 840, 780, null)
    await expect(page.locator('.app.fold-book')).toHaveCount(0)
    await expect(shown(page)).toHaveAttribute('data-run-id', runId!)
  })

  test('half-folded like a laptop, the preview fills the top half and the editor the bottom', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await openApp(page)
    const runId = await shown(page).getAttribute('data-run-id')
    await emulateFold(page, 412, 915, { orientation: 'horizontal', offset: 450, maskLength: 16 })
    await expect(page.locator('.app.fold-tabletop')).toBeVisible()
    await settled(page)

    const bar = await box(page.locator('.bar'))
    const preview = await box(page.getByRole('region', { name: 'Preview' }))
    const tabs = await box(page.locator('.tabs'))
    const editor = await box(page.getByRole('region', { name: 'Editor' }))
    expect(bar.y).toBe(0)
    expect(preview.y).toBeCloseTo(bar.height, 0)
    expect(preview.width).toBeCloseTo(412, 0)
    expect(preview.y + preview.height).toBeLessThanOrEqual(450.5)
    expect(tabs.y).toBeGreaterThanOrEqual(465.5)
    expect(editor.y).toBeGreaterThan(tabs.y)
    await expect(page.getByRole('button', { name: 'Open full preview' })).toBeHidden()

    // The docked sketch fills the preview and is drawn at its real size, not scaled.
    const frame = await box(shown(page))
    expect(frame.width).toBeCloseTo(412, 0)
    expect(await paintedPixels(await sketchFrame(page))).toBeGreaterThan(1000)

    await emulateFold(page, 412, 915, null)
    await expect(page.locator('.app.fold-tabletop')).toHaveCount(0)
    const thumb = await box(page.getByRole('region', { name: 'Preview' }))
    expect(thumb.width).toBe(161)
    await expect(shown(page)).toHaveAttribute('data-run-id', runId!)
  })

  test('tabletop on a wide screen keeps the wide controls', async ({ page }) => {
    await openApp(page)
    await emulateFold(page, 840, 780, { orientation: 'horizontal', offset: 390, maskLength: 0 })
    await expect(page.locator('.app.wide.fold-tabletop')).toBeVisible()
    const preview = await box(page.getByRole('region', { name: 'Preview' }))
    const editor = await box(page.getByRole('region', { name: 'Editor' }))
    expect(preview.y + preview.height).toBeLessThanOrEqual(390.5)
    expect(editor.y).toBeGreaterThanOrEqual(389.5)
    expect(editor.width).toBeCloseTo(840, 0)
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()
  })
})

async function box(locator: Locator) {
  const rect = await locator.boundingBox()
  if (!rect) throw new Error('element not rendered')
  return rect
}

/**
 * Emulates a hinge (or removes it with null) through Chrome's device metrics
 * override, which drives window.viewport.segments and the segment media
 * queries. Device Posture is not available in desktop Chromium.
 */
async function emulateFold(
  page: Page,
  width: number,
  height: number,
  displayFeature: { orientation: 'vertical' | 'horizontal'; offset: number; maskLength: number } | null,
) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2.6,
    mobile: true,
    ...(displayFeature ? { displayFeature } : {}),
  })
}
