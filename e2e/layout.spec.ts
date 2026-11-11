import { expect, test, type Locator, type Page } from '@playwright/test'
import { caretToEnd, consoleLines, isWide, openApp, shown } from './helpers.ts'

const box = async (locator: Locator) => (await locator.boundingBox())!
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

/** Names of the visible buttons in a container, left to right. */
async function buttonNames(container: Locator): Promise<string[]> {
  const items: { x: number; name: string }[] = []
  for (const item of await container.getByRole('button').all()) {
    const b = await item.boundingBox()
    if (!b) continue
    items.push({ x: b.x, name: (await item.getAttribute('aria-label')) ?? (await item.innerText()).trim() })
  }
  return items.sort((a, b) => a.x - b.x).map((item) => item.name)
}

test.describe('layout', () => {
  test('folded layout matches the mock', async ({ page }) => {
    test.skip(isWide(page), 'folded only')
    await openApp(page)
    const viewport = page.viewportSize()!

    const bar = page.getByRole('banner')
    expect((await box(bar)).height).toBe(56)
    expect(await buttonNames(bar)).toEqual(['Open projects', 'Live', 'Run', 'More options'])
    const run = await box(button(page, 'Run'))
    expect([run.width, run.height]).toEqual([44, 44])

    expect((await box(page.locator('.tab').first())).height).toBe(44)
    await expect(page.locator('.chip')).toHaveCount(0)

    // Floating 152 x 152 preview, 12 px in from the bottom-right of the editor area.
    const editor = await box(page.getByRole('region', { name: 'Editor' }))
    const preview = await box(page.getByRole('region', { name: 'Preview' }))
    expect([preview.width, preview.height]).toEqual([152, 152])
    expect(editor.x + editor.width - (preview.x + preview.width)).toBeCloseTo(12, 0)
    expect(editor.y + editor.height - (preview.y + preview.height)).toBeCloseTo(12, 0)
    await expect(button(page, 'Open full preview')).toBeVisible()

    // Scrolled to the end, the last line sits above the floating preview.
    await page.locator('.cm-scroller').evaluate((el) => el.scrollTo(0, el.scrollHeight))
    const last = await box(page.locator('.cm-line').last())
    expect(last.y + last.height).toBeLessThanOrEqual(preview.y)

    // The scaled-down sketch spans the thumbnail's width.
    expect((await box(shown(page))).width).toBeCloseTo(150, -1)

    const peek = await box(button(page, 'Open console'))
    const strip = await box(page.getByRole('contentinfo', { name: 'Symbol keys' }))
    expect(peek.height).toBe(44)
    expect(strip.height).toBe(60)
    expect(peek.y + peek.height).toBeCloseTo(strip.y, 0)
    expect(strip.y + strip.height).toBeCloseTo(viewport.height, 0)
  })

  test('unfolded layout matches the mock', async ({ page }) => {
    test.skip(!isWide(page), 'unfolded only')
    await openApp(page)
    const viewport = page.viewportSize()!

    const bar = page.getByRole('banner')
    expect((await box(bar)).height).toBe(56)
    expect(await buttonNames(bar)).toEqual(['Open projects', 'Live', 'Toggle console', 'More options', 'Run'])
    await expect(page.locator('.chip')).toHaveText('paper 0.17.0')

    const editor = await box(page.getByRole('region', { name: 'Editor' }))
    const preview = await box(page.getByRole('region', { name: 'Preview' }))
    const consolePanel = await box(page.getByRole('region', { name: 'Console' }))
    expect(editor.width / preview.width).toBeCloseTo(1.15, 1)
    expect(preview.x).toBeGreaterThanOrEqual(editor.x + editor.width - 1)
    expect(consolePanel.height).toBe(132)
    expect(consolePanel.y).toBeCloseTo(preview.y + preview.height, 0)
    expect((await box(page.locator('.preview-toolbar'))).height).toBe(44)
    await expect(button(page, 'Reload sketch')).toBeVisible()
    await expect(button(page, 'Full-screen preview')).toBeVisible()

    const strip = page.getByRole('contentinfo', { name: 'Symbol keys' })
    expect((await box(strip)).height).toBe(60)
    expect((await box(strip)).y + 60).toBeCloseTo(viewport.height, 0)
    const names = await buttonNames(strip)
    expect(names.slice(-2)).toEqual(['Undo', 'Redo'])
    // Undo and Redo are pushed to the right end.
    const redo = await box(button(page, 'Redo'))
    expect(viewport.width - (redo.x + redo.width)).toBeCloseTo(12, 0)
  })

  test('symbol keys type into the editor and keep it focused', async ({ page }) => {
    await openApp(page)
    await caretToEnd(page)
    const lastLine = page.locator('.cm-line').last()

    for (const name of ['Insert {', 'Insert }', 'Move left', 'Insert =>']) await button(page, name).tap()
    await expect(lastLine).toHaveText('{=>}')
    expect(await page.evaluate(() => document.activeElement?.classList.contains('cm-content'))).toBe(true)

    await button(page, 'Move right').tap()
    await button(page, 'Insert ;').tap()
    await expect(lastLine).toHaveText('{=>};')

    await button(page, 'Undo').tap()
    await expect(lastLine).toHaveText('{=>}')
    await button(page, 'Redo').tap()
    await expect(lastLine).toHaveText('{=>};')

    await page.keyboard.press('Enter')
    await button(page, 'Indent').tap()
    await button(page, 'Insert double quote').tap()
    await expect(page.locator('.cm-line').last()).toHaveText('  "')
  })

  test('the caret stays visible when the keyboard shrinks the viewport', async ({ page }) => {
    await openApp(page)
    await caretToEnd(page)
    await page.keyboard.type('// end')
    const size = page.viewportSize()!
    // Chrome resizes the layout viewport for the keyboard (interactive-widget=resizes-content).
    await page.setViewportSize({ width: size.width, height: 420 })

    const strip = page.getByRole('contentinfo', { name: 'Symbol keys' })
    await expect.poll(async () => (await box(strip)).y + 60).toBeLessThanOrEqual(420)
    const scroller = await box(page.locator('.cm-scroller'))
    await expect
      .poll(async () => {
        const line = await box(page.locator('.cm-activeLine'))
        return line.y >= scroller.y && line.y + line.height <= scroller.y + scroller.height
      })
      .toBe(true)
    await expect(page.locator('.cm-activeLine')).toHaveText('// end')
  })

  test('the console drawer opens from the peek bar when folded', async ({ page }) => {
    test.skip(isWide(page), 'folded only')
    await openApp(page)
    const peek = page.getByRole('button', { name: /console/i }).first()
    await expect(peek).toHaveAttribute('aria-expanded', 'false')
    await expect(peek).toContainText(/ran in \d+ ms/)
    await expect(page.getByTestId('console')).toBeHidden()

    await peek.tap()
    await expect(button(page, 'Close console')).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('console')).toBeVisible()
    await expect(consoleLines(page).filter({ hasText: 'rings: 6' })).toBeVisible()

    await button(page, 'Close console').tap()
    await expect(page.getByTestId('console')).toBeHidden()
  })

  test('the console panel can be hidden when unfolded', async ({ page }) => {
    test.skip(!isWide(page), 'unfolded only')
    await openApp(page)
    const toggle = button(page, 'Toggle console')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('console')).toBeVisible()
    const before = (await box(page.getByRole('region', { name: 'Preview' }))).height
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('region', { name: 'Console' })).toBeHidden()
    expect((await box(page.getByRole('region', { name: 'Preview' }))).height).toBeGreaterThan(before + 100)
  })

  test('the full preview keeps the running sketch', async ({ page }) => {
    await openApp(page)
    const runId = await shown(page).getAttribute('data-run-id')
    await (isWide(page) ? button(page, 'Full-screen preview') : button(page, 'Open full preview')).click()

    const viewport = page.viewportSize()!
    const preview = await box(page.getByRole('region', { name: 'Preview' }))
    expect([preview.x, preview.y, preview.width, preview.height]).toEqual([0, 0, viewport.width, viewport.height])
    const frame = await box(shown(page))
    expect(frame.width).toBeCloseTo(viewport.width, 0)
    expect(frame.height).toBeCloseTo(viewport.height - 44, 0)
    await expect(shown(page)).toHaveAttribute('data-run-id', runId!)

    await button(page, 'Close full preview').click()
    await expect(page.locator('.preview.full')).toHaveCount(0)
    await expect(shown(page)).toHaveAttribute('data-run-id', runId!)

    await (isWide(page) ? button(page, 'Full-screen preview') : button(page, 'Open full preview')).click()
    await expect(page.locator('.preview.full')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.preview.full')).toHaveCount(0)
  })

  test('a theme picked in Options wins over the system and is remembered', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await openApp(page)
    await button(page, 'More options').click()
    const sheet = page.getByRole('dialog', { name: 'Options' })
    await expect(sheet.getByRole('button', { name: 'Match system' })).toHaveAttribute('aria-pressed', 'true')
    await sheet.getByRole('button', { name: 'Tokyo Night Day' }).click()
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(225, 226, 231)')
    await expect(page.getByTestId('theme-name')).toHaveText('Tokyo Night Day')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(225, 226, 231)')

    await button(page, 'More options').click()
    await page.getByRole('dialog', { name: 'Options' }).getByRole('button', { name: 'Match system' }).click()
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(26, 27, 38)')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Options' })).toBeHidden()
  })
})
