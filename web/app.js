import * as THREE from 'three';
import { OrbitControls } from '/OrbitControls.js';
import { randomGenerator, shapePoint } from '/geometry.js';
import { createCameraController } from '/camera-controller.js';
import { createInteractionControls } from '/interactions.js';
import { createParticleField } from '/particle-field.js';
import { createAnnotations } from '/annotations.js';
import { createParticleTransition } from '/particle-transition.js';
import { createHistory } from '/history.js';
import { createViewerControls } from '/viewer-controls.js';
import { createJourney } from '/journey.js';
import { createDiagram } from '/diagram.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport'),
  labelLayer = $('labels');
const error = (message) => {
  $('error').hidden = false;
  $('error').textContent = message;
};
const sessionId = new URL(location.href).searchParams.get('session') || 'local';
const apiUrl = (path) => `/api/${path}?session=${encodeURIComponent(sessionId)}`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused = reduced,
  current,
  currentFocus = null,
  cameraCommand = {},
  revision = -1,
  cameraRevision = -1,
  sceneRevision = -1;
let localInspection = false;
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
const motionScales = new Float32Array(count).fill(0.16);
const phases = Float32Array.from({ length: count }, (_, i) => i * 2.399963);
geometry.setAttribute('motionScale', new THREE.BufferAttribute(motionScales, 1));
geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
const particleUniforms = { particleTime: { value: 0 }, particleMotion: { value: 1 } };
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
  size: 0.125,
  map: texture,
  vertexColors: true,
  transparent: true,
  opacity: 0.98,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
material.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, particleUniforms);
  shader.vertexShader =
    'attribute float visibility;\nattribute float motionScale;\nattribute float phase;\nuniform float particleTime;\nuniform float particleMotion;\n' +
    shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\ntransformed += vec3(sin(phase + particleTime * 1.1), cos(phase * 1.3 + particleTime * 0.9), sin(phase * 0.7 + particleTime)) * motionScale * particleMotion;',
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <color_vertex>',
    '#include <color_vertex>\nvColor *= visibility * (1.0 + 0.18 * sin(phase + particleTime * 1.4) * particleMotion);',
  );
};
const particleTransition = createParticleTransition({
  positions,
  targets,
  colors,
  desiredColors,
  idle,
});
const cloud = new THREE.Points(geometry, material);
cloud.frustumCulled = false;
scene.add(cloud);
const particleField = createParticleField();
scene.add(particleField.points);
const diagram = createDiagram({ scene, camera, geometry, count });
const journey = createJourney({ scene, texture, onHighlight: (id) => diagram.active(id) });
let labels = [],
  edges = [],
  flows = [],
  objectBounds = new Map();
