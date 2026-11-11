import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/viewer.spec.mjs',
  workers: 1,
  timeout: 60000,
  outputDir: './test-results',
  reporter: [['list'], ['json', { outputFile: './test-results/browser-results.json' }]],
  use: {
    browserName: 'chromium',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
  },
});
