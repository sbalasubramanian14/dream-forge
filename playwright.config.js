import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000,
  use: {baseURL:'http://127.0.0.1:4317', viewport:{width:1440,height:900}, screenshot:'only-on-failure'},
  webServer: {command:'npm start',url:'http://127.0.0.1:4317/api/health',reuseExistingServer:!process.env.CI},
  reporter:'list'
});
