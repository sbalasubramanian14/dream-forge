import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionStore } from '../src/sessions.js';
import { replaceScene, setCamera } from '../src/state.js';
import { getCapabilities } from '../src/capabilities.js';
import { createParticleTransition } from '../web/particle-transition.js';

test('sessions start empty, isolate state, serialize writes, and persist restorable history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dream-forge-sessions-'));
  try {
    const store = new SessionStore(directory);
    await store.initialize();
    const a = (await store.create({ name: 'Claude' })).session.id;
    const b = (await store.create({ name: 'Codex' })).session.id;
    assert.notEqual(a, b);
    assert.deepEqual(store.state(a).history, []);
    assert.equal(store.state(b).scene.objects.length, 0);
    const first = await store.mutate(a, (state) =>
      replaceScene(state, {
        title: 'First scene',
        objects: [{ id: 'one', shape: 'sphere' }],
      }),
    );
    const firstId = first.history[0].id;
    await Promise.all([
      store.mutate(a, (state) => replaceScene(state, { title: 'Second scene', objects: [] })),
      store.mutate(a, (state) => setCamera(state, { view: 'top' })),
    ]);
    assert.equal(store.state(a).history.length, 2, 'Camera changes do not clutter history');
    assert.equal(store.state(b).revision, 0);
    const duplicate = await Promise.allSettled([
      store.create({ id: 'same-id' }),
      store.create({ id: 'same-id' }),
    ]);
    assert.equal(duplicate.filter((result) => result.status === 'fulfilled').length, 1);
    await assert.rejects(
      store.mutate(a, (state) =>
        replaceScene(state, { objects: [{ id: 'bad', shape: 'unknown' }] }),
      ),
    );
    assert.equal(store.state(a).history.length, 2);
    const restored = await store.restore(a, firstId);
    assert.equal(restored.scene.title, 'First scene');
    assert.equal(restored.current_history_id, firstId);
    assert.equal(restored.history.length, 2, 'Restoring does not discard newer entries');
    await assert.rejects(store.restore(b, firstId), /Unknown history/);
    const reloaded = new SessionStore(directory);
    await reloaded.initialize();
    assert.equal(reloaded.state(a).scene.title, 'First scene');
    assert.equal(reloaded.state(a).history.length, 2);
    assert.equal(reloaded.state(b).scene.objects.length, 0);
    await assert.rejects(store.create({ id: '../escape' }), /Session ID/);
    for (let i = 0; i < 52; i++)
      await store.mutate(b, (state) => replaceScene(state, { title: `Scene ${i}`, objects: [] }));
    assert.equal(store.state(b).history.length, 50);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('capability discovery exposes the current schema and supported limits', async () => {
  const capabilities = await getCapabilities();
  assert.equal(capabilities.scene_schema.properties.assembly.properties.mode.enum.length, 2);
  assert.equal(capabilities.limits.objects, 24);
  assert.match(capabilities.workflow, /session_id/);
});

test('dissolve passes through idle then reforms; direct morphs and pause remain deterministic', () => {
  const positions = new Float32Array([0, 0, 0]);
  const targets = new Float32Array([10, 10, 10]);
  const colors = new Float32Array([0, 0, 0]);
  const desiredColors = new Float32Array([1, 1, 1]);
  const idle = new Float32Array([-5, -5, -5]);
  const transition = createParticleTransition({ positions, targets, colors, desiredColors, idle });
  transition.begin({ mode: 'dissolve', duration: 2 }, false);
  assert.equal(transition.update(0.5, false, 0, false), 'dissolving');
  assert.ok(positions[0] < 0, 'Dissolve moves toward the idle field before the new construct');
  const pausedPosition = positions[0];
  transition.update(0.5, true, 0, false);
  assert.equal(positions[0], pausedPosition);
  assert.equal(transition.update(0.5, false, 0, false), 'reforming');
  assert.deepEqual(positions, idle);
  transition.update(1, false, 0, false);
  assert.deepEqual(positions, targets);
  targets.fill(20);
  transition.begin({ mode: 'morph', duration: 2 }, false);
  transition.update(1, false, 0, false);
  assert.equal(positions[0], 15);
  transition.begin({ mode: 'dissolve', duration: 2 }, true);
  assert.deepEqual(positions, targets, 'Reduced motion snaps to the requested construct');
});
