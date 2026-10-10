// Deterministic samples keep object particles stable across scene updates.
export function randomGenerator(seed = 42) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const shapeNames = [
  'sphere',
  'box',
  'torus',
  'cylinder',
  'cone',
  'arch',
  'helix',
  'tree',
  'gear',
  'rocket',
  'ruins',
  'pointcloud',
];
function tube(a, b, radius, random) {
  const t = random(),
    angle = random() * Math.PI * 2;
  const d = b.map((v, k) => v - a[k]),
    length = Math.hypot(...d),
    n = d.map((v) => v / length);
  const u = Math.abs(n[1]) < 0.9 ? [-n[2], 0, n[0]] : [0, n[2], -n[1]],
    ul = Math.hypot(...u);
  u.forEach((v, k) => (u[k] = v / ul));
  const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  return a.map(
    (value, k) => value + t * d[k] + radius * (Math.cos(angle) * u[k] + Math.sin(angle) * v[k]),
  );
}
export function shapePoint(shape, index, random) {
  const tau = Math.PI * 2;
  if (shape === 'gear') {
    const angle = random() * tau,
      tooth = Math.floor((((angle / tau) * 16) % 1) * 4),
      outer = tooth === 1 || tooth === 2 ? 1.32 : 1.12;
    const radius =
      index % 4 === 0 ? 0.42 : index % 4 === 1 ? outer : 0.42 + random() * (outer - 0.42);
    return [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      index % 4 < 2 ? (random() - 0.5) * 0.5 : index % 2 ? -0.25 : 0.25,
    ];
  }
  if (shape === 'tree') {
    if (index % 5 === 0) return tube([0, -2.3, 0], [0, 0.4, 0], 0.13, random);
    const branch = Math.floor(random() * 9),
      angle = branch * 2.39996,
      start = [0, -0.5 + branch * 0.12, 0];
    const end = [
      Math.cos(angle) * (1.2 + branch * 0.06),
      0.8 + branch * 0.16,
      Math.sin(angle) * (1 + branch * 0.06),
    ];
    if (index % 5 === 1) return tube(start, end, 0.035, random);
    const a = random() * tau,
      y = random() * 2 - 1,
      r = Math.sqrt(1 - y * y) * (0.5 + random() * 0.3);
    return [end[0] + Math.cos(a) * r, end[1] + y * 0.65, end[2] + Math.sin(a) * r];
  }
  if (shape === 'rocket') {
    const a = random() * tau;
    if (index % 8 === 0) {
      const y = 1.2 + random() * 1.1,
        r = (2.3 - y) * 0.48;
      return [r * Math.cos(a), y, r * Math.sin(a)];
    }
    if (index % 8 < 3) {
      const fin = ((index % 3) * tau) / 3,
        u = Math.sqrt(random()),
        v = random();
      const radius = 0.55 + u * v * 0.55,
        y = (1 - u) * -0.75 + u * (1 - v) * -1.6 + u * v * -1.85,
        thickness = (random() - 0.5) * 0.045;
      return [
        Math.cos(fin) * radius - Math.sin(fin) * thickness,
        y,
        Math.sin(fin) * radius + Math.cos(fin) * thickness,
      ];
    }
    if (index % 8 === 3) {
      const y = -1.8 - random() * 0.55,
        r = random() * 0.35;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    }
    return [0.55 * Math.cos(a), random() * 2.8 - 1.6, 0.55 * Math.sin(a)];
  }
  if (shape === 'ruins') {
    if (index % 5 === 0) {
      const step = Math.floor(random() * 6),
        p = shapePoint('box', index, random);
      return [p[0] * 1.75, -1.7 + step * 0.12 + p[1] * 0.06, 0.4 + step * 0.23 + p[2] * 0.14];
    }
    const p = shapePoint('arch', index, random);
    p[2] *= 1.6;
    // Repeated bands suggest cut stone and weathered columns.
    p[1] = Math.round(p[1] * 18) / 18 + (random() - 0.5) * 0.03;
    p[0] += (random() - 0.5) * 0.04;
    return p;
  }
  if (shape === 'sphere') {
    const y = random() * 2 - 1,
      a = random() * tau,
      r = Math.sqrt(1 - y * y);
    return [r * Math.cos(a), y, r * Math.sin(a)];
  }
  if (shape === 'box') {
    const p = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1];
    p[index % 3] = index % 2 ? 1 : -1;
    return p;
  }
  if (shape === 'torus') {
    const a = random() * tau,
      b = random() * tau,
      r = 1 + 0.3 * Math.cos(b);
    return [r * Math.cos(a), 0.3 * Math.sin(b), r * Math.sin(a)];
  }
  if (shape === 'cylinder' || shape === 'cone') {
    const y = random() * 2 - 1,
      a = random() * tau,
      r = shape === 'cone' ? (1 - y) / 2 : 1;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  }
  if (shape === 'arch') {
    if (index % 3 === 0) {
      const a = random() * Math.PI,
        r = 1.05 + random() * 0.38;
      return [Math.cos(a) * r, Math.sin(a) * r + 0.35, (random() - 0.5) * 0.65];
    }
    return [
      (index % 2 ? 1 : -1) * (1.05 + random() * 0.38),
      random() * 1.8 - 1.45,
      (random() - 0.5) * 0.65,
    ];
  }
  if (shape === 'helix') {
    const y = random() * 4 - 2,
      a = y * 3.4 + (index % 2 ? Math.PI : 0),
      r = index % 5 === 0 ? random() : 1;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  }
  throw new Error(`Unknown shape: ${shape}`);
}
