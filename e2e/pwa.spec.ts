import { expect, test } from '@playwright/test'

test.describe('installable PWA', () => {
  test('serves a manifest that Android can install from', async ({ page, request }) => {
    await page.goto('./')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBeTruthy()

    const response = await request.get(new URL(href!, page.url()).toString())
    expect(response.ok()).toBe(true)
    const manifest = await response.json()

    expect(manifest.name).toBe('Paper Playground')
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
    await expect(page.getByRole('heading', { name: 'Paper Playground' })).toBeVisible()
    await context.setOffline(false)
  })
})
