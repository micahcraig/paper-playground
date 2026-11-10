import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_PATH = '/paper-playground/'

// Pixel Fold design targets from the UI spec (CSS px).
const fold = {
  ...devices['Desktop Chrome'],
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2.6,
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'folded', use: { ...fold, viewport: { width: 390, height: 844 } } },
    { name: 'unfolded', use: { ...fold, viewport: { width: 840, height: 780 } } },
  ],
  // Test the production build so the Pages base path and service worker are exercised.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
