import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4319',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node bin/dream-forge.js start',
    env: { DREAM_FORGE_PORT: '4319', DREAM_FORGE_PERSIST: '0' },
    url: 'http://127.0.0.1:4319/api/health',
    reuseExistingServer: false,
  },
  reporter: 'list',
});
