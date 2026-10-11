import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

async function loadExample(page, name) {
  const scene = await (await page.request.get('/examples/' + name + '.json')).json();
  await page.request.post('/api/scene', { data: scene });
}

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
function changedPixels(a, b, left = 350, top = 100, width = 750, height = 580, threshold = 20) {
  const first = PNG.sync.read(a),
    second = PNG.sync.read(b);
  let changed = 0;
  for (let y = top; y < top + height; y++)
    for (let x = left; x < left + width; x++) {
      const i = (y * first.width + x) * 4;
      if (Math.abs(first.data[i + 1] - second.data[i + 1]) > threshold) changed++;
    }
  return changed;
}

async function assertClearAnnotations(page, expected) {
  await expect(page.locator('.label:visible')).toHaveCount(expected);
  const items = await page.locator('.annotation:visible').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        anchorX: Number(element.dataset.anchorX),
        anchorY: Number(element.dataset.anchorY),
      };
    }),
  );
  for (const item of items) {
    // The label must not cover its own attachment point.
    expect(
      item.anchorX < item.left ||
        item.anchorX > item.right ||
        item.anchorY < item.top ||
        item.anchorY > item.bottom,
    ).toBe(true);
  }
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i],
        b = items[j];
      expect(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top).toBe(
        false,
      );
    }
}