const flowGroup = new THREE.Group();
scene.add(flowGroup);
async function send(path, body) {
  try {
    const response = await fetch(apiUrl(path), {
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
function inspect(id, explanation = false) {
  localInspection = true;
  diagram.select(id);
  viewer.selection(id);
  $('detail').hidden = !id && !explanation;
  $('detail-title').textContent = explanation
    ? current.title
    : current.objects.find((o) => o.id === id)?.label || id || '';
  $('detail-body').textContent = explanation
    ? current.explanation
    : current.objects.find((o) => o.id === id)?.description ||
      'No additional description provided.';
}
const history = createHistory({
  button: $('history-toggle'),
  panel: $('history-panel'),
  list: $('history-list'),
  sessionList: $('session-list'),
  sessionLabel: $('session-label'),
  send,
});
const annotations = createAnnotations(labelLayer, {
  storageKey: 'dream-forge-labels:' + sessionId,
  onHighlight: (id) => diagram.hover(id),
});
const viewer = createViewerControls({
  send,
  onFit: (id) => frame(id, { ...cameraCommand, target_id: id, zoom: 1, auto_rotate: false }),
  onZoom: (factor) => cameraController.zoom(factor),
  onMode: (mode) => cameraController.setMode(mode),
  onResetLabels: () => annotations.reset(),
  onInspect: inspect,
  onIsolate: (id) => {
    diagram.isolate(id);
    refreshVisibility();
    if (id) frame(null);
  },
  onLayers: (filters) => {
    diagram.filters(filters);
    refreshVisibility();
  },
});
function refreshVisibility() {
  particleField.points.visible = viewer.filters.background;
  for (const flow of flows) {
    const c = flow.userData.connection;
    flow.visible =
      diagram.visible(c.from) &&
      diagram.visible(c.to) &&
      viewer.filters[c.kind === 'relationship' ? 'relationships' : c.kind];
    flow.userData.track.visible = flow.visible;
  }
  annotations.setVisibility((item) => {
    if (item.connection) {
      const c = item.connection;
      return (
        viewer.filters.labels &&
        diagram.visible(c.from) &&
        diagram.visible(c.to) &&
        viewer.filters[c.kind === 'relationship' ? 'relationships' : c.kind]
      );
    }
    return (
      (!item.element.classList.contains('label') || viewer.filters.labels) &&
      (!item.objectId || diagram.visible(item.objectId))
    );
  });
  journey.visibility(
    viewer.filters.traffic &&
      (!current?.journey || current.journey.path.every((id) => diagram.visible(id))),
  );
}
const annotationPanels = [
  ...document.querySelectorAll(
    'header, .caption, footer, #detail, #notice, #history-panel, .utility-panel, #journey-controls',
  ),
];
const interactionControls = createInteractionControls({
  layer: labelLayer,
  toolbar: $('agent-controls'),
  notice: $('notice'),
  send,
});
function updateProjection() {
  camera.aspect = innerWidth / innerHeight;
  document.documentElement.style.setProperty(
    '--footer-height',
    document.querySelector('footer').getBoundingClientRect().height + 'px',
  );
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
function frame(id = null, settings = cameraCommand) {
  const area = updateProjection();
  const objects = current?.objects || [];
  const selected = objects.filter((o) => (id ? o.id === id : diagram.visible(o.id)));
  const bounds = new THREE.Box3();
  for (const o of selected) bounds.union(objectBounds.get(o.id));
  if (!id)
    for (const connection of current?.connections || []) {
      if (!diagram.visible(connection.from) || !diagram.visible(connection.to)) continue;
      const a = objects.find((o) => o.id === connection.from),
        b = objects.find((o) => o.id === connection.to);
      const middle = new THREE.Vector3(...a.position).lerp(new THREE.Vector3(...b.position), 0.5);
      middle.y += 1.6;
      bounds.expandByPoint(middle);
    }
  if (!selected.length)
    bounds.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(12, 8, 10));
  cameraController.fit(bounds, area, settings, paused);
}
function apply(state) {
  if (state.revision === revision) return;
  revision = state.revision;
  const snapshot = state.step >= 0 ? state.scene.steps[state.step] : state.scene;
  const display = { ...snapshot, actions: snapshot.actions ?? state.scene.actions ?? [] };
  const changed =
    JSON.stringify(display) !== JSON.stringify(current) || state.scene_revision !== sceneRevision;
  current = display;
  particleField.intensity(current.objects.length ? 0.55 : 0.65);
  history.render(state);
  viewer.render(state);
  $('title').textContent = current.title;
  $('explanation').textContent = current.explanation;
  if (changed) {
    localInspection = false;
    viewer.selection(null);
    $('detail').hidden = true;
    labelLayer.replaceChildren();
    labels = [];
    edges = [];
    objectBounds = new Map();
    for (const flow of flows) {
      flow.geometry.dispose();
      flow.material.dispose();
      flow.userData.track.geometry.dispose();
      flow.userData.track.material.dispose();
    }
    flows = [];
    flowGroup.clear();
    targets.set(idle);
    for (let i = 0; i < count; i++) desiredColors.set([0.16, 0.38, 0.48], i * 3);
    const per = current.objects.length ? Math.floor((count * 0.85) / current.objects.length) : 0;
    const ranges = [];
    motionScales.fill(0.16);
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
        const brightness = o.role === 'boundary' ? 1.4 : 0.75 + rng() * 0.5;
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
      const motionScale = THREE.MathUtils.clamp(
        bounds.getSize(new THREE.Vector3()).length() * 0.008,
        0.012,
        0.07,
      );
      motionScales.fill(motionScale, objectIndex * per, (objectIndex + 1) * per);
      const element = document.createElement('button');
      element.className = 'label';
      element.textContent = o.label || o.id;
      element.addEventListener('click', () => {
        if (!element.dataset.dragged) inspect(o.id);
      });
      if (o.show_label !== false) {
        labelLayer.append(element);
        labels.push({
          element,
          point: anchor,
          objectId: o.id,
          boundary: o.role === 'boundary',
          key: current.title + ':' + o.id,
        });
      }
      objectBounds.set(o.id, bounds);
      ranges.push({ id: o.id, start: objectIndex * per, end: (objectIndex + 1) * per });
    });
    diagram.set(current, objectBounds, ranges);
    geometry.attributes.motionScale.needsUpdate = true;
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
          color:
            connection.kind === 'configuration'
              ? '#ba9ade'
              : connection.kind === 'traffic'
                ? '#ffd28a'
                : '#70b3bf',
          size: 0.19,
          map: texture,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      points.userData.curve = curve;
      points.userData.connection = connection;
      const track = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
        new THREE.LineBasicMaterial({
          color: points.material.color,
          transparent: true,
          opacity: connection.kind === 'traffic' ? 0.14 : 0.08,
          depthWrite: false,
        }),
      );
      flowGroup.add(track);
      points.userData.track = track;
      points.frustumCulled = false;
      flowGroup.add(points);
      flows.push(points);
      const element = document.createElement('span');
      element.className = 'edge-label';
      element.textContent = connection.label;
      labelLayer.append(element);
      edges.push({ element, point: curve.getPoint(0.5), connection });
    }
    journey.set(current, flows);
    particleTransition.begin(current.assembly, paused);
    if (paused) {
      positions.set(targets);
      colors.set(desiredColors);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }
  }
  interactionControls.render(state, current, objectBounds);
  annotations.setItems([...labels, ...edges, ...interactionControls.annotations()]);
  refreshVisibility();
  currentFocus = state.focus;
  cameraCommand = state.camera || {};
  if (changed || state.camera_revision !== cameraRevision) frame(currentFocus);
  if (state.camera_revision !== cameraRevision) {
    if (currentFocus) inspect(currentFocus);
    else if (!localInspection) $('detail').hidden = true;
  }
  cameraRevision = state.camera_revision;
  sceneRevision = state.scene_revision;
}
const events = new EventSource(apiUrl('events'));
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
$('reset').onclick = () => send('clear', {});
let press;
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 0) press = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) {
    const id = diagram.pick(e.clientX, e.clientY, innerWidth, innerHeight);
    if (id) inspect(id);
  }
  press = null;
});
renderer.domElement.addEventListener('pointercancel', () => {
  press = null;
});
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
  const frameDelta = Math.max(0, (now - last) / 1000);
  const dt = Math.min(frameDelta, 0.05);
  last = now;
  if (!paused) {
    elapsed += frameDelta;
    renderer.domElement.dataset.assembly = particleTransition.update(
      frameDelta,
      paused,
      elapsed,
      !current?.objects.length,
    );
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
  const assembled = paused || renderer.domElement.dataset.assembly === 'settled';
  diagram.assembly(assembled);
  for (const flow of flows) flow.userData.track.visible = flow.visible && assembled;
  particleUniforms.particleTime.value = elapsed;
  particleUniforms.particleMotion.value = paused
    ? 0
    : renderer.domElement.dataset.assembly === 'settled'
      ? 1
      : 0.3;
  journey.update(dt, paused);
  interactionControls.update(camera, innerWidth, innerHeight);
  const reserved = annotationPanels
    .filter((panel) => !panel.hidden)
    .map((panel) => panel.getBoundingClientRect());
  annotations.update(
    camera,
    innerWidth,
    innerHeight,
    new Map(
      [...diagram.bounds()].filter(
        ([id]) => current?.objects.find((o) => o.id === id)?.show_label !== false,
      ),
    ),
    [...reserved, ...interactionControls.screenBounds()],
    currentFocus,
    now,
  );
  particleField.update(elapsed, innerHeight * renderer.getPixelRatio());
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
