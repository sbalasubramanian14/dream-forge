import * as THREE from 'three';

const GAP = 8;
const SVG = 'http://www.w3.org/2000/svg';

function overlaps(a, b) {
  return (
    a.left < b.right + GAP &&
    a.right > b.left - GAP &&
    a.top < b.bottom + GAP &&
    a.bottom > b.top - GAP
  );
}

/** Find a clear rectangle without placing text over geometry or other annotations. */
export function placeAnnotation(anchor, size, obstacles, area, preferred) {
  const candidates = preferred ? [preferred] : [];
  const box = anchor.box;
  if (box) {
    candidates.push(
      [anchor.x - size.width / 2, box.bottom + GAP],
      [box.right + GAP, anchor.y - size.height / 2],
      [box.left - GAP - size.width, anchor.y - size.height / 2],
      [anchor.x - size.width / 2, box.top - GAP - size.height],
    );
  }
  for (const radius of [24, 48, 80, 120, 180, 260, 360]) {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.PI / 2;
      candidates.push([
        anchor.x + Math.cos(angle) * radius - size.width / 2,
        anchor.y + Math.sin(angle) * radius - size.height / 2,
      ]);
    }
  }
  for (const [left, top] of candidates) {
    const rect = { left, top, right: left + size.width, bottom: top + size.height };
    if (
      rect.left < area.left ||
      rect.right > area.right ||
      rect.top < area.top ||
      rect.bottom > area.bottom
    )
      continue;
    if (!obstacles.some((obstacle) => overlaps(rect, obstacle))) return rect;
  }
  return null;
}

function projectPoint(point, camera, width, height) {
  const p = point.clone().project(camera);
  return {
    x: (p.x * 0.5 + 0.5) * width,
    y: (-p.y * 0.5 + 0.5) * height,
    visible: p.z >= -1 && p.z <= 1 && p.x >= -1 && p.x <= 1 && p.y >= -1 && p.y <= 1,
  };
}

function projectBounds(bounds, camera, width, height) {
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(camera);
        if (p.z >= -1 && p.z <= 1)
          corners.push({ x: (p.x * 0.5 + 0.5) * width, y: (-p.y * 0.5 + 0.5) * height });
      }
  if (!corners.length) return null;
  return {
    left: Math.min(...corners.map((p) => p.x)),
    right: Math.max(...corners.map((p) => p.x)),
    top: Math.min(...corners.map((p) => p.y)),
    bottom: Math.max(...corners.map((p) => p.y)),
  };
}

