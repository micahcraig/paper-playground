import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { consoleLines, newProject, openApp, replaceCode, settled, sketchFrame } from './helpers.ts'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

/** Loads once online so the service worker takes control, then goes offline and reloads. */
async function reloadOffline(page: Page, context: BrowserContext) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await settled(page)
}

/** Which library globals exist inside the sketch. */
async function globalsInSketch(page: Page) {
  const frame = await sketchFrame(page)
  return frame.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    return { paper: typeof w.paper, p5: typeof w.p5, THREE: typeof w.THREE, d3: typeof w.d3 }
  })
}

/** Library files the app page fetched. */
const fetchedLibraries = (page: Page) =>
  page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /p5\.min|three\.global|d3\.min|paper-full|acorn/.test(name))
      .map((name) => name.replace(/^.*\/assets\//, '').replace(/-[\w-]{8}\.js$/, '')),
  )

async function openLibraries(page: Page) {
  await button(page, 'More options').click()
  await page.getByRole('dialog', { name: 'Options' }).getByRole('button', { name: /^Choose libraries/ }).click()
  return page.getByRole('dialog', { name: 'Libraries' })
}

test.describe('libraries', () => {
  test('a Paper.js-only project loads no other library', async ({ page }) => {
    await openApp(page)
    expect(await globalsInSketch(page)).toEqual({ paper: 'object', p5: 'undefined', THREE: 'undefined', d3: 'undefined' })
    expect((await fetchedLibraries(page)).sort()).toEqual(['acorn', 'paper-full.min'])
    const srcdoc = (await page.locator('.preview iframe').first().getAttribute('srcdoc'))!
    expect(srcdoc).not.toContain('THREE')
    expect(srcdoc.length).toBeLessThan(700_000)
  })

  test('a p5.js sketch runs offline', async ({ page, context }) => {
    await openApp(page)
    await reloadOffline(page, context)
    await newProject(page, 'p5.js sketch')
    await expect(consoleLines(page).filter({ hasText: /^p5 canvas: \d+ x \d+$/ })).toHaveCount(1)
    await expect(consoleLines(page).filter({ hasText: /Error/ })).toHaveCount(0)
    expect(await globalsInSketch(page)).toEqual({ paper: 'undefined', p5: 'function', THREE: 'undefined', d3: 'undefined' })

    const frame = await sketchFrame(page)
    const painted = () =>
      frame.evaluate(() => {
        const canvas = document.querySelector('canvas')!
        const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
        let count = 0
        for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) count++
        return count
      })
    await expect.poll(painted).toBeGreaterThan(1000)
    expect(await fetchedLibraries(page)).not.toContain('three.global')
    await context.setOffline(false)
  })

  test('a Three.js scene runs offline', async ({ page, context }) => {
    await openApp(page)
    await reloadOffline(page, context)
    await newProject(page, 'Three.js scene')
    await expect(consoleLines(page).filter({ hasText: 'three r186' })).toHaveCount(1)
    await expect(consoleLines(page).filter({ hasText: /Error/ })).toHaveCount(0)
    expect(await globalsInSketch(page)).toEqual({ paper: 'undefined', p5: 'undefined', THREE: 'object', d3: 'undefined' })
    const frame = await sketchFrame(page)
    // The renderer's canvas is in the page with a WebGL context, and frames are being drawn.
    const frames = () =>
      frame.evaluate(() => {
        const canvas = document.querySelector('canvas')
        return canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl')) ? canvas.width : 0
      })
    await expect.poll(frames).toBeGreaterThan(0)
    await context.setOffline(false)
  })

  test('a d3 chart draws its bars', async ({ page }) => {
    await openApp(page)
    await newProject(page, 'd3 chart')
    await expect(consoleLines(page).filter({ hasText: 'bars: 6' })).toHaveCount(1)
    const frame = await sketchFrame(page)
    expect(await frame.locator('svg rect').count()).toBe(6)
    expect(await globalsInSketch(page)).toMatchObject({ paper: 'undefined', d3: 'object' })
  })

  test('the picker adds and removes libraries for the project', async ({ page }) => {
    await openApp(page)
    let sheet = await openLibraries(page)
    const paper = sheet.getByRole('button', { name: 'Paper.js 0.17.0' })
    await expect(paper).toHaveAttribute('aria-pressed', 'true')
    await expect(paper).toBeDisabled()
    await expect(sheet.getByText('Required by PaperScript')).toBeVisible()

    await sheet.getByRole('button', { name: 'd3 7.9.0' }).click()
    await expect(sheet.getByRole('button', { name: 'd3 7.9.0' })).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Escape')
    await settled(page)
    expect(await globalsInSketch(page)).toMatchObject({ paper: 'object', d3: 'object', p5: 'undefined' })
    if (page.viewportSize()!.width >= 600) {
      await expect(page.locator('.chip')).toHaveText('paper 0.17.0 · d3 7.9.0')
    }

    // Plain JavaScript can drop Paper.js; its canvas goes too.
    await button(page, 'More options').click()
    await page.getByRole('dialog', { name: 'Options' }).getByRole('button', { name: 'JavaScript', exact: true }).click()
    await page.keyboard.press('Escape')
    // The ripple is PaperScript code; give it code that runs without Paper.js.
    await replaceCode(page, "console.log('paper is ' + typeof paper);\n")
    sheet = await openLibraries(page)
    await expect(sheet.getByRole('button', { name: 'Paper.js 0.17.0' })).toBeEnabled()
    await sheet.getByRole('button', { name: 'Paper.js 0.17.0' }).click()
    await page.keyboard.press('Escape')
    await settled(page)
    await expect(consoleLines(page).filter({ hasText: 'paper is undefined' })).toHaveCount(1)
    expect(await globalsInSketch(page)).toMatchObject({ paper: 'undefined', d3: 'object' })
    expect(await (await sketchFrame(page)).locator('#canvas').count()).toBe(0)

    // The choice is saved with the project.
    await page.reload()
    await settled(page)
    expect(await globalsInSketch(page)).toMatchObject({ paper: 'undefined', d3: 'object' })
  })
})
