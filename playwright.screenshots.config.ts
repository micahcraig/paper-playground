import { defineConfig } from '@playwright/test'
import base from './playwright.config.ts'

/** `npm run screenshots`: regenerates the README images in docs/screenshots. */
export default defineConfig({
  ...base,
  testDir: 'scripts/screenshots',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  projects: [{ name: 'screenshots' }],
})
