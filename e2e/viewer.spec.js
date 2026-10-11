import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

test('diagram viewer supports inspection, pinned labels, hierarchy, filtering and overview navigation', async ({
  page,
  request,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const id = (await (await request.post('/api/sessions', { data: { name: 'Viewer QA' } })).json())
    .session.id;
  const scene = await (await request.get('/examples/aws-eks.json')).json();
  await request.post('/api/scene?session=' + id, { data: scene });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?session=' + id);
  await expect(page.locator('#construct')).toHaveCount(0);
  await expect(page.locator('#step-progress')).toHaveText('Overview');
  await page.locator('#step-picker').selectOption('1');
  await expect(page.locator('#step-progress')).toHaveText('Step 2 of 8');
  await page.waitForTimeout(200);
  const pod = page.getByRole('button', { name: 'App pod A', exact: true });
  const anchor = await pod.evaluate((e) => [Number(e.dataset.anchorX), Number(e.dataset.anchorY)]);
  await pod.click();
  await expect(page.locator('#detail-title')).toHaveText('App pod A');
  expect((await (await request.get('/api/state?session=' + id)).json()).focus).toBe(null);
  expect(await pod.evaluate((e) => [Number(e.dataset.anchorX), Number(e.dataset.anchorY)])).toEqual(
    anchor,
  );
  await page.getByRole('button', { name: 'Close object details' }).click();
  const original = await pod.boundingBox();
  await page.mouse.move(original.x + original.width / 2, original.y + original.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    original.x + original.width / 2 + 100,
    original.y + original.height / 2 + 35,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(page.locator('#detail')).toBeHidden();
  const pinned = await pod.boundingBox();
  expect(pinned.x - original.x).toBeGreaterThan(80);
  await page.reload();
  await expect(pod).toBeVisible();
  await page.waitForTimeout(200);
  expect(Math.abs((await pod.boundingBox()).x - pinned.x)).toBeLessThan(3);
  await page.locator('#more-toggle').click();
  await page.locator('#reset-labels').click();
  await page.locator('#more-toggle').click();
  await page.waitForTimeout(200);
  // Picking geometry opens the inspector independently of label placement.
  const point = await pod.evaluate((e) => [Number(e.dataset.anchorX), Number(e.dataset.anchorY)]);
  await page.mouse.click(...point);
  await expect(page.locator('#detail-title')).toHaveText('App pod A');
  await page.locator('#isolate-selection').click();
  await expect(page.getByRole('button', { name: 'App pod C', exact: true })).toBeHidden();
  await expect(pod).toBeVisible();
  await page.locator('#layers-toggle').click();
  await page.locator('#show-boundaries').uncheck();
  await expect(page.getByRole('button', { name: 'EC2 node / AZ-a', exact: true })).toBeHidden();
  await expect(pod).toBeVisible();
  await page.locator('#show-labels').uncheck();
  await expect(page.locator('.label:visible')).toHaveCount(0);
  await page.locator('#show-all').click();
  await page.locator('#layers-toggle').click();
  await page.getByRole('button', { name: 'Close object details' }).click();
  await page.locator('#frame').click();
  await page.locator('#pan-mode').click();
  await expect(page.locator('#pan-mode')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#rotate-mode').click();
  await expect(page.locator('#rotate-mode')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#read-explanation').click();
  await expect(page.locator('#detail-body')).toContainText('public subnets');
  await page.getByRole('button', { name: 'Close object details' }).click();
  await page.screenshot({ path: 'test-results/viewer-aws-network.png' });
  for (let i = 0; i < 8; i++) {
    await page.locator('#step-picker').selectOption(String(i));
    await expect(page.locator('#step-progress')).toHaveText('Step ' + (i + 1) + ' of 8');
    await expect(page.locator('#error')).toBeHidden();
  }
  await page.locator('#step-overview').click();
  await expect(page.locator('#step-progress')).toHaveText('Overview');
  await page.locator('#history-toggle').click();
  await expect(page.locator('.history-group')).toHaveCount(1);
  await expect(page.locator('#history-list button')).toHaveCount(11);
  await page.locator('#history-toggle').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#step-next')).toBeVisible();
  await page.screenshot({ path: 'test-results/viewer-aws-mobile.png' });
  expect(errors).toEqual([]);
});

test('authored traffic journey plays, pauses, changes speed, replays and resets with a step', async ({
  page,
  request,
}) => {
  const id = (await (await request.post('/api/sessions', { data: { name: 'Playback QA' } })).json())
    .session.id;
  const objects = [
    { id: 'client', label: 'Client', shape: 'box', position: [-4, 0, 0] },
    { id: 'pod', label: 'Pod', shape: 'sphere', position: [4, 0, 0] },
  ];
  const snapshot = {
    title: 'One request',
    objects,
    connections: [{ from: 'client', to: 'pod', kind: 'traffic' }],
    journey: { path: ['client', 'pod'], seconds_per_hop: 0.4 },
  };
  await request.post('/api/scene?session=' + id, {
    data: {
      ...snapshot,
      steps: [
        {
          title: 'Configuration only',
          objects,
          connections: [{ from: 'client', to: 'pod', kind: 'configuration' }],
        },
      ],
    },
  });
  await page.goto('/?session=' + id);
  await expect(page.locator('#journey-controls')).toBeVisible();
  await page.locator('#journey-speed').selectOption('2');
  await page.locator('#journey-play').click();
  await expect(page.locator('#journey-status')).toHaveText('Request complete');
  await page.locator('#motion').click();
  await page.locator('#journey-replay').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#journey-status')).not.toHaveText('Request complete');
  await page.locator('#journey-play').click();
  await expect(page.locator('#journey-play')).toHaveText('Play request');
  await page.locator('#motion').click();
  await page.locator('#journey-play').click();
  await expect(page.locator('#journey-status')).toHaveText('Request complete');
  await page.locator('#step-next').click();
  await expect(page.locator('#journey-controls')).toBeHidden();
  await page.locator('#layers-toggle').click();
  await page.locator('#show-configuration').uncheck();
  await expect(page.locator('#error')).toBeHidden();
  await page.locator('#step-overview').click();
  await expect(page.locator('#journey-play')).toHaveText('Play request');
});

test('formed constructs retain visible particle motion and pause freezes the effect', async ({
  page,
  request,
}) => {
  const id = (
    await (await request.post('/api/sessions', { data: { name: 'Particle motion QA' } })).json()
  ).session.id;
  await request.post('/api/scene?session=' + id, {
    data: {
      title: 'Living particle construct',
      objects: [{ id: 'shape', shape: 'sphere', label: 'Particle sphere', scale: 2 }],
      assembly: { mode: 'morph', duration: 0.8 },
    },
  });
  await page.goto('/?session=' + id);
  await expect(page.locator('canvas')).toHaveAttribute('data-assembly', 'settled');
  await page.locator('#layers-toggle').click();
  await page.locator('#show-background').uncheck();
  await page.locator('#layers-toggle').click();
  const region = { x: 400, y: 180, width: 600, height: 350 };
  const changed = (a, b) => {
    const first = PNG.sync.read(a),
      second = PNG.sync.read(b);
    let n = 0;
    for (let i = 0; i < first.data.length; i += 4)
      if (Math.abs(first.data[i + 1] - second.data[i + 1]) > 8) n++;
    return n;
  };
  const first = await page.screenshot({ clip: region });
  await page.waitForTimeout(650);
  const second = await page.screenshot({
    clip: region,
    path: 'test-results/living-particle-construct.png',
  });
  expect(changed(first, second)).toBeGreaterThan(300);
  await page.locator('#motion').click();
  await page.waitForTimeout(250);
  const paused = await page.screenshot({ clip: region });
  await page.waitForTimeout(450);
  const still = await page.screenshot({ clip: region });
  expect(changed(paused, still)).toBeLessThan(10);
});
