import { expect, test, type Page } from '@playwright/test'
import {
  activeTab,
  addFile,
  consoleLines,
  content,
  newProject,
  openApp,
  paintedPixels,
  replaceCode,
  shown,
  sketchFrame,
} from './helpers.ts'

const tabs = (page: Page) => page.locator('.tab')
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function openFileSheet(page: Page) {
  await activeTab(page).click()
  await expect(page.getByRole('dialog', { name: await activeTab(page).innerText() })).toBeVisible()
}

async function openOptions(page: Page) {
  await button(page, 'More options').click()
  return page.getByRole('dialog', { name: 'Options' })
}

async function renameProject(page: Page, name: string) {
  await (await openOptions(page)).getByRole('button', { name: 'Rename project' }).click()
  const sheet = page.getByRole('dialog', { name: 'Rename project' })
  await sheet.getByLabel('Project name').fill(name)
  await sheet.getByRole('button', { name: 'Rename' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
}

/** Builds the three-file project from the M4 done-when: JS, TypeScript and JS sharing one scope. */
async function buildThreeFileProject(page: Page) {
  await newProject(page, 'Blank PaperScript')
  await replaceCode(page, "var circle = new Path.Circle(view.center, size() * 10);\ncircle.fillColor = '#7aa2f7';\nconsole.log('sketch ran');\n")
  await addFile(page, 'size.ts')
  await replaceCode(page, 'function size(): number {\n  return 6 as number;\n}\n')
  await addFile(page, 'scale')
  await expect(activeTab(page)).toHaveText('scale.js')
  await replaceCode(page, 'var SCALE = size();\nconsole.log("scale " + SCALE);\n')
  await expect(tabs(page)).toHaveText(['sketch.js', 'size.ts', 'scale.js'])
  await expect(consoleLines(page).filter({ hasText: 'sketch ran' })).toHaveCount(1)
}

test.describe('projects', () => {
  test('the starter project has two files that share one scope', async ({ page }) => {
    await openApp(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ripple')
    await expect(tabs(page)).toHaveText(['ripple.js', 'palette.js'])
    await expect(consoleLines(page).filter({ hasText: 'rings: 6' })).toHaveCount(1)
    expect(await paintedPixels(await sketchFrame(page))).toBeGreaterThan(1000)

    await tabs(page).nth(1).click()
    await expect(activeTab(page)).toHaveText('palette.js')
    await expect(content(page)).toContainText('function palette()')
  })

  test('a three-file project survives a reload and an app restart', async ({ page, context }) => {
    await openApp(page)
    await buildThreeFileProject(page)
    await renameProject(page, 'three files')
    // Reload straight away: the save on pagehide must not wait for the autosave delay.
    await page.reload()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('three files')
    await expect(tabs(page)).toHaveText(['sketch.js', 'size.ts', 'scale.js'])
    await expect(activeTab(page)).toHaveText('scale.js')
    await expect(content(page)).toContainText('var SCALE = size();')
    await expect(consoleLines(page).filter({ hasText: 'scale 6' })).toHaveCount(1)
    await expect(consoleLines(page).filter({ hasText: 'sketch ran' })).toHaveCount(1)

    // An app restart: the page closes and the app opens fresh with the same storage.
    await page.close()
    const again = await context.newPage()
    await again.goto('./')
    await expect(again.getByRole('heading', { level: 1 })).toHaveText('three files')
    await expect(tabs(again)).toHaveText(['sketch.js', 'size.ts', 'scale.js'])
    await tabs(again).nth(1).click()
    await expect(content(again)).toContainText('return 6 as number;')
    await expect(consoleLines(again).filter({ hasText: 'sketch ran' })).toHaveCount(1)
  })

  test('an exported project imports cleanly into a fresh install', async ({ page, browser }, testInfo) => {
    await openApp(page)
    await buildThreeFileProject(page)
    await renameProject(page, 'three files')

    const options = await openOptions(page)
    const downloading = page.waitForEvent('download')
    await options.getByRole('button', { name: 'Export project' }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toBe('three-files.paper-playground.json')
    const path = testInfo.outputPath('export.json')
    await download.saveAs(path)

    // A fresh install: a new browser context has empty storage.
    const fresh = await browser.newContext({ baseURL: testInfo.project.use.baseURL, ...testInfo.project.use })
    const other = await fresh.newPage()
    await openApp(other)
    await expect(other.getByRole('heading', { level: 1 })).toHaveText('ripple')
    await other.getByRole('button', { name: 'Open projects' }).click()
    const choosing = other.waitForEvent('filechooser')
    await other.getByRole('dialog', { name: 'Projects' }).getByRole('button', { name: 'Import' }).click()
    await (await choosing).setFiles(path)

    await expect(other.getByRole('heading', { level: 1 })).toHaveText('three files')
    await expect(other.getByRole('region', { name: 'Preview' })).not.toHaveAttribute('aria-busy', 'true')
    await expect(tabs(other)).toHaveText(['sketch.js', 'size.ts', 'scale.js'])
    await expect(consoleLines(other).filter({ hasText: 'sketch ran' })).toHaveCount(1)
    await expect(consoleLines(other).filter({ hasText: 'scale 6' })).toHaveCount(1)
    expect(await paintedPixels(await sketchFrame(other))).toBeGreaterThan(1000)

    await other.getByRole('button', { name: 'Open projects' }).click()
    const list = other.getByRole('dialog', { name: 'Projects' })
    await expect(list.getByRole('button', { name: 'three files', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(list.getByRole('button', { name: 'ripple', exact: true })).toBeVisible()
    await fresh.close()
  })

  test('a file that is not a project is refused', async ({ page }, testInfo) => {
    await openApp(page)
    const path = testInfo.outputPath('bad.json')
    const fs = await import('node:fs/promises')
    await fs.writeFile(path, '{"hello": "world"}')
    await page.getByRole('button', { name: 'Open projects' }).click()
    const sheet = page.getByRole('dialog', { name: 'Projects' })
    const choosing = page.waitForEvent('filechooser')
    await sheet.getByRole('button', { name: 'Import' }).click()
    await (await choosing).setFiles(path)
    await expect(sheet.getByRole('alert')).toHaveText('That is not a Paper Playground project.')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ripple')
  })

  test('files run in tab order and can be moved, renamed and deleted', async ({ page }) => {
    await openApp(page)
    await newProject(page, 'Blank JavaScript')
    await replaceCode(page, "console.log('one');\n")
    await addFile(page, 'two.js')
    await replaceCode(page, "console.log('two');\n")
    const order = () => consoleLines(page).filter({ hasText: /^(one|two)$/ }).allInnerTexts()
    await expect.poll(order).toEqual(['one', 'two'])

    await openFileSheet(page)
    await page.getByRole('dialog', { name: 'two.js' }).getByRole('button', { name: 'Move earlier' }).click()
    await expect(tabs(page)).toHaveText(['two.js', 'sketch.js'])
    await expect.poll(order).toEqual(['two', 'one'])
    await page.keyboard.press('Escape')

    await openFileSheet(page)
    await page.getByRole('dialog', { name: 'two.js' }).getByRole('button', { name: 'Rename file' }).click()
    const rename = page.getByRole('dialog', { name: 'Rename file' })
    await rename.getByLabel('File name').fill('sketch.js')
    await rename.getByRole('button', { name: 'Rename' }).click()
    await expect(rename.getByRole('alert')).toHaveText('There is already a file called sketch.js.')
    await rename.getByLabel('File name').fill('first.js')
    await rename.getByRole('button', { name: 'Rename' }).click()
    await expect(tabs(page)).toHaveText(['first.js', 'sketch.js'])

    await openFileSheet(page)
    await page.getByRole('dialog', { name: 'first.js' }).getByRole('button', { name: 'Delete file' }).click()
    await page.getByRole('dialog', { name: 'Delete file?' }).getByRole('button', { name: 'Delete' }).click()
    await expect(tabs(page)).toHaveText(['sketch.js'])
    await expect(content(page)).toContainText("console.log('one');")
    await expect.poll(order).toEqual(['one'])

    // The last file cannot be deleted.
    await openFileSheet(page)
    await expect(page.getByRole('dialog', { name: 'sketch.js' }).getByRole('button', { name: 'Delete file' })).toBeDisabled()
  })

  test('each file keeps its own undo history', async ({ page }) => {
    await openApp(page)
    await content(page).click()
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type('// edited ripple')
    await tabs(page).nth(1).click()
    await page.keyboard.press('ControlOrMeta+z')
    await tabs(page).nth(0).click()
    await expect(content(page)).toContainText('// edited ripple')
    await content(page).click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(content(page)).not.toContainText('// edited ripple')
  })

  test('a TypeScript syntax error points at the .ts file and keeps the last good render', async ({ page }) => {
    await openApp(page)
    const first = await shown(page).getAttribute('data-run-id')
    await addFile(page, 'types.ts')
    // Adding the file runs the project once more, cleanly.
    await expect(shown(page)).not.toHaveAttribute('data-run-id', first!)
    const good = await shown(page).getAttribute('data-run-id')
    await replaceCode(page, 'let count: number = ;\n')
    const error = consoleLines(page).filter({ hasText: 'SyntaxError' })
    await expect(error).toHaveCount(1)
    await expect(error.locator('.location')).toHaveText('types.ts:1:21')
    await expect(page.getByRole('status')).toHaveText('Showing the last good run')
    await expect(shown(page)).toHaveAttribute('data-run-id', good!)
  })

  test('projects can be switched, renamed, changed to JavaScript and deleted', async ({ page }) => {
    await openApp(page)
    await newProject(page, 'Ripple')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ripple 2')
    await replaceCode(page, "console.log('second project');\n")
    await expect(consoleLines(page).filter({ hasText: 'second project' })).toHaveCount(1)

    await page.getByRole('button', { name: 'Open projects' }).click()
    await page.getByRole('dialog', { name: 'Projects' }).getByRole('button', { name: 'ripple', exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ripple')
    await expect(consoleLines(page).filter({ hasText: 'rings: 6' })).toHaveCount(1)

    await page.getByRole('button', { name: 'Open projects' }).click()
    await page.getByRole('dialog', { name: 'Projects' }).getByRole('button', { name: 'ripple 2', exact: true }).click()
    await expect(content(page)).toContainText("console.log('second project');")

    const options = await openOptions(page)
    await options.getByRole('button', { name: 'JavaScript', exact: true }).click()
    await expect(page.locator('.title .muted')).toHaveText('JavaScript sketch')
    await page.keyboard.press('Escape')

    await (await openOptions(page)).getByRole('button', { name: 'Delete project' }).click()
    await page.getByRole('dialog', { name: 'Delete project?' }).getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ripple')
    await page.getByRole('button', { name: 'Open projects' }).click()
    await expect(page.getByRole('dialog', { name: 'Projects' }).getByRole('button', { name: /^ripple/ })).toHaveCount(1)
    await expect(page.getByRole('dialog', { name: 'Projects' }).getByRole('button', { name: 'ripple', exact: true })).toBeVisible()
  })
})
