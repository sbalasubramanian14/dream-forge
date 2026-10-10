// Explicitly headed preview for local visual review; no agent credentials needed.
import { chromium } from '@playwright/test';
import { startServer } from '../src/server.js';
import { getPort, request, canvasUrl } from '../src/client.js';
let server;
try {
  server = await startServer(getPort());
} catch (error) {
  if (error.code !== 'EADDRINUSE' || (await request('health')).app !== 'dream-forge') throw error;
}
const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
const page = await browser.newPage({ viewport: null });
await page.goto(canvasUrl());
console.log('Dream Forge preview is open. Close the browser when finished.');
await new Promise((resolve) => browser.on('disconnected', resolve));
server?.closeAllConnections();
server?.close();
