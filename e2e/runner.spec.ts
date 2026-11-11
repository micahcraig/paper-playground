import { expect, test } from '@playwright/test'
import { alphaAt, consoleLines, openFullPreview, paintedPixels, pickSample, shown, sketchFrame } from './helpers.ts'

test.describe('runner', () => {
  test('runs the PaperScript sample and forwards its logs', async ({ page }) => {
    await page.goto('./')
    await pickSample(page, 'PaperScript')
    await expect(consoleLines(page).filter({ hasText: 'rings: 6' })).toHaveCount(1)
    await expect(consoleLines(page).filter({ hasText: /^ran in \d+ ms$/ })).toHaveCount(1)
    const frame = await sketchFrame(page)
    await expect.poll(() => paintedPixels(frame)).toBeGreaterThan(1000)
  })

  test('animates PaperScript with onFrame', async ({ page }) => {
    await page.goto('./')
    await pickSample(page, 'PaperScript')
    const frame = await sketchFrame(page)
    await expect.poll(() => paintedPixels(frame)).toBeGreaterThan(1000)
    const snapshot = () => frame.evaluate(() => document.querySelector('canvas')!.toDataURL())
    const first = await snapshot()
    await expect.poll(snapshot).not.toBe(first)
  })

  test('runs the plain JavaScript sample', async ({ page }) => {
    await page.goto('./')
    await pickSample(page, 'JavaScript')
    await expect(consoleLines(page).filter({ hasText: 'rings: 6' })).toHaveCount(1)
    const frame = await sketchFrame(page)
    await expect.poll(() => paintedPixels(frame)).toBeGreaterThan(1000)
  })

  test('Run starts a fresh iframe', async ({ page }) => {
    await page.goto('./')
    await expect(consoleLines(page).filter({ hasText: 'rings: 6' })).toHaveCount(1)
    const before = await shown(page).getAttribute('data-run-id')
    expect(before).toBeTruthy()
    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(shown(page)).not.toHaveAttribute('data-run-id', before!)
    await expect(consoleLines(page).filter({ hasText: 'rings: 6' })).toHaveCount(1)
    await expect(page.locator('.preview iframe')).toHaveCount(1)
  })

  test('sketches run sandboxed in an opaque origin', async ({ page }) => {
    await page.goto('./')
    await expect(shown(page)).toHaveAttribute('sandbox', 'allow-scripts')
    const frame = await sketchFrame(page)
    const access = await frame.evaluate(() => {
      let parentReadable = true
      try {
        void window.parent.document.title
      } catch {
        parentReadable = false
      }
      return { origin: self.origin, parentReadable }
    })
    expect(access).toEqual({ origin: 'null', parentReadable: false })
  })

  test('reports a syntax error with its file, line and column', async ({ page }) => {
    await page.goto('./')
    await pickSample(page, 'Syntax error')
    const error = consoleLines(page).filter({ hasText: 'SyntaxError' })
    await expect(error).toHaveCount(1)
    await expect(error.locator('.location')).toHaveText('typo.js:2:35')
    await expect(consoleLines(page).filter({ hasText: 'never runs' })).toHaveCount(0)
    await expect(consoleLines(page).filter({ hasText: /^ran in/ })).toHaveCount(0)
  })

  test('a tap reaches PaperScript handlers once and errors map to the file', async ({ page }) => {
    await page.goto('./')
    await pickSample(page, 'Runtime error')
    await expect(consoleLines(page).filter({ hasText: 'tap the preview' })).toHaveCount(1)
    await openFullPreview(page)
    const box = (await shown(page).boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    const error = consoleLines(page).filter({ hasText: 'ReferenceError: undefinedScale is not defined' })
    await expect(error).toHaveCount(1)
    await expect(error.locator('.location')).toHaveText('broken.js:7:16')
    // A second tap gives a second error, not two per tap.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(error).toHaveCount(2)
  })

  test('drawing with touch adds a path', async ({ page }) => {
    await page.goto('./')
    await pickSample(page, 'PaperScript')
    const frame = await sketchFrame(page)
    await expect.poll(() => paintedPixels(frame)).toBeGreaterThan(1000)

    await openFullPreview(page)
    // Draw along the top edge, clear of the rings and the orbiting dot.
    const box = (await shown(page).boundingBox())!
    const y = 16
    const fromX = box.width * 0.2
    const toX = box.width * 0.8
    expect(await alphaAt(frame, box.width / 2, y)).toBe(0)

    const cdp = await page.context().newCDPSession(page)
    const point = (x: number) => [{ x: box.x + x, y: box.y + y }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(fromX) })
    for (let step = 1; step <= 10; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(fromX + ((toX - fromX) * step) / 10),
      })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    await expect.poll(() => alphaAt(frame, box.width / 2, y)).toBeGreaterThan(0)
  })

  test('runs sketches offline after one load', async ({ page, context }) => {
    await page.goto('./')
    await page.evaluate(() => navigator.serviceWorker.ready)
    if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) await page.reload()
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

    await context.setOffline(true)
    await page.reload()
    await pickSample(page, 'PaperScript')
    await expect(consoleLines(page).filter({ hasText: 'rings: 6' })).toHaveCount(1)
    const frame = await sketchFrame(page)
    await expect.poll(() => paintedPixels(frame)).toBeGreaterThan(1000)
    await context.setOffline(false)
  })
})
