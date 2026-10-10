import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createState, replaceScene, activeScene, performAction, goToStep } from '../src/state.js';
import { sceneSchema } from '../src/schema.js';

const walkthrough = JSON.parse(
  await readFile(new URL('../examples/walkthrough.json', import.meta.url), 'utf8'),
);

test('authored actions navigate snapshots, target current objects, and record user intent', () => {
  const initial = replaceScene(createState(), walkthrough);
  assert.equal(initial.step, -1);
  assert.throws(() => performAction(initial, 'back'), /outside/);
  assert.throws(() => performAction(initial, 'missing'), /Unknown action/);
  let state = performAction(initial, 'next');
  assert.equal(state.step, 0);
  assert.equal(activeScene(state).objects[0].id, 'body');
  state = performAction(state, 'inspect');
  assert.equal(state.camera.zoom, 1.5);
  assert.equal(state.focus, 'body');
  state = performAction(state, 'next');
  assert.equal(state.step, 1);
  state = performAction(state, 'inspect');
  assert.equal(state.focus, 'nose');
  state = performAction(state, 'next');
  assert.equal(state.step, 2);
  const cameraRevision = state.camera_revision;
  state = performAction(state, 'question');
  assert.equal(state.interactions.at(-1).type, 'notify');
  assert.equal(state.camera_revision, cameraRevision, 'A notification must not reset the camera');
  assert.match(state.interactions.at(-1).message, /fins/);
  for (let i = 0; i < 40; i++) state = performAction(state, 'question');
  assert.equal(state.interactions.length, 32);
  state = performAction(state, 'restart');
  assert.equal(state.step, 0);
  state = goToStep(state, -1);
  assert.equal(state.step, -1);
  assert.equal(initial.step, -1, 'Transitions do not mutate earlier state');
});

test('scene validation rejects broken hotspots, invalid step links, and executable actions', () => {
  for (const interaction of [
    {
      id: 'bad',
      label: 'Broken',
      placement: 'object',
      object_id: 'missing',
      action: { type: 'next' },
    },
    { id: 'bad', label: 'Broken', placement: 'screen', action: { type: 'next' } },
    { id: 'bad', label: 'Broken', action: { type: 'goto', index: 19 } },
    { id: 'bad', label: 'Broken', action: { type: 'script', code: 'alert(1)' } },
  ])
    assert.throws(() => sceneSchema.parse({ ...walkthrough, actions: [interaction] }));
  const state = replaceScene(createState(), {
    objects: [],
    actions: [{ id: 'disabled', label: 'Unavailable', disabled: true, action: { type: 'clear' } }],
  });
  assert.throws(() => performAction(state, 'disabled'), /disabled/);
});
