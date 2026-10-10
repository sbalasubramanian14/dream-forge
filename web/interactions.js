import * as THREE from 'three';

/** Renders agent-authored controls; behavior remains in the server action registry. */
export function createInteractionControls({ layer, toolbar, notice, send }) {
  let hotspots = [];
  let busy = false;

  function render(state, snapshot, bounds) {
    toolbar.replaceChildren();
    for (const hotspot of hotspots) hotspot.element.remove();
    hotspots = [];
    for (const interaction of snapshot.actions || []) {
      const button = document.createElement('button');
      button.textContent = interaction.label;
      button.dataset.actionId = interaction.id;
      button.className = 'agent-action';
      const type = interaction.action.type;
      const disabled =
        interaction.disabled ||
        (type === 'next' && state.step >= state.scene.steps.length - 1) ||
        (type === 'previous' && state.step <= -1);
      button.disabled = disabled;
      button.onclick = async () => {
        if (busy) return;
        busy = true;
        button.disabled = true;
        try {
          await send('action', { id: interaction.id });
        } finally {
          busy = false;
          button.disabled = disabled;
        }
      };
      if (interaction.placement === 'toolbar') toolbar.append(button);
      else {
        button.classList.add('hotspot');
        layer.append(button);
        if (interaction.placement === 'screen')
          hotspots.push({ element: button, screen: interaction.position });
        else {
          const box = bounds.get(interaction.object_id);
          const point = box.getCenter(new THREE.Vector3());
          hotspots.push({ element: button, point, objectId: interaction.object_id });
        }
      }
    }
    toolbar.hidden = toolbar.childElementCount === 0;
    const last = state.interactions?.at(-1);
    notice.hidden = last?.type !== 'notify';
    notice.textContent = last?.type === 'notify' ? `Recorded for agent: ${last.message}` : '';
  }

  function update(camera, width, height) {
    for (const hotspot of hotspots) {
      if (!hotspot.screen) continue; // Object hotspots share collision layout with labels.
      let x, y;
      x = hotspot.screen[0] * width;
      y = hotspot.screen[1] * height;
      const halfWidth = hotspot.element.offsetWidth / 2;
      const halfHeight = hotspot.element.offsetHeight / 2;
      hotspot.element.style.left = `${Math.max(halfWidth + 8, Math.min(width - halfWidth - 8, x))}px`;
      hotspot.element.style.top = `${Math.max(halfHeight + 8, Math.min(height - halfHeight - 8, y))}px`;
    }
  }

  return {
    render,
    update,
    annotations: () => hotspots.filter((hotspot) => !hotspot.screen),
    screenBounds: () =>
      hotspots
        .filter((hotspot) => hotspot.screen)
        .map((hotspot) => hotspot.element.getBoundingClientRect()),
  };
}
