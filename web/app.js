import * as THREE from 'three';
import { OrbitControls } from '/OrbitControls.js';
import { randomGenerator, shapePoint } from '/geometry.js';
import { constructs } from '/catalog.js';
import { createCameraController } from '/camera-controller.js';
import { createInteractionControls } from '/interactions.js';
import { createParticleField } from '/particle-field.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport'),
  labelLayer = $('labels');
const error = (message) => {
  $('error').hidden = false;
  $('error').textContent = message;
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused = reduced,
  current,
  currentFocus = null,
  cameraCommand = {},
  revision = -1,
  cameraRevision = -1;
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 3, 19);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#03070e', 0.012);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
} catch {
  error('WebGL is unavailable. Enable hardware acceleration or try another browser.');
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor('#03070e');
viewport.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2;
controls.maxDistance = 180;
const cameraController = createCameraController(camera, controls);
controls.addEventListener('start', cameraController.interrupt);
const count = 24000,
  random = randomGenerator(),
  positions = new Float32Array(count * 3),
  targets = new Float32Array(count * 3),
  colors = new Float32Array(count * 3),
  desiredColors = new Float32Array(count * 3),
  idle = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  const j = i * 3;
  idle[j] = (random() - 0.5) * 25;
  idle[j + 1] = (random() - 0.5) * 15;
  idle[j + 2] = (random() - 0.5) * 16;
  positions.set(idle.subarray(j, j + 3), j);
  targets.set(idle.subarray(j, j + 3), j);
  colors.set([0.16, 0.38, 0.48], j);
  desiredColors.set([0.16, 0.38, 0.48], j);
}
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const dotCanvas = document.createElement('canvas');
dotCanvas.width = 64;
dotCanvas.height = 64;
const ctx = dotCanvas.getContext('2d');
const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
glow.addColorStop(0, 'rgba(255,255,255,1)');
glow.addColorStop(0.15, 'rgba(255,255,255,.95)');
glow.addColorStop(0.4, 'rgba(255,255,255,.22)');
glow.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = glow;
ctx.fillRect(0, 0, 64, 64);
const texture = new THREE.CanvasTexture(dotCanvas);
const material = new THREE.PointsMaterial({
  size: 0.105,
  map: texture,
  vertexColors: true,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const cloud = new THREE.Points(geometry, material);
cloud.frustumCulled = false;
scene.add(cloud);
const particleField = createParticleField();
scene.add(particleField.points);
let labels = [],
  edges = [],
  flows = [],
  objectBounds = new Map();
const flowGroup = new THREE.Group();
scene.add(flowGroup);
async function send(path, body) {
  try {
    const response = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    $('error').hidden = true;
    return result;
  } catch (e) {
    error(e.message);
  }
}
function focus(id) {
  send('focus', { id });
}
const interactionControls = createInteractionControls({
  layer: labelLayer,
  toolbar: $('agent-controls'),
  notice: $('notice'),
  send,
});
function updateProjection() {
  camera.aspect = innerWidth / innerHeight;
  const caption = document.querySelector('.caption').getBoundingClientRect();
  const top = document.querySelector('header').getBoundingClientRect().bottom + 16;
  const left = 32,
    right = innerWidth - 32;
  const bottom = Math.max(top + 80, caption.top - 24);
  const centerX = innerWidth / 2;
  const centerY = (top + bottom) / 2;
  camera.setViewOffset(
    innerWidth,
    innerHeight,
    innerWidth / 2 - centerX,
    innerHeight / 2 - centerY,
    innerWidth,
    innerHeight,
  );
  camera.updateProjectionMatrix();
  return { width: Math.max(100, right - left), height: bottom - top, viewportHeight: innerHeight };
}
function frame(id = null) {
  const area = updateProjection();
  const objects = current?.objects || [];
  const selected = id ? objects.filter((o) => o.id === id) : objects;
  const bounds = new THREE.Box3();
  for (const o of selected) bounds.union(objectBounds.get(o.id));
  if (!id)
    for (const connection of current?.connections || []) {
      const a = objects.find((o) => o.id === connection.from),
        b = objects.find((o) => o.id === connection.to);
      const middle = new THREE.Vector3(...a.position).lerp(new THREE.Vector3(...b.position), 0.5);
      middle.y += 1.6;
      bounds.expandByPoint(middle);
    }
  if (!selected.length)
    bounds.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(12, 8, 10));
  cameraController.fit(bounds, area, cameraCommand, paused);
  const o = objects.find((o) => o.id === id);
  $('detail').hidden = !o;
  if (o) {
    $('detail-title').textContent = o.label || o.id;
    $('detail-body').textContent = o.description || 'No additional description provided.';
  }
}
function apply(state) {
  if (state.revision === revision) return;
  revision = state.revision;
  const snapshot = state.step >= 0 ? state.scene.steps[state.step] : state.scene;
  const display = { ...snapshot, actions: snapshot.actions ?? state.scene.actions ?? [] };
  const changed = JSON.stringify(display) !== JSON.stringify(current);
  current = display;
  $('title').textContent = current.title;
  $('explanation').textContent = current.explanation;
  if (changed) {
    labelLayer.replaceChildren();
    labels = [];
    edges = [];
    objectBounds = new Map();
    for (const flow of flows) {
      flow.geometry.dispose();
      flow.material.dispose();
    }
    flows = [];
    flowGroup.clear();
    targets.set(idle);
    for (let i = 0; i < count; i++) desiredColors.set([0.16, 0.38, 0.48], i * 3);
    const per = current.objects.length ? Math.floor((count * 0.85) / current.objects.length) : 0;
    current.objects.forEach((o, objectIndex) => {
      let seed = 0;
      for (const c of o.id) seed = (seed * 31 + c.charCodeAt(0)) | 0;
      const rng = randomGenerator(seed),
        color = new THREE.Color(o.color),
        bounds = new THREE.Box3(),
        rotation = new THREE.Euler(...o.rotation);
      for (let i = 0; i < per; i++) {
        const j = (objectIndex * per + i) * 3,
          p =
            o.shape === 'pointcloud'
              ? o.points[Math.floor((i / per) * o.points.length)]
              : shapePoint(o.shape, i, rng);
        const world = new THREE.Vector3(...p)
          .multiplyScalar(o.scale)
          .applyEuler(rotation)
          .add(new THREE.Vector3(...o.position));
        targets.set(world.toArray(), j);
        bounds.expandByPoint(world);
        const brightness = 0.55 + rng() * 0.65;
        desiredColors.set([color.r * brightness, color.g * brightness, color.b * brightness], j);
      }
      if (o.shape === 'pointcloud')
        for (const point of o.points)
          bounds.expandByPoint(
            new THREE.Vector3(...point)
              .multiplyScalar(o.scale)
              .applyEuler(rotation)
              .add(new THREE.Vector3(...o.position)),
          );
      const anchor = bounds.getCenter(new THREE.Vector3());
      anchor.y = bounds.min.y - 0.4;
      const element = document.createElement('button');
      element.className = 'label';
      element.textContent = o.label || o.id;
      element.addEventListener('click', () => focus(o.id));
      labelLayer.append(element);
      labels.push({ element, point: anchor });
      bounds.expandByPoint(anchor);
      objectBounds.set(o.id, bounds);
    });
    for (const connection of current.connections) {
      const a = current.objects.find((o) => o.id === connection.from),
        b = current.objects.find((o) => o.id === connection.to);
      const start = new THREE.Vector3(...a.position),
        end = new THREE.Vector3(...b.position),
        middle = start.clone().lerp(end, 0.5);
      middle.y += 1.6;
      const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(100 * 3), 3));
      const points = new THREE.Points(
        g,
        new THREE.PointsMaterial({
          color: '#70e0ed',
          size: 0.13,
          map: texture,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      points.userData.curve = curve;
      points.frustumCulled = false;
      flowGroup.add(points);
      flows.push(points);
      const element = document.createElement('span');
      element.className = 'edge-label';
      element.textContent = connection.label;
      labelLayer.append(element);
      edges.push({ element, point: curve.getPoint(0.5) });
    }
    $('construct').value =
      constructs.find((c) => (c.primaryId || c.id) === current.objects[0]?.id)?.id || '';
    if (paused) {
      positions.set(targets);
      colors.set(desiredColors);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }
  }
  interactionControls.render(state, current, objectBounds);
  currentFocus = state.focus;
  cameraCommand = state.camera || {};
  if (changed || state.camera_revision !== cameraRevision) frame(currentFocus);
  cameraRevision = state.camera_revision;
}
const events = new EventSource('/api/events');
events.onopen = () => {
  $('connection').textContent = 'Canvas connected';
  $('connection').className = 'live';
  $('error').hidden = true;
};
events.onerror = () => {
  $('connection').textContent = 'Reconnecting…';
  $('connection').className = '';
};
events.onmessage = (event) => {
  try {
    apply(JSON.parse(event.data));
  } catch (e) {
    error(`Unable to display scene: ${e.message}`);
  }
};
for (const construct of constructs) {
  const option = document.createElement('option');
  option.value = construct.id;
  option.textContent = construct.label;
  $('construct').append(option);
}
$('construct').onchange = async () => {
  const name = $('construct').value;
  if (!name) return;
  try {
    const response = await fetch(`/examples/${name}.json`);
    if (!response.ok) throw new Error('Unable to load construct');
    await send('scene', await response.json());
    $('construct').value = name;
  } catch (e) {
    error(e.message);
  }
};
$('reset').onclick = () => send('clear', {});
$('frame').onclick = () => focus(null);
$('close-detail').onclick = () => focus(null);
function motionButton() {
  $('motion').textContent = paused ? 'Resume motion' : 'Pause motion';
  $('motion').setAttribute('aria-pressed', String(paused));
}
$('motion').onclick = () => {
  paused = !paused;
  motionButton();
};
motionButton();
addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  frame(currentFocus);
});
let last = performance.now(),
  elapsed = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!paused) {
    elapsed += dt;
    const blend = 1 - Math.exp(-dt * 2.8);
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      for (let k = 0; k < 3; k++) {
        const drift = current?.objects.length ? 0 : Math.sin(elapsed * 0.2 + i * 0.02 + k) * 0.18;
        positions[j + k] += (targets[j + k] + drift - positions[j + k]) * blend;
        colors[j + k] += (desiredColors[j + k] - colors[j + k]) * blend;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }
  for (const flow of flows) {
    const p = flow.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (((i % 25) / 25) * 0.12 + Math.floor(i / 25) * 0.25 + elapsed * 0.22) % 1;
      const v = flow.userData.curve.getPoint(t);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    p.needsUpdate = true;
  }
  cameraController.update(dt, paused);
  for (const item of [...labels, ...edges]) {
    const v = item.point.clone().project(camera);
    item.element.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    item.element.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    item.element.hidden = v.z > 1 || v.z < -1;
  }
  interactionControls.update(camera, innerWidth, innerHeight);
  particleField.update(elapsed, innerHeight * renderer.getPixelRatio());
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