/** Shared layout for object labels, connection captions, and object-attached controls. */
export function createAnnotations(
  layer,
  { storageKey = 'dream-forge-labels', onHighlight = () => {} } = {},
) {
  let items = [];
  let svg;
  let lastLayout = -Infinity;
  let pinned = {};
  try {
    pinned = JSON.parse(localStorage.getItem(storageKey) || '{}');
  } catch {
    /* Optional local preferences. */
  }
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pinned));
    } catch {
      /* Storage can be disabled. */
    }
  }

  function setItems(next) {
    svg?.remove();
    svg = document.createElementNS(SVG, 'svg');
    svg.classList.add('annotation-lines');
    svg.setAttribute('aria-hidden', 'true');
    layer.prepend(svg);
    items = next.map((item) => {
      const line = document.createElementNS(SVG, 'line');
      svg.append(line);
      item.element.classList.add('annotation');
      item.element.dataset.label = item.element.textContent;
      item.element.setAttribute('aria-label', item.element.textContent);
      item.element.title = item.element.textContent;
      const entry = { ...item, line, offset: null, pin: pinned[item.key] };
      if (item.objectId && item.element.classList.contains('label')) {
        item.element.onpointerenter = () => onHighlight(item.objectId);
        item.element.onpointerleave = () => onHighlight(null);
        let drag = null;
        item.element.onpointerdown = (event) => {
          if (event.button !== 0) return;
          event.stopPropagation();
          const rect = item.element.getBoundingClientRect();
          drag = {
            x: event.clientX,
            y: event.clientY,
            left: rect.left,
            top: rect.top,
            moved: false,
          };
          item.element.setPointerCapture(event.pointerId);
        };
        item.element.onpointermove = (event) => {
          if (!drag) return;
          const dx = event.clientX - drag.x,
            dy = event.clientY - drag.y;
          if (Math.hypot(dx, dy) < 5 && !drag.moved) return;
          drag.moved = true;
          entry.pin = [
            Math.max(12, Math.min(innerWidth - item.element.offsetWidth - 12, drag.left + dx)) /
              innerWidth,
            Math.max(60, Math.min(innerHeight - item.element.offsetHeight - 80, drag.top + dy)) /
              innerHeight,
          ];
          lastLayout = -Infinity;
        };
        const finish = () => {
          if (drag?.moved) {
            pinned[item.key] = entry.pin;
            save();
            item.element.dataset.dragged = 'true';
            setTimeout(() => delete item.element.dataset.dragged, 0);
          }
          drag = null;
        };
        item.element.onpointerup = finish;
        item.element.onpointercancel = finish;
      }
      return entry;
    });
    lastLayout = -Infinity;
  }

  function update(camera, width, height, bounds, reserved, focus, now) {
    // DOM measurements and rectangle search need not run at particle-frame frequency.
    if (now - lastLayout < 60) return;
    lastLayout = now;
    const area = { left: 12, top: 12, right: width - 12, bottom: height - 12 };
    const boxes = new Map();
    for (const [id, box] of bounds) boxes.set(id, projectBounds(box, camera, width, height));
    // Boundary interiors are usable space; treating them as solid obstacles pushed labels far away.
    const boundaryIds = new Set(items.filter((i) => i.boundary).map((i) => i.objectId));
    const obstacles = [...boxes]
      .filter(([id]) => !boundaryIds.has(id))
      .map(([, box]) => box)
      .filter(Boolean)
      .concat(reserved);
    const ordered = [...items].sort(
      (a, b) => Number(b.objectId === focus) - Number(a.objectId === focus),
    );
    for (const item of ordered) {
      const anchor = projectPoint(item.point, camera, width, height);
      anchor.box = boxes.get(item.objectId);
      if (item.boundary && anchor.box) {
        anchor.x = anchor.box.left + 16;
        anchor.y = anchor.box.top;
      }
      if (item.visible === false) {
        item.element.hidden = true;
        item.line.style.display = 'none';
        continue;
      }
      item.element.hidden = !anchor.visible;
      item.line.style.display = 'none';
      if (!anchor.visible) continue;
      const small =
        anchor.box &&
        Math.max(anchor.box.right - anchor.box.left, anchor.box.bottom - anchor.box.top) < 14;
      const compact = Boolean(
        small && item.objectId !== focus && item.element.tagName === 'BUTTON',
      );
      item.element.classList.toggle('is-compact', compact);
      const size = { width: item.element.offsetWidth, height: item.element.offsetHeight };
      const preferred = item.offset && [anchor.x + item.offset[0], anchor.y + item.offset[1]];
      let rect;
      if (entryPinValid(item.pin)) {
        const left = Math.max(area.left, Math.min(area.right - size.width, item.pin[0] * width));
        const top = Math.max(area.top, Math.min(area.bottom - size.height, item.pin[1] * height));
        rect = { left, top, right: left + size.width, bottom: top + size.height };
      } else rect = placeAnnotation(anchor, size, obstacles, area, preferred);
      if (!rect && item.element.tagName === 'BUTTON') {
        item.element.classList.add('is-compact');
        rect = placeAnnotation(anchor, { width: 14, height: 14 }, obstacles, area);
      }
      if (!rect) {
        item.element.hidden = true;
        continue;
      }
      item.offset = [rect.left - anchor.x, rect.top - anchor.y];
      item.element.style.left = `${rect.left}px`;
      item.element.style.top = `${rect.top}px`;
      item.element.dataset.anchorX = anchor.x;
      item.element.dataset.anchorY = anchor.y;
      obstacles.push(rect);
      item.line.style.display = '';
      item.line.setAttribute('x1', anchor.x);
      item.line.setAttribute('y1', anchor.y);
      item.line.setAttribute('x2', Math.max(rect.left, Math.min(rect.right, anchor.x)));
      item.line.setAttribute('y2', Math.max(rect.top, Math.min(rect.bottom, anchor.y)));
    }
  }

  return {
    setItems,
    update,
    reset() {
      pinned = {};
      save();
      for (const item of items) {
        item.pin = null;
        item.offset = null;
      }
      lastLayout = -Infinity;
    },
    setVisibility(predicate) {
      for (const item of items) item.visible = predicate(item);
      lastLayout = -Infinity;
    },
  };
}

function entryPinValid(pin) {
  return Array.isArray(pin) && pin.length === 2 && pin.every(Number.isFinite);
}
