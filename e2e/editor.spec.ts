import { expect, test, type Frame, type Page } from '@playwright/test'

/** The runner iframe on screen; a new run loads hidden (class "pending") until it succeeds. */
const shown = (page: Page) => page.locator('.preview iframe:not(.pending)')
const consoleLines = (page: Page) => page.getByTestId('console').locator('li')
const content = (page: Page) => page.locator('.cm-content')

async function sketchFrame(page: Page): Promise<Frame> {
  const frame = await (await shown(page).elementHandle())?.contentFrame()
  if (!frame) throw new Error('runner iframe not found')
  return frame
}

function alphaAt(frame: Frame, x: number, y: number): Promise<number> {
  return frame.evaluate(
    ([cssX, cssY]) => {
      const canvas = document.querySelector('canvas')!
      const scale = canvas.width / canvas.clientWidth
      return canvas.getContext('2d')!.getImageData(Math.round(cssX * scale), Math.round(cssY * scale), 1, 1).data[3]
    },
    [x, y] as const,
  )
}

function paintedPixels(frame: Frame): Promise<number> {
  return frame.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let painted = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) painted++
    return painted
  })
}

/** Opens the app and waits for the starter sketch's first good run. */
async function openApp(page: Page) {
  await page.goto('./')
  await expect(consoleLines(page).filter({ hasText: /^ran in \d+ ms$/ })).toHaveCount(1)
}

/** Puts the caret on the empty last line of the document. */
async function caretToEnd(page: Page) {
  await content(page).click()
  await page.keyboard.press('ControlOrMeta+End')
}

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
      const box = (await shown(page).boundingBox())!
      // The top-left corner of the preview is clear of the rings.
      const png = await page.screenshot({ clip: { x: box.x + 2, y: box.y + 2, width: 1, height: 1 } })
      const pixel = await page.evaluate(async (src) => {
        const image = new Image()
        image.src = src
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
      }, `data:image/png;base64,${png.toString('base64')}`)
      // --preview-bg: #1f2335 dark, #eef0f6 light.
      expect(pixel).toEqual(scheme === 'dark' ? [31, 35, 53] : [238, 240, 246])
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
    await page.getByRole('button', { name: 'JavaScript', exact: true }).click()
    await expect(content(page)).toContainText('ripple-plain.js · plain JavaScript')
    await expect(content(page)).not.toContainText('ripple.js · PaperScript')
    await expect(page.locator('.title .muted')).toContainText('ripple-plain.js · JavaScript')
  })

  test('editor and preview sit side by side when wide, stacked when narrow', async ({ page }) => {
    await openApp(page)
    const editor = (await page.getByRole('region', { name: 'Editor' }).boundingBox())!
    const preview = (await page.getByRole('region', { name: 'Preview' }).boundingBox())!
    const width = page.viewportSize()!.width
    if (width >= 600) {
      expect(editor.x + editor.width).toBeLessThanOrEqual(preview.x + 1)
      expect(Math.abs(editor.y - preview.y)).toBeLessThan(1)
    } else {
      expect(editor.y + editor.height).toBeLessThanOrEqual(preview.y + 1)
    }
    expect(editor.height).toBeGreaterThan(200)
    expect(preview.height).toBeGreaterThan(150)
  })
})
