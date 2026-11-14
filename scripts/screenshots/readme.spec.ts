import { expect, test, type Page } from '@playwright/test'
import { newProject, openApp, settled, shown } from '../../e2e/helpers.ts'

// Pixel Fold sizes from the UI spec, at a scale that keeps the images small.
const UNFOLDED = { width: 840, height: 780 }
const FOLDED = { width: 390, height: 844 }
test.use({ deviceScaleFactor: 2, isMobile: true, hasTouch: true })

const OUT = 'docs/screenshots'

async function drawSquiggle(page: Page) {
  const box = (await shown(page).boundingBox())!
  const x0 = box.x + box.width * 0.2
  const y0 = box.y + box.height * 0.75
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(x0 + i * box.width * 0.015, y0 + Math.sin(i / 4) * box.height * 0.08)
  }
  await page.mouse.up()
}

/** Stops the caret blinking so images are stable. */
async function quiet(page: Page) {
  await page.addStyleTag({ content: '.cm-cursor{display:none!important}' })
}

test('unfolded, dark', async ({ page }) => {
  await page.setViewportSize(UNFOLDED)
  await page.emulateMedia({ colorScheme: 'dark' })
  await openApp(page)
  await drawSquiggle(page)
  await quiet(page)
  await page.screenshot({ path: `${OUT}/unfolded-dark.png` })
})

test('folded, dark', async ({ page }) => {
  await page.setViewportSize(FOLDED)
  await page.emulateMedia({ colorScheme: 'dark' })
  await openApp(page)
  await quiet(page)
  await page.screenshot({ path: `${OUT}/folded-dark.png` })
})

test('unfolded, light, d3', async ({ page }) => {
  await page.setViewportSize(UNFOLDED)
  await page.emulateMedia({ colorScheme: 'light' })
  await openApp(page)
  await newProject(page, 'd3 chart')
  await settled(page)
  await expect(page.locator('.chip')).toContainText('d3')
  await quiet(page)
  await page.screenshot({ path: `${OUT}/unfolded-light-d3.png` })
})
