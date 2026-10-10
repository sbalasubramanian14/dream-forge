// Deterministic samples keep object particles stable across scene updates.
export function randomGenerator(seed = 42) {return () => {seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;};}
export function shapePoint(shape, index, random) {
  const tau = Math.PI * 2;
  if (shape === 'sphere') {const y = random()*2-1, a = random()*tau, r = Math.sqrt(1-y*y); return [r*Math.cos(a), y, r*Math.sin(a)];}
  if (shape === 'box') {const p = [random()*2-1, random()*2-1, random()*2-1]; p[index%3] = index%2 ? 1 : -1; return p;}
  if (shape === 'torus') {const a=random()*tau,b=random()*tau,r=1+.3*Math.cos(b); return [r*Math.cos(a),.3*Math.sin(b),r*Math.sin(a)];}
  if (shape === 'cylinder' || shape === 'cone') {const y=random()*2-1,a=random()*tau,r=shape==='cone'?(1-y)/2:1; return [r*Math.cos(a),y,r*Math.sin(a)];}
  if (shape === 'arch') {
    if (index%3 === 0) {const a=random()*Math.PI,r=1.05+random()*.38; return [Math.cos(a)*r, Math.sin(a)*r+.35,(random()-.5)*.65];}
    return [(index%2?1:-1)*(1.05+random()*.38),random()*1.8-1.45,(random()-.5)*.65];
  }
  if (shape === 'helix') {
    const y=random()*4-2, a=y*3.4+(index%2?Math.PI:0), r=index%5===0?random():1;
    return [Math.cos(a)*r,y,Math.sin(a)*r];
  }
  throw new Error(`Unknown shape: ${shape}`);
}
