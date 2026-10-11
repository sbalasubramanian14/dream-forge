import * as THREE from 'three';

/** Viewer-only selection, hierarchy, and visibility; authored positions remain immutable. */
export function createDiagram({ scene, camera, geometry, count }) {
  const factors = new Float32Array(count).fill(1);
  geometry.setAttribute('visibility', new THREE.BufferAttribute(factors, 1));
  const boundaries = new THREE.Group(),
    highlights = new THREE.Group();
  scene.add(boundaries, highlights);
  let objects = [],
    bounds = new Map(),
    ranges = [],
    filters = {},
    isolated = null,
    selected = null,
    hovered = null,
    active = null;
  let shown = new Set();
  let assembled = false;
  const raycaster = new THREE.Raycaster();
  function dispose(group) {
    for (const child of group.children) {
      child.geometry.dispose();
      child.material.dispose();
    }
    group.clear();
  }
  function ancestors(id) {
    const result = [];
    let o = objects.find((o) => o.id === id);
    while (o?.parent_id) {
      result.push(o.parent_id);
      o = objects.find((p) => p.id === o.parent_id);
    }
    return result;
  }
  function related(id) {
    return (
      !isolated ||
      id === isolated ||
      ancestors(id).includes(isolated) ||
      ancestors(isolated).includes(id)
    );
  }
  function refreshHighlight() {
    dispose(highlights);
    const id = hovered || active || selected;
    for (const key of id ? [id, ...ancestors(id)] : []) {
      if (!shown.has(key)) continue;
      const helper = new THREE.Box3Helper(bounds.get(key), key === id ? '#fff0bb' : '#98c2d3');
      helper.material.transparent = true;
      helper.material.opacity = key === id ? 0.9 : 0.5;
      helper.material.depthTest = false;
      highlights.add(helper);
    }
    for (const child of boundaries.children)
      child.visible = assembled && shown.has(child.userData.id);
  }
  function refresh() {
    shown = new Set(
      objects
        .filter((o) => related(o.id) && (o.role !== 'boundary' || filters.boundaries !== false))
        .map((o) => o.id),
    );
    // Keep free particles around a formed construct; only filtered object ranges disappear.
    factors.fill(filters.background === false ? 0 : objects.length ? 0.6 : 1);
    for (const range of ranges) factors.fill(shown.has(range.id) ? 1 : 0, range.start, range.end);
    geometry.attributes.visibility.needsUpdate = true;
    refreshHighlight();
  }
  return {
    set(snapshot, nextBounds, nextRanges) {
      objects = snapshot.objects;
      bounds = nextBounds;
      ranges = nextRanges;
      isolated = null;
      selected = null;
      hovered = null;
      active = null;
      assembled = false;
      dispose(boundaries);
      for (const o of objects.filter((o) => o.role === 'boundary')) {
        const helper = new THREE.Box3Helper(bounds.get(o.id), o.color);
        helper.material.transparent = true;
        helper.material.opacity = 0.12;
        helper.material.depthWrite = false;
        helper.userData.id = o.id;
        boundaries.add(helper);
      }
      refresh();
    },
    filters(value) {
      filters = { ...value };
      refresh();
    },
    assembly(ready) {
      if (assembled === ready) return;
      assembled = ready;
      for (const child of boundaries.children)
        child.visible = assembled && shown.has(child.userData.id);
    },
    isolate(id) {
      isolated = id;
      refresh();
    },
    select(id) {
      selected = id;
      refreshHighlight();
    },
    hover(id) {
      hovered = id;
      refreshHighlight();
    },
    active(id) {
      if (active !== id) {
        active = id;
        refreshHighlight();
      }
    },
    visible(id) {
      return shown.has(id);
    },
    bounds() {
      return new Map([...bounds].filter(([id]) => shown.has(id)));
    },
    pick(x, y, width, height) {
      raycaster.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, 1 - (y / height) * 2), camera);
      let nearest = null,
        distance = Infinity;
      for (const o of objects.filter((o) => o.role !== 'boundary' && shown.has(o.id))) {
        const p = raycaster.ray.intersectBox(bounds.get(o.id), new THREE.Vector3());
        if (p) {
          const d = raycaster.ray.origin.distanceTo(p);
          if (d < distance) {
            nearest = o.id;
            distance = d;
          }
        }
      }
      return nearest;
    },
  };
}
