import { expect, type Frame, type Page } from '@playwright/test'

/** The runner iframe on screen; a new run loads hidden (class "pending") until it succeeds. */
export const shown = (page: Page) => page.locator('.preview iframe:not(.pending)')
export const consoleLines = (page: Page) => page.getByTestId('console').locator('li')
export const content = (page: Page) => page.locator('.cm-content')
export const isWide = (page: Page) => page.viewportSize()!.width >= 600

export async function sketchFrame(page: Page): Promise<Frame> {
  const frame = await (await shown(page).elementHandle())?.contentFrame()
  if (!frame) throw new Error('runner iframe not found')
  return frame
}

/** Number of canvas pixels that are not fully transparent. */
export function paintedPixels(frame: Frame): Promise<number> {
  return frame.evaluate(() => {
    const canvas = document.querySelector('canvas')!
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    let painted = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) painted++
    return painted
  })
}

/** Alpha of the pixel at CSS coordinates inside the canvas. */
export function alphaAt(frame: Frame, x: number, y: number): Promise<number> {
  return frame.evaluate(
    ([cssX, cssY]) => {
      const canvas = document.querySelector('canvas')!
      const scale = canvas.width / canvas.clientWidth
      return canvas.getContext('2d')!.getImageData(Math.round(cssX * scale), Math.round(cssY * scale), 1, 1).data[3]
    },
    [x, y] as const,
  )
}

/** Waits until no run is loading behind the preview. */
export async function settled(page: Page) {
  await expect(page.getByRole('region', { name: 'Preview' })).not.toHaveAttribute('aria-busy', 'true')
}

/** Opens the app and waits for the starter sketch's first good run. */
export async function openApp(page: Page) {
  await page.goto('./')
  await expect(consoleLines(page).filter({ hasText: /^ran in \d+ ms$/ })).toHaveCount(1)
  await settled(page)
}

/** Creates a project from a template through the Projects sheet. */
export async function newProject(page: Page, template: string) {
  await page.getByRole('button', { name: 'Open projects' }).click()
  await page.getByRole('dialog', { name: 'Projects' }).getByRole('button', { name: 'New project' }).click()
  const sheet = page.getByRole('dialog', { name: 'New project' })
  const heading = page.getByRole('heading', { level: 1 })
  const before = await heading.innerText()
  await sheet.getByRole('button', { name: template, exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(heading).not.toHaveText(before)
  await settled(page)
}

/** The tab of the file shown in the editor. */
export const activeTab = (page: Page) => page.locator('.tab[aria-current="true"]')

/** Adds a file through the New file button and waits for its tab. */
export async function addFile(page: Page, name: string) {
  await page.getByRole('button', { name: 'New file' }).click()
  const sheet = page.getByRole('dialog', { name: 'New file' })
  await sheet.getByLabel('File name').fill(name)
  await sheet.getByRole('button', { name: 'Add' }).click()
  await expect(sheet).toBeHidden()
  await expect(activeTab(page)).toHaveText(/\.[a-z]+$/.test(name) ? name : `${name}.js`)
}

/** Replaces the active file's code. */
export async function replaceCode(page: Page, code: string) {
  await content(page).click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(code)
}

/** The narrow layout's floating preview ignores touches; open it to interact. */
export async function openFullPreview(page: Page) {
  if (isWide(page)) return
  await page.getByRole('button', { name: 'Open full preview' }).click()
  await expect(page.locator('.preview.full')).toBeVisible()
}

/** Puts the caret on the empty last line of the document. */
export async function caretToEnd(page: Page) {
  await content(page).click()
  await page.keyboard.press('ControlOrMeta+End')
}

/** RGB of one composited screen pixel. */
export async function screenPixel(page: Page, x: number, y: number): Promise<number[]> {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } })
  return page.evaluate(async (src) => {
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
}
