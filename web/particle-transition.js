/** Timed particle transitions; redraws can morph directly or disperse before reforming. */
const IDLE_COLOR = [0.16, 0.38, 0.48];
export function createParticleTransition({ positions, targets, colors, desiredColors, idle }) {
  let sourcePositions = positions.slice();
  let sourceColors = colors.slice();
  let elapsed = 0;
  let duration = 1.6;
  let mode = 'morph';
  let active = false;
  const ease = (value) => value * value * (3 - 2 * value);

  function begin(settings, paused) {
    mode = settings?.mode || 'morph';
    duration = settings?.duration || 1.6;
    elapsed = 0;
    sourcePositions = positions.slice();
    sourceColors = colors.slice();
    active = !paused;
    if (paused) {
      positions.set(targets);
      colors.set(desiredColors);
    }
  }

  function update(delta, paused, time, empty) {
    if (paused) return active ? 'paused' : 'settled';
    if (active) {
      elapsed = Math.min(duration, elapsed + delta);
      const progress = elapsed / duration;
      const dissolving = mode === 'dissolve' && progress < 0.5;
      const amount = ease(
        mode === 'dissolve' ? (dissolving ? progress * 2 : (progress - 0.5) * 2) : progress,
      );
      for (let i = 0; i < positions.length; i++) {
        const from = mode === 'dissolve' && !dissolving ? idle[i] : sourcePositions[i];
        const to = dissolving ? idle[i] : targets[i];
        positions[i] = from + (to - from) * amount;
        const startColor = mode === 'dissolve' && !dissolving ? IDLE_COLOR[i % 3] : sourceColors[i];
        const endColor = dissolving ? IDLE_COLOR[i % 3] : desiredColors[i];
        colors[i] = startColor + (endColor - startColor) * amount;
      }
      active = progress < 1;
      return active
        ? dissolving
          ? 'dissolving'
          : mode === 'dissolve'
            ? 'reforming'
            : 'morphing'
        : 'settled';
    }
    if (empty) {
      const blend = 1 - Math.exp(-delta * 2.8);
      for (let i = 0; i < positions.length; i++) {
        const drift = Math.sin(time * 0.2 + Math.floor(i / 3) * 0.02 + (i % 3)) * 0.18;
        positions[i] += (idle[i] + drift - positions[i]) * blend;
      }
    }
    return 'settled';
  }
  return { begin, update };
}
