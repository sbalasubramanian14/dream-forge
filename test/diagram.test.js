import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sceneSchema } from '../src/schema.js';
import { createDiagram } from '../web/diagram.js';
import { createState, replaceScene, performAction, goToStep } from '../src/state.js';

test('diagram contracts reject cyclic parents and request hops without a directed traffic edge', () => {
  const objects = [
    { id: 'vpc', shape: 'box', role: 'boundary' },
    { id: 'app', shape: 'sphere', parent_id: 'vpc' },
  ];
  const valid = {
    objects,
    connections: [{ from: 'vpc', to: 'app', kind: 'traffic' }],
    journey: { path: ['vpc', 'app'] },
  };
  assert.equal(sceneSchema.parse(valid).journey.seconds_per_hop, 1.6);
  for (const invalid of [
    { ...valid, objects: [{ ...objects[0], parent_id: 'app' }, objects[1]] },
    { ...valid, objects: [objects[0], { ...objects[1], parent_id: 'missing' }] },
    { ...valid, connections: [{ from: 'app', to: 'vpc', kind: 'traffic' }] },
    { ...valid, connections: [{ from: 'vpc', to: 'app', kind: 'configuration' }] },
    { ...valid, journey: { path: ['vpc', 'missing'] } },
  ])
    assert.throws(() => sceneSchema.parse(invalid));
  const sequence = {
    objects,
    steps: [{ objects }],
    actions: [{ id: 'overview', label: 'Overview', action: { type: 'goto', index: -1 } }],
  };
  const initial = replaceScene(createState(), sequence);
  assert.equal(performAction(goToStep(initial, 0), 'overview').step, -1);
});

test('isolation retains ancestors and descendants; boundary toggles never hide their workloads', () => {
  const geometry = new THREE.BufferGeometry();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0, 15);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const scene = new THREE.Scene();
  const diagram = createDiagram({ scene, camera, geometry, count: 12 });
  const snapshot = sceneSchema.parse({
    objects: [
      { id: 'vpc', shape: 'box', role: 'boundary' },
      { id: 'node', shape: 'box', role: 'boundary', parent_id: 'vpc' },
      { id: 'pod', shape: 'sphere', parent_id: 'node' },
      { id: 'other', shape: 'sphere', position: [5, 0, 0] },
    ],
  });
  const bounds = new Map(
    snapshot.objects.map((o) => [
      o.id,
      new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(...o.position),
        new THREE.Vector3(1, 1, 1),
      ),
    ]),
  );
  diagram.set(
    snapshot,
    bounds,
    snapshot.objects.map((o, i) => ({ id: o.id, start: i * 3, end: (i + 1) * 3 })),
  );
  assert.equal(diagram.pick(50, 50, 100, 100), 'pod');
  diagram.isolate('node');
  assert.equal(diagram.visible('vpc'), true);
  assert.equal(diagram.visible('pod'), true);
  assert.equal(diagram.visible('other'), false);
  diagram.filters({ boundaries: false });
  assert.equal(diagram.visible('node'), false);
  assert.equal(diagram.visible('pod'), true);
  assert.equal(geometry.attributes.visibility.array[0], 0);
  assert.equal(geometry.attributes.visibility.array[6], 1);
});
