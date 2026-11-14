import { expect, test, type Page } from '@playwright/test'

/** Font faces the page has finished loading, as "family weight style". */
async function loadedFonts(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => `${face.family.replace(/["']/g, '')} ${face.weight} ${face.style}`)
  })
}

test.describe('installable PWA', () => {
  test('serves a manifest that Android can install from', async ({ page, request }) => {
    await page.goto('./')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBeTruthy()

    const response = await request.get(new URL(href!, page.url()).toString())
    expect(response.ok()).toBe(true)
    const manifest = await response.json()

    expect(manifest.name).toBe('Paper Playground')
    // short_name is the label under the home-screen icon.
    expect(manifest.short_name).toBe('Paper Playground')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/paper-playground/')
    expect(manifest.scope).toBe('/paper-playground/')

    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')

    for (const icon of manifest.icons as { src: string }[]) {
      const iconResponse = await request.get(new URL(icon.src, page.url()).toString())
      expect(iconResponse.ok(), `${icon.src} should load`).toBe(true)
    }
  })

  test('registers a service worker scoped to the app', async ({ page }) => {
    await page.goto('./')
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.scope
    })
    expect(new URL(scope).pathname).toBe('/paper-playground/')
  })

  test('loads offline after the first visit', async ({ page, context }) => {
    await page.goto('./')
    await page.evaluate(() => navigator.serviceWorker.ready)
    // Wait until the service worker controls the page, so precaching has finished.
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 10_000,
    }).catch(async () => {
      await page.reload()
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
    })

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('ripple')
    // The bundled fonts come from the precache too, not a system fallback.
    await expect.poll(() => loadedFonts(page)).toEqual(
      expect.arrayContaining(['Inter 400 normal', 'JetBrains Mono 400 normal']),
    )
    await context.setOffline(false)
  })

  test('renders the UI in Inter and code in JetBrains Mono', async ({ page }) => {
    await page.goto('./')
    await expect(page.locator('.cm-content')).toBeVisible()
    await expect.poll(() => loadedFonts(page)).toEqual(
      expect.arrayContaining([
        'Inter 400 normal',
        'Inter 600 normal',
        'JetBrains Mono 400 normal',
        // The starter sketch has comments, which the editor shows in italic.
        'JetBrains Mono 400 italic',
      ]),
    )
    // Code shows the characters typed: no ligatures (=> stays two glyphs).
    const ligatures = await page.locator('.cm-scroller').evaluate((el) => getComputedStyle(el).fontVariantLigatures)
    expect(ligatures).toBe('none')
  })
})
