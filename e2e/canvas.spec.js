import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

function coloredPixels(buffer, left = 50, top = 130, width = 200, height = 320) {
  const png = PNG.sync.read(buffer);
  let count = 0;
  for (let y = top; y < top + height; y++)
    for (let x = left; x < left + width; x++) {
      const i = (y * png.width + x) * 4;
      if (
        png.data[i + 1] > png.data[i] + 3 &&
        png.data[i + 2] > png.data[i] + 5 &&
        png.data[i + 2] > 25
      )
        count++;
    }
  return count;
}
function changedPixels(a, b, left = 350, top = 100, width = 750, height = 580) {
  const first = PNG.sync.read(a),
    second = PNG.sync.read(b);
  let changed = 0;
  for (let y = top; y < top + height; y++)
    for (let x = left; x < left + width; x++) {
      const i = (y * first.width + x) * 4;
      if (Math.abs(first.data[i + 1] - second.data[i + 1]) > 20) changed++;
    }
  return changed;
}

test('particle canvas assembles, updates, focuses, orbits, pauses, and dissolves', async ({
  page,
  request,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await request.post('/api/clear', { data: {} });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Canvas connected');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#title')).toHaveText('A space for your next thought');
  await page.getByRole('combobox', { name: 'Choose a construct' }).selectOption('portal');
  await expect(page.getByRole('button', { name: 'The doorway', exact: true })).toBeVisible();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'test-results/doorway.png' });
  await page.getByRole('combobox', { name: 'Choose a construct' }).selectOption('architecture');
  await expect(page.locator('.label')).toHaveCount(3);
  await expect(page.locator('.edge-label')).toHaveCount(2);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'test-results/architecture.png' });
  await page.getByRole('button', { name: 'Database', exact: true }).click();
  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('Database');
  await expect
    .poll(async () => (await (await request.get('/api/state')).json()).focus)
    .toBe('database');
  await page.getByRole('button', { name: 'Close object details' }).click();
  await expect(page.locator('#detail')).toBeHidden();
  await page.mouse.move(720, 360);
  await page.mouse.down();
  await page.mouse.move(950, 420, { steps: 12 });
  await page.mouse.up();
  await page.mouse.wheel(0, -200);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume motion', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('combobox', { name: 'Choose a construct' }).selectOption('helix');
  await expect(page.getByRole('button', { name: 'Double helix', exact: true })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/helix.png' });
  await page.getByRole('button', { name: 'Resume motion', exact: true }).click();
  await page.reload();
  await expect(page.locator('.label')).toHaveCount(1);
  await page.getByRole('button', { name: 'Dissolve', exact: true }).click();
  await expect(page.locator('.label')).toHaveCount(0);
  await expect(page.locator('#title')).toHaveText('A space for your next thought');
  expect(errors).toEqual([]);
});

test('small viewport and reduced motion remain usable', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await request.post('/api/clear', { data: {} });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Resume motion' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Choose a construct' }).selectOption('portal');
  await expect(page.locator('.label')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/mobile.png' });
  const label = await page.locator('.label').boundingBox(),
    caption = await page.locator('.caption').boundingBox();
  expect(label.y + label.height).toBeLessThan(caption.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Dissolve', exact: true }).click();
  await expect(page.locator('.label')).toHaveCount(0);
});

test('canvas follows window size and refits when resizing or recovering from zoom', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await request.post('/api/clear', { data: {} });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Choose a construct' }).selectOption('portal');
  for (const viewport of [
    { width: 1280, height: 620 },
    { width: 1024, height: 600 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector('canvas').getBoundingClientRect();
          return { width: canvas.width, height: canvas.height };
        }),
      )
      .toEqual(viewport);
    const label = await page.locator('.label').boundingBox();
    const caption = await page.locator('.caption').boundingBox();
    expect(label.y).toBeGreaterThan(0);
    expect(label.x >= caption.x + caption.width || label.y + label.height < caption.y).toBe(true);
    const nav = await page.locator('nav').boundingBox();
    expect(nav.x + nav.width).toBeLessThanOrEqual(viewport.width);
    expect(nav.y + nav.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.mouse.move(640, 230);
  await page.mouse.wheel(0, -1200);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect
    .poll(async () => {
      const label = await page.locator('.label').boundingBox(),
        caption = await page.locator('.caption').boundingBox();
      return (
        label.y > 0 && (label.x >= caption.x + caption.width || label.y + label.height < caption.y)
      );
    })
    .toBe(true);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/laptop-framing.png' });
});

