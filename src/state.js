import { cameraSchema, defaultCamera, emptyScene, sceneSchema } from './schema.js';

/** Pure state transitions shared by HTTP commands and scene-authored actions. */
export function createState() {
  return {
    scene: emptyScene(),
    step: -1,
    focus: null,
    camera: defaultCamera(),
    camera_revision: 0,
    revision: 0,
    scene_revision: 0,
    interactions: [],
  };
}

export function activeScene(state) {
  const snapshot = state.step < 0 ? state.scene : state.scene.steps[state.step];
  return { ...snapshot, actions: snapshot.actions ?? state.scene.actions ?? [] };
}

export function replaceScene(state, input) {
  const scene = sceneSchema.parse(input);
  return {
    ...state,
    scene,
    step: -1,
    focus: scene.camera?.target_id ?? null,
    camera: scene.camera ?? defaultCamera(),
    camera_revision: state.camera_revision + 1,
    revision: state.revision + 1,
    scene_revision: state.scene_revision + 1,
    interactions: [],
  };
}

export function setCamera(state, input) {
  const camera = cameraSchema.parse(input);
  if (
    camera.target_id !== null &&
    !activeScene(state).objects.some((o) => o.id === camera.target_id)
  )
    throw new Error('Unknown camera target ID');
  return {
    ...state,
    camera,
    focus: camera.target_id,
    camera_revision: state.camera_revision + 1,
    revision: state.revision + 1,
  };
}

export function focusObject(state, id) {
  if (id !== null && !activeScene(state).objects.some((o) => o.id === id))
    throw new Error('Unknown object ID');
  return setCamera(state, { target_id: id });
}

export function goToStep(state, index) {
  if (!Number.isInteger(index) || index < -1 || index >= state.scene.steps.length)
    throw new Error('Step is outside the authored sequence');
  const snapshot = index < 0 ? state.scene : state.scene.steps[index];
  return {
    ...state,
    step: index,
    focus: snapshot.camera?.target_id ?? null,
    camera: snapshot.camera ?? defaultCamera(),
    camera_revision: state.camera_revision + 1,
    revision: state.revision + 1,
    scene_revision: state.scene_revision + 1,
  };
}

// Add an action type to this registry, the schema union, and its behavioral tests.
const actionHandlers = {
  camera: (state, action) => setCamera(state, action.settings),
  focus: (state, action) => focusObject(state, action.object_id),
  next: (state) => goToStep(state, state.step + 1),
  previous: (state) => goToStep(state, state.step - 1),
  goto: (state, action) => goToStep(state, action.index),
  clear: (state) => replaceScene(state, emptyScene()),
  notify: (state) => ({ ...state, revision: state.revision + 1 }),
};

export function performAction(state, id) {
  const interaction = activeScene(state).actions.find((a) => a.id === id);
  if (!interaction) throw new Error('Unknown action ID');
  if (interaction.disabled) throw new Error('Action is disabled');
  const next = actionHandlers[interaction.action.type](state, interaction.action);
  const event = {
    id,
    label: interaction.label,
    type: interaction.action.type,
    message: interaction.action.message ?? null,
    from_step: state.step,
    to_step: next.step,
    at: new Date().toISOString(),
  };
  return { ...next, interactions: [...state.interactions, event].slice(-32) };
}
