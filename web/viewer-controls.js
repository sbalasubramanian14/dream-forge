/** Standard viewer controls remain separate from agent-authored actions and scene state. */
export function createViewerControls({
  send,
  onFit,
  onZoom,
  onMode,
  onLayers,
  onResetLabels,
  onInspect,
  onIsolate,
}) {
  const $ = (id) => document.getElementById(id);
  let state;
  let selected = null;
  let busy = false;
  const filters = {
    boundaries: true,
    labels: true,
    traffic: true,
    configuration: true,
    relationships: true,
    background: true,
  };
  async function go(index) {
    if (busy) return;
    busy = true;
    try {
      await send('step', { index });
    } finally {
      busy = false;
    }
  }
  $('step-overview').onclick = () => go(-1);
  $('step-previous').onclick = () => go(state.step - 1);
  $('step-next').onclick = () => go(state.step + 1);
  $('step-picker').onchange = (e) => go(Number(e.target.value));
  for (const mode of ['rotate', 'pan'])
    $('' + mode + '-mode').onclick = () => {
      onMode(mode);
      $('rotate-mode').setAttribute('aria-pressed', String(mode === 'rotate'));
      $('pan-mode').setAttribute('aria-pressed', String(mode === 'pan'));
      $('gesture-hint').textContent =
        mode === 'pan'
          ? 'Drag to pan · Scroll to zoom · Click a part to inspect'
          : 'Drag to rotate · Right-drag to pan · Scroll to zoom · Click a part to inspect';
    };
  $('zoom-in').onclick = () => onZoom(0.8);
  $('zoom-out').onclick = () => onZoom(1.25);
  $('frame').onclick = () => onFit(null);
  $('zoom-selection').onclick = () => onFit(selected);
  $('isolate-selection').onclick = () => onIsolate(selected);
  $('read-explanation').onclick = () => onInspect(null, true);
  $('close-detail').onclick = () => onInspect(null);
  $('reset-labels').onclick = onResetLabels;
  for (const name of ['layers', 'more'])
    $('' + name + '-toggle').onclick = () => {
      const panel = $('' + name + '-panel');
      panel.hidden = !panel.hidden;
      $('' + name + '-toggle').setAttribute('aria-expanded', String(!panel.hidden));
    };
  for (const key of Object.keys(filters))
    $('show-' + key).onchange = (e) => {
      filters[key] = e.target.checked;
      onLayers(filters);
    };
  $('show-all').onclick = () => {
    for (const key of Object.keys(filters)) {
      filters[key] = true;
      $('show-' + key).checked = true;
    }
    onIsolate(null);
    onLayers(filters);
  };
  $('fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      $('fullscreen').textContent = 'Fullscreen unavailable';
    }
  };
  addEventListener('keydown', (e) => {
    if (e.target.closest('input,select,textarea,button') || e.ctrlKey || e.metaKey || e.altKey)
      return;
    if (e.key === 'Escape') {
      onInspect(null);
      for (const name of ['layers', 'more']) {
        $('' + name + '-panel').hidden = true;
        $('' + name + '-toggle').setAttribute('aria-expanded', 'false');
      }
    }
    if (
      state?.scene.steps.length &&
      e.key === 'ArrowRight' &&
      state.step < state.scene.steps.length - 1
    )
      go(state.step + 1);
    if (state?.scene.steps.length && e.key === 'ArrowLeft' && state.step >= 0) go(state.step - 1);
  });
  return {
    filters,
    selection(id) {
      selected = id;
      $('zoom-selection').hidden = !id;
      $('isolate-selection').hidden = !id;
    },
    render(next) {
      state = next;
      const steps = state.scene.steps;
      $('walkthrough').hidden = !steps.length;
      $('step-progress').textContent =
        state.step < 0 ? 'Overview' : 'Step ' + (state.step + 1) + ' of ' + steps.length;
      $('step-overview').disabled = state.step < 0;
      $('step-previous').disabled = state.step < 0;
      $('step-next').disabled = state.step >= steps.length - 1;
      $('step-picker').replaceChildren();
      for (const [index, title] of [[-1, 'Overview'], ...steps.map((s, i) => [i, s.title])]) {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = title;
        $('step-picker').append(option);
      }
      $('step-picker').value = state.step;
    },
  };
}
