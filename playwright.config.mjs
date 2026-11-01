import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  workers: 2,
  retries: 0,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  outputDir: path.join(os.tmpdir(), 'luquisound-browser-tests'),
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4190',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node scripts/preview-site.mjs --port 4190',
    url: 'http://127.0.0.1:4190/contacto.html',
    reuseExistingServer: false,
    timeout: 10_000,
  },
});
