import * as THREE from 'three';

const PRESETS = {
  front: [0, 0],
  back: [180, 0],
  left: [-90, 0],
  right: [90, 0],
  top: [0, 89.5],
  bottom: [0, -89.5],
  isometric: [45, 30],
};

/** Owns camera presentation independently of particles, DOM, and transport. */
export function createCameraController(camera, controls) {
  let destination = null;
  let lookAt = null;
  let transitionRate = 4;
  let presenting = false;

  function interrupt() {
    destination = null;
    lookAt = null;
    presenting = false;
    controls.autoRotate = false;
  }

  function fit(bounds, area, settings = {}, paused = false) {
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const [presetYaw, presetPitch] = PRESETS[settings.view || 'front'];
    const yaw = THREE.MathUtils.degToRad(settings.yaw ?? presetYaw);
    const pitch = THREE.MathUtils.degToRad(settings.pitch ?? presetPitch);
    const direction = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const up = new THREE.Vector3().crossVectors(direction, right);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let fittedDistance = 4;
    for (const x of [-0.5, 0.5])
      for (const y of [-0.5, 0.5])
        for (const z of [-0.5, 0.5]) {
          const corner = new THREE.Vector3(size.x * x, size.y * y, size.z * z);
          const depth = corner.dot(direction);
          fittedDistance = Math.max(
            fittedDistance,
            depth +
              ((Math.abs(corner.dot(right)) * area.viewportHeight) / area.width / tanHalf) * 1.08,
            depth +
              ((Math.abs(corner.dot(up)) * area.viewportHeight) / area.height / tanHalf) * 1.08,
          );
        }
    const distance = Math.max(2, fittedDistance / (settings.zoom || 1));
    controls.maxDistance = Math.max(100000, distance * 10);
    camera.far = Math.max(1000, distance * 6);
    camera.updateProjectionMatrix();
    lookAt = center;
    destination = center.clone().addScaledVector(direction, distance);
    transitionRate = 4 / Math.max(0.05, settings.transition ?? 0.8);
    presenting = Boolean(settings.auto_rotate);
    controls.autoRotate = false;
    controls.autoRotateSpeed = (settings.speed ?? 15) / 6;
    if (paused || settings.transition === 0) {
      camera.position.copy(destination);
      controls.target.copy(center);
      destination = null;
      lookAt = null;
    }
  }

  function update(delta, paused) {
    if (destination) {
      const blend = 1 - Math.exp(-delta * transitionRate);
      const offset = camera.position.clone().sub(controls.target);
      const desired = destination.clone().sub(lookAt);
      const turn = new THREE.Quaternion().setFromUnitVectors(
        offset.clone().normalize(),
        desired.clone().normalize(),
      );
      offset
        .applyQuaternion(new THREE.Quaternion().slerp(turn, blend))
        .setLength(THREE.MathUtils.lerp(offset.length(), desired.length(), blend));
      controls.target.lerp(lookAt, blend);
      camera.position.copy(controls.target).add(offset);
      if (camera.position.distanceTo(destination) < 0.01) {
        destination = null;
        lookAt = null;
      }
    }
    controls.autoRotate = presenting && !paused && !destination;
    controls.update(delta);
    const far = Math.max(camera.far, camera.position.distanceTo(controls.target) * 2 + 100);
    if (far !== camera.far) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  }

  return { fit, update, interrupt };
}