test('richer constructs and custom geometry remain centered with compact controls', async ({
  page,
  request,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const [name, label] of [
    ['tree', 'Branching structure'],
    ['mechanism', 'Drive gear'],
    ['orbits', 'Ringed planet'],
    ['rocket', 'Launch vehicle'],
    ['portal', 'The doorway'],
  ]) {
    await page.getByRole('combobox', { name: 'Choose a construct' }).selectOption(name);
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    const box = await page.locator('nav').boundingBox();
    expect(box.height).toBeLessThan(60);
    if (['tree', 'rocket', 'portal'].includes(name)) {
      const anchor = await page.getByRole('button', { name: label, exact: true }).boundingBox();
      expect(Math.abs(anchor.x + anchor.width / 2 - 720)).toBeLessThan(3);
    }
    await page.waitForTimeout(200);
    await page.screenshot({ path: `test-results/${name}-centered.png` });
  }
  const response = await request.post('/api/scene', {
    data: {
      title: 'Custom construct',
      objects: [
        {
          id: 'custom',
          shape: 'pointcloud',
          label: 'Agent geometry',
          rotation: [0, 0.7, 0],
          points: [
            [-2, -1, 0],
            [2, -1, 0],
            [0, 2, 0],
            [0, 0, 1],
          ],
        },
      ],
    },
  });
  expect(response.ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'Agent geometry' })).toBeVisible();
  await expect(page.locator('#error')).toBeHidden();
  expect(errors).toEqual([]);
});

test('agent camera views, zoom, and orbit work while distant particles stay visible', async ({
  page,
  request,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Choose a construct' }).selectOption('portal');
  await expect(page.getByRole('button', { name: 'The doorway' })).toBeVisible();
  await request.post('/api/camera', { data: { view: 'front', transition: 0 } });
  await page.waitForTimeout(150);
  const front = await page.screenshot();
  await request.post('/api/camera', {
    data: { view: 'right', target_id: 'portal', transition: 0 },
  });
  await page.waitForTimeout(150);
  const side = await page.screenshot({ path: 'test-results/agent-side-view.png' });
  expect(changedPixels(front, side)).toBeGreaterThan(1000);
  // A paused background must still move with the camera, rather than act as wallpaper.
  expect(changedPixels(front, side, 50, 130, 250, 320)).toBeGreaterThan(100);
  await request.post('/api/camera', { data: { view: 'top', zoom: 1.4, transition: 0 } });
  await page.waitForTimeout(150);
  await expect(page.locator('#error')).toBeHidden();
  await page.mouse.move(720, 300);
  const nearField = await page.screenshot();
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(70);
    if (i === 0) {
      const middleField = await page.screenshot({ path: 'test-results/particle-field-middle.png' });
      expect(coloredPixels(middleField)).toBeGreaterThan(80);
      expect(changedPixels(nearField, middleField, 50, 130, 250, 320)).toBeGreaterThan(100);
    }
  }
  const distant = await page.screenshot({ path: 'test-results/extreme-zoom-out.png' });
  expect(coloredPixels(distant)).toBeGreaterThan(80);
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.getByRole('button', { name: 'Resume motion' }).click();
  await request.post('/api/camera', {
    data: { view: 'isometric', auto_rotate: true, speed: 45, transition: 0 },
  });
  await page.waitForTimeout(180);
  const orbitStart = await page.screenshot();
  await page.waitForTimeout(700);
  const orbitEnd = await page.screenshot({ path: 'test-results/agent-orbit.png' });
  expect(changedPixels(orbitStart, orbitEnd)).toBeGreaterThan(1000);
  await request.post('/api/camera', { data: { view: 'front', transition: 0 } });
  await expect(page.locator('#error')).toBeHidden();
  expect(errors).toEqual([]);
});

test('agent-authored buttons and hotspots guide a human through a sequence', async ({
  page,
  request,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Choose a construct' }).selectOption('walkthrough');
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  const side = page.getByRole('button', { name: 'Side view', exact: true });
  await expect(side).toBeVisible();
  const screenButton = await side.boundingBox();
  expect(Math.abs(screenButton.x + screenButton.width / 2 - 1440 * 0.84)).toBeLessThan(2);
  await side.click();
  await expect
    .poll(async () => (await (await request.get('/api/state')).json()).camera.view)
    .toBe('right');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('#title')).toHaveText('1. The body carries the payload');
  await page.getByRole('button', { name: 'Inspect body' }).click();
  await expect
    .poll(async () => (await (await request.get('/api/state')).json()).camera.zoom)
    .toBe(1.5);
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('#title')).toHaveText('2. A tapered nose completes the outline');
  await page.getByRole('button', { name: 'Inspect nose' }).click();
  await expect
    .poll(async () => (await (await request.get('/api/state')).json()).focus)
    .toBe('nose');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.locator('#title')).toHaveText('3. Explore the complete construct');
  await page.getByRole('button', { name: 'Explain the fins' }).click();
  await expect(page.locator('#notice')).toContainText('Please explain the fins');
  await page.screenshot({ path: 'test-results/guided-interactions.png' });
  await page.getByRole('button', { name: 'Start again' }).click();
  await expect(page.locator('#title')).toHaveText('1. The body carries the payload');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Next step' })).toBeVisible();
  const controls = await page.locator('footer').boundingBox();
  expect(controls.y + controls.height).toBeLessThanOrEqual(844);
  await expect(page.locator('#error')).toBeHidden();
  expect(errors).toEqual([]);
});
