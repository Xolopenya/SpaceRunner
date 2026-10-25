import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  reporter: process.env.REVIEW_RESULT_DIR ? [['list'], ['json', { outputFile: `${process.env.REVIEW_RESULT_DIR}/browser-results.json` }]] : 'list',
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'structure-variants', testMatch: 'structure-variants.spec.ts', timeout: 90_000 },
    { name: 'large-structure', testMatch: 'large-structure.spec.ts', timeout: 90_000 },
    { name: 'pressure', testMatch: 'pressure.spec.ts', timeout: 90_000 },
    { name: 'runtime', testMatch: 'runtime.spec.ts', timeout: 90_000 },
    { name: 'desktop', testMatch: 'desktop.spec.ts' },
    { name: 'readability', testMatch: 'readability.spec.ts' },
    { name: 'vfx', testMatch: 'vfx.spec.ts' },
    { name: 'audio', testMatch: 'audio.spec.ts' },
    { name: 'touch', testMatch: 'touch.spec.ts', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'production', testMatch: 'production.spec.ts', use: { baseURL: 'http://127.0.0.1:4173' } },
    { name: 'ui', testMatch: 'ui.spec.ts', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
    { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  ],
});
