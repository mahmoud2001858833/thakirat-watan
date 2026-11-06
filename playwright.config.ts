import { defineConfig, devices } from '@playwright/test';

// معرّف ثابت للتشغيل كله (ينتقل للعمّال عبر البيئة)
process.env.E2E_RUN ??= String(Date.now());

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100', locale: 'ar-JO', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
