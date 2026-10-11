// Record the shipped UI in a headed browser on a disposable, non-persistent server.
import { chromium } from '@playwright/test';
import { readFile, mkdir, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.js';
import { repositoryRoot } from '../src/skill-install.js';
import { textScene } from '../src/text-scene.js';

const output = join(repositoryRoot, 'docs', 'media');
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), 'dream-forge-recording-'));
const server = await startServer(4322, { persist: false });
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: temporary, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const session = (
    await (
      await fetch(`${base}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Demo recording' }),
      })
    ).json()
  ).session.id;
  const post = async (path, body) => {
    const response = await fetch(`${base}/api/${path}?session=${session}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await response.text());
  };
  const show = async (name) =>
    post(
      'scene',
      JSON.parse(await readFile(join(repositoryRoot, 'examples', `${name}.json`), 'utf8')),
    );
  const shot = async (name) => page.screenshot({ path: join(output, `${name}.png`) });
  await page.goto(`${base}/?session=${session}`);
  await page.waitForTimeout(1800);
  await shot('idle');
  await show('portal');
  await page.waitForTimeout(3200);
  await shot('portal');
  await show('bubble-sort');
  await page.waitForTimeout(3200);
  await shot('bubble-sort');
  for (let i = 0; i < 4; i++) {
    await page.locator('#step-next').click();
    await page.waitForTimeout(2000);
  }
  await page.locator('#step-picker').selectOption('13');
  await page.waitForTimeout(2000);
  await shot('bubble-sorted');
  await show('solar-system');
  await page.waitForTimeout(2800);
  await shot('solar-system');
  await page.getByRole('button', { name: 'Sun', exact: true }).click();
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: 'Close object details' }).click();
  await show('aws-eks');
  await page.waitForTimeout(2800);
  await page.locator('#step-picker').selectOption('1');
  await page.waitForTimeout(2200);
  await shot('aws-eks');
  await page.getByRole('button', { name: 'App pod A', exact: true }).click();
  await page.waitForTimeout(1800);
  await shot('inspection');
  await page.getByRole('button', { name: 'Close object details' }).click();
  await page.locator('#step-next').click();
  await page.waitForTimeout(2200);
  if (errors.length) throw new Error(errors.join('\n'));
  const video = page.video();
  await context.close();
  await rm(join(output, 'demo.webm'), { force: true });
  await copyFile(await video.path(), join(output, 'demo.webm'));
  const alphabetContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const alphabetPage = await alphabetContext.newPage();
  await post('scene', textScene('ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
  await alphabetPage.goto(`${base}/?session=${session}`);
  await alphabetPage.waitForTimeout(2500);
  await alphabetPage.screenshot({ path: join(output, 'alphabet.png') });
  await alphabetContext.close();
  console.log(`Captured screenshots and demo.webm in ${output}; no browser errors.`);
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
