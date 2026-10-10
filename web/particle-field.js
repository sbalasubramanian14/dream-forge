import * as THREE from 'three';
import { randomGenerator } from './geometry.js';

const FIELD = { layers: 10, pointsPerLayer: 1400, firstRadius: 24, radiusRatio: 3 };

/** Fixed world-space dust at several scales; the camera never carries or respawns it. */
export function createParticleField() {
  const count = FIELD.layers * FIELD.pointsPerLayer;
  const positions = new Float32Array(count * 3);
  const radii = new Float32Array(count);
  const phases = new Float32Array(count);
  const random = randomGenerator(909);
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / FIELD.pointsPerLayer);
    const radius = FIELD.firstRadius * FIELD.radiusRatio ** layer;
    const azimuth = random() * Math.PI * 2;
    const y = random() * 2 - 1;
    const horizontal = Math.sqrt(1 - y * y);
    const distance = radius * (0.65 + random() * 0.7);
    positions.set(
      [
        Math.cos(azimuth) * horizontal * distance,
        y * distance,
        Math.sin(azimuth) * horizontal * distance,
      ],
      i * 3,
    );
    radii[i] = radius;
    phases[i] = random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('radius', new THREE.BufferAttribute(radii, 1));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      viewportHeight: { value: 900 },
      color: { value: new THREE.Color('#5c9ca9') },
    },
    vertexShader: `
      attribute float radius;
      attribute float phase;
      uniform float time;
      uniform float viewportHeight;
      varying float visibility;
      void main() {
        // Farther scales emerge gradually, without stacking every layer on screen.
        visibility = smoothstep(0.06, 0.45, length(cameraPosition) / radius);
        vec3 drift = vec3(sin(time * 0.08 + phase), cos(time * 0.06 + phase),
                          sin(time * 0.05 + phase * 2.0)) * radius * 0.012;
        vec4 viewPosition = modelViewMatrix * vec4(position + drift, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        // Physical sizes attenuate with depth; nearby dust never fills the screen.
        gl_PointSize = min(12.0, radius * 0.005 * viewportHeight / max(0.1, -viewPosition.z));
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float visibility;
      void main() {
        vec2 offset = gl_PointCoord * 2.0 - 1.0;
        float glow = exp(-dot(offset, offset) * 5.0);
        gl_FragColor = vec4(color, glow * visibility * 0.65);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    update(elapsed, viewportHeight) {
      material.uniforms.time.value = elapsed;
      material.uniforms.viewportHeight.value = viewportHeight;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
