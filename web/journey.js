import * as THREE from 'three';

/** Plays only an explicitly authored traffic path; never invents a route from graph order. */
export function createJourney({ scene, texture, onHighlight }) {
  const $ = (id) => document.getElementById(id);
  const marker = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: '#fff0bb',
      size: 0.65,
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  marker.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  marker.frustumCulled = false;
  marker.visible = false;
  scene.add(marker);
  let journey,
    curves = [],
    objects = [],
    elapsed = 0,
    playing = false,
    complete = false,
    visible = true;
  function status() {
    $('journey-play').textContent = playing
      ? 'Pause request'
      : complete
        ? 'Play again'
        : elapsed > 0
          ? 'Resume request'
          : 'Play request';
  }
  function reset() {
    elapsed = 0;
    complete = false;
    marker.visible = false;
    onHighlight(null);
    status();
  }
  $('journey-play').onclick = () => {
    if (complete) reset();
    playing = !playing;
    status();
  };
  $('journey-replay').onclick = () => {
    reset();
    playing = true;
    status();
  };
  return {
    set(snapshot, flows) {
      journey = snapshot.journey;
      objects = snapshot.objects;
      playing = false;
      curves = [];
      reset();
      $('journey-controls').hidden = !journey;
      $('journey-status').textContent = journey?.label || '';
      if (journey)
        for (let i = 1; i < journey.path.length; i++)
          curves.push(
            flows.find(
              (f) =>
                f.userData.connection.kind === 'traffic' &&
                f.userData.connection.from === journey.path[i - 1] &&
                f.userData.connection.to === journey.path[i],
            ).userData.curve,
          );
    },
    visibility(value) {
      visible = value;
      $('journey-controls').hidden = !journey || !visible;
      if (complete && visible) marker.visible = true;
      if (!value) {
        marker.visible = false;
        onHighlight(null);
      }
    },
    update(dt, paused) {
      if (!journey || !visible || complete) return;
      if (playing && !paused) elapsed += dt * Number($('journey-speed').value);
      const hop = Math.min(curves.length - 1, Math.floor(elapsed / journey.seconds_per_hop));
      if (playing || elapsed > 0) {
        const progress = Math.min(
          1,
          (elapsed - hop * journey.seconds_per_hop) / journey.seconds_per_hop,
        );
        marker.geometry.attributes.position.setXYZ(0, ...curves[hop].getPoint(progress).toArray());
        marker.geometry.attributes.position.needsUpdate = true;
        marker.visible = true;
        const id = journey.path[progress < 0.5 ? hop : hop + 1];
        onHighlight(id);
        $('journey-status').textContent =
          (objects.find((o) => o.id === journey.path[hop])?.label || journey.path[hop]) +
          ' → ' +
          (objects.find((o) => o.id === journey.path[hop + 1])?.label || journey.path[hop + 1]);
      }
      if (elapsed >= curves.length * journey.seconds_per_hop && playing) {
        playing = false;
        complete = true;
        $('journey-status').textContent = 'Request complete';
        status();
      }
    },
  };
}