test('conversation canvases start empty, isolate updates, and keep restorable redraw history', async ({
  page,
  context,
  request,
}) => {
  const create = async (name) =>
    (await (await request.post('/api/sessions', { data: { name } })).json()).session.id;
  const firstId = await create('Claude session');
  const secondId = await create('Codex session');
  const second = await context.newPage();
  await page.goto(`/?session=${firstId}`);
  await second.goto(`/?session=${secondId}`);
  for (const tab of [page, second]) {
    await expect(tab.locator('#title')).toHaveText('A space for your next thought');
    await expect(tab.locator('.label')).toHaveCount(0);
    await expect(tab.locator('#history-toggle')).toHaveText('History (0)');
  }
  const firstScene = {
    title: 'Initial construct',
    objects: [{ id: 'part', shape: 'sphere', label: 'First part' }],
    assembly: { mode: 'morph', duration: 0.4 },
  };
  await request.post(`/api/scene?session=${firstId}`, { data: firstScene });
  await expect(page.locator('#title')).toHaveText('Initial construct');
  await expect(second.locator('#title')).toHaveText('A space for your next thought');
  const redraw = {
    title: 'Rebuilt construct',
    objects: [{ id: 'part', shape: 'gear', label: 'New part' }],
    assembly: { mode: 'dissolve', duration: 2 },
  };
  await page.waitForTimeout(450);
  await request.post(`/api/scene?session=${firstId}`, { data: redraw });
  await page.bringToFront();
  await expect(page.locator('canvas')).toHaveAttribute('data-assembly', 'dissolving');
  await expect(page.locator('canvas')).toHaveAttribute('data-assembly', 'reforming');
  await expect(page.locator('canvas')).toHaveAttribute('data-assembly', 'settled');
  // An identical redraw must still animate rather than being skipped as unchanged geometry.
  await request.post(`/api/scene?session=${firstId}`, { data: redraw });
  await expect(page.locator('canvas')).toHaveAttribute('data-assembly', 'dissolving');
  await expect(page.locator('#history-toggle')).toHaveText('History (3)');
  await page.locator('#history-toggle').click();
  await page.getByRole('button', { name: 'Initial construct', exact: true }).click();
  await expect(page.locator('#title')).toHaveText('Initial construct');
  await expect(page.locator('#history-list button')).toHaveCount(3);
  await expect(page.locator('#session-list a')).toHaveCount(3); // local + the two conversations
  await expect(second.locator('.label')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveAttribute('data-assembly', 'settled');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/session-history.png' });
  await second.screenshot({ path: 'test-results/fresh-session.png' });
  await page.reload();
  await expect(page.locator('#title')).toHaveText('Initial construct');
  await expect(page.locator('#history-toggle')).toHaveText('History (3)');
  await second.close();
});

test('adaptive annotations keep solar and dense engineering overviews clear', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await loadExample(page, 'solar-system');
  await page.waitForTimeout(180);
  await assertClearAnnotations(page, 10);
  await page.screenshot({ path: 'test-results/solar-adaptive-labels.png' });
  const objects = Array.from({ length: 24 }, (_, i) => ({
    id: `module-${i}`,
    shape: 'box',
    label: `Engineering module ${i + 1}`,
    scale: 0.16,
    position: [((i % 6) - 2.5) * 0.7, (Math.floor(i / 6) - 1.5) * 0.7, 0],
  }));
  expect(
    (
      await request.post('/api/scene', {
        data: {
          title: 'Dense engineering overview',
          objects,
          camera: { zoom: 0.1, transition: 0 },
        },
      })
    ).ok(),
  ).toBe(true);
  await page.waitForTimeout(180);
  await assertClearAnnotations(page, 24);
  expect(await page.locator('.label.is-compact:visible').count()).toBeGreaterThan(12);
  await page.screenshot({ path: 'test-results/dense-adaptive-labels.png' });
  await page.getByRole('button', { name: 'Engineering module 1', exact: true }).hover();
  await page.getByRole('button', { name: 'Engineering module 1', exact: true }).click();
  await expect(page.locator('#detail-title')).toHaveText('Engineering module 1');
  await expect.poll(async () => (await (await request.get('/api/state')).json()).focus).toBe(null); // Inspecting does not issue an agent camera command.
  await page.getByRole('button', { name: 'Close object details' }).click();
  await request.post('/api/camera', { data: { zoom: 0.1, transition: 0 } });
  await page.setViewportSize({ width: 430, height: 850 });
  await page.waitForTimeout(180);
  await assertClearAnnotations(page, 24);
  await page.screenshot({ path: 'test-results/dense-adaptive-mobile.png' });
  await expect(page.locator('#error')).toBeHidden();
});

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
  await loadExample(page, 'portal');
  await expect(page.getByRole('button', { name: 'The doorway', exact: true })).toBeVisible();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'test-results/doorway.png' });
  await loadExample(page, 'architecture');
  await expect(page.locator('.label')).toHaveCount(3);
  await expect(page.locator('.edge-label')).toHaveCount(2);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'test-results/architecture.png' });
  await page.getByRole('button', { name: 'Database', exact: true }).click();
  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('#detail-title')).toHaveText('Database');
  await expect.poll(async () => (await (await request.get('/api/state')).json()).focus).toBe(null);
  await page.getByRole('button', { name: 'Close object details' }).click();
  await expect(page.locator('#detail')).toBeHidden();
  await page.mouse.move(720, 360);
  await page.mouse.down();
  await page.mouse.move(950, 420, { steps: 12 });
  await page.mouse.up();
  await page.mouse.wheel(0, -200);
  await page.getByRole('button', { name: 'Fit scene', exact: true }).click();
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume motion', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await loadExample(page, 'helix');
  await expect(page.getByRole('button', { name: 'Double helix', exact: true })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/helix.png' });
  await page.getByRole('button', { name: 'Resume motion', exact: true }).click();
  await page.reload();
  await expect(page.locator('.label')).toHaveCount(1);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Dissolve scene', exact: true }).click();
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
  await loadExample(page, 'portal');
  await expect(page.locator('.label')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/mobile.png' });
  const label = await page.locator('.label').boundingBox(),
    caption = await page.locator('.caption').boundingBox();
  expect(label.y + label.height).toBeLessThan(caption.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Dissolve scene', exact: true }).click();
  await expect(page.locator('.label')).toHaveCount(0);
});

test('canvas follows window size and refits when resizing or recovering from zoom', async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await request.post('/api/clear', { data: {} });
  await page.goto('/');
  await loadExample(page, 'portal');
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
    const nav = await page.locator('nav[aria-label="Canvas controls"]').boundingBox();
    expect(nav.x + nav.width).toBeLessThanOrEqual(viewport.width);
    expect(nav.y + nav.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.mouse.move(640, 230);
  await page.mouse.wheel(0, -1200);
  await page.getByRole('button', { name: 'Fit scene', exact: true }).click();
  await expect
    .poll(async () => {
      const label = await page.locator('.label').boundingBox(),
        caption = await page.locator('.caption').boundingBox();
      return (
        label &&
        label.y > 0 &&
        (label.x >= caption.x + caption.width || label.y + label.height < caption.y)
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
    await loadExample(page, name);
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    const box = await page.locator('nav[aria-label="Canvas controls"]').boundingBox();
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
  await loadExample(page, 'portal');
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
  expect(changedPixels(front, side, 50, 130, 250, 320, 3)).toBeGreaterThan(100);
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
      expect(changedPixels(nearField, middleField, 50, 130, 250, 320, 3)).toBeGreaterThan(100);
    }
  }
  const distant = await page.screenshot({ path: 'test-results/extreme-zoom-out.png' });
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.locator('#show-background').uncheck();
  await page.waitForTimeout(150);
  const withoutDust = await page.screenshot();
  // Compare the same peripheral region against its own baseline across GPU backends.
  expect(coloredPixels(distant) - coloredPixels(withoutDust)).toBeGreaterThan(20);
  await page.locator('#show-background').check();
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByRole('button', { name: 'Fit scene' }).click();
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
  await loadExample(page, 'walkthrough');
  await expect(page.getByRole('button', { name: 'Previous step', exact: true })).toBeDisabled();
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
