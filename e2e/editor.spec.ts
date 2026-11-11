import { expect, test } from '@playwright/test'
import {
  alphaAt,
  caretToEnd,
  consoleLines,
  content,
  openApp,
  openFullPreview,
  paintedPixels,
  pickSample,
  screenPixel,
  shown,
  sketchFrame,
} from './helpers.ts'

test.describe('editor', () => {
  test('shows the sketch with autocorrect and suggestions off', async ({ page }) => {
    await openApp(page)
    await expect(content(page)).toContainText('ripple.js · PaperScript')
    await expect(content(page)).toHaveAttribute('contenteditable', 'true')
    await expect(content(page)).toHaveAttribute('autocorrect', 'off')
    await expect(content(page)).toHaveAttribute('autocapitalize', 'off')
    await expect(content(page)).toHaveAttribute('spellcheck', 'false')
    await expect(content(page)).toHaveAttribute('writingsuggestions', 'false')
    await expect(page.getByRole('textbox', { name: 'Code editor' })).toBeVisible()
  })

  test('colours come from the theme tokens', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await openApp(page)
    const comment = page.locator('.cm-line').first().locator('span').first()
    await expect(comment).toHaveCSS('color', 'rgb(128, 137, 179)')
    await expect(comment).toHaveCSS('font-style', 'italic')
    await expect(page.locator('.cm-editor')).toHaveCSS('background-color', 'rgb(26, 27, 38)')

    await page.emulateMedia({ colorScheme: 'light' })
    await expect(comment).toHaveCSS('color', 'rgb(68, 85, 143)')
    await expect(page.locator('.cm-editor')).toHaveCSS('background-color', 'rgb(225, 226, 231)')
  })

  for (const scheme of ['dark', 'light'] as const) {
    test(`the preview background shows through the sketch (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await openApp(page)
      await openFullPreview(page)
      const box = (await shown(page).boundingBox())!
      // The top-left corner of the preview is clear of the rings.
      // --preview-bg: #1f2335 dark, #eef0f6 light.
      expect(await screenPixel(page, box.x + 2, box.y + 2)).toEqual(scheme === 'dark' ? [31, 35, 53] : [238, 240, 246])
    })
  }

  test('a typed change re-runs and renders', async ({ page }) => {
    await openApp(page)
    const before = await shown(page).getAttribute('data-run-id')
    expect(await alphaAt(await sketchFrame(page), 20, 20)).toBe(0)

    await caretToEnd(page)
    await page.keyboard.type("new Path.Circle({ center: [20, 20], radius: 10, fillColor: 'red' });")
    const typedAt = Date.now()

    await expect(shown(page)).not.toHaveAttribute('data-run-id', before!)
    const frame = await sketchFrame(page)
    await expect.poll(() => alphaAt(frame, 20, 20)).toBeGreaterThan(0)
    // 250 ms debounce plus the run; generous for CI, the device target is 500 ms.
    expect(Date.now() - typedAt).toBeLessThan(3000)
    await expect(consoleLines(page).filter({ hasText: 'rings: 6' })).toHaveCount(1)
  })

  test('a syntax error keeps the last good render', async ({ page }) => {
    await openApp(page)
    const good = await shown(page).getAttribute('data-run-id')

    await caretToEnd(page)
    await page.keyboard.type('var broken = (;')
    const error = consoleLines(page).filter({ hasText: 'SyntaxError' })
    await expect(error).toHaveCount(1)
    // The caret is on the empty last line, 43; the ";" is column 15.
    await expect(error).toContainText('SyntaxError: Unexpected token')
    await expect(error.locator('.text')).not.toContainText('paperscript-sketch')
    await expect(error.locator('.location')).toHaveText('ripple.js:43:15')

    await expect(page.getByRole('status')).toHaveText('Showing the last good run')
    await expect(page.locator('.preview iframe')).toHaveCount(1)
    await expect(shown(page)).toHaveAttribute('data-run-id', good!)
    expect(await paintedPixels(await sketchFrame(page))).toBeGreaterThan(1000)

    // Fixing the code brings the preview back to life.
    await page.keyboard.press('Shift+Home')
    await page.keyboard.press('Backspace')
    await expect(shown(page)).not.toHaveAttribute('data-run-id', good!)
    await expect(page.getByRole('status')).toHaveCount(0)
    await expect(consoleLines(page).filter({ hasText: 'SyntaxError' })).toHaveCount(0)
  })

  test('with Live off, edits wait for Run', async ({ page }) => {
    await openApp(page)
    const live = page.getByRole('button', { name: 'Live', exact: true })
    await expect(live).toHaveAttribute('aria-pressed', 'true')
    await live.click()
    await expect(live).toHaveAttribute('aria-pressed', 'false')

    await caretToEnd(page)
    await page.keyboard.type("console.log('later');")
    await page.waitForTimeout(800)
    await expect(consoleLines(page).filter({ hasText: 'later' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Run', exact: true }).click()
    await expect(consoleLines(page).filter({ hasText: 'later' })).toHaveCount(1)
  })

  test('IME composition commits text once', async ({ page }) => {
    await openApp(page)
    await caretToEnd(page)
    const cdp = await page.context().newCDPSession(page)
    for (const partial of ['c', 'co', 'con', 'cons']) {
      await cdp.send('Input.imeSetComposition', { text: partial, selectionStart: partial.length, selectionEnd: partial.length })
    }
    await cdp.send('Input.insertText', { text: 'console' })
    await page.keyboard.type(".log('composed');")

    await expect(consoleLines(page).filter({ hasText: 'composed' })).toHaveCount(1)
    const lastLine = await page.locator('.cm-line').last().textContent()
    expect(lastLine).toBe("console.log('composed');")
  })

  test('loading a sample replaces the code', async ({ page }) => {
    await openApp(page)
    await pickSample(page, 'JavaScript')
    await expect(content(page)).toContainText('ripple-plain.js · plain JavaScript')
    await expect(content(page)).not.toContainText('ripple.js · PaperScript')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ripple-plain')
    await expect(page.locator('.title .muted')).toHaveText('JavaScript sketch')
    await expect(page.locator('.tab')).toHaveText('ripple-plain.js')
  })
})
