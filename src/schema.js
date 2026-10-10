import { z } from 'zod';
import { shapeNames } from '../web/geometry.js';

const vector = z.tuple([
  z.number().min(-100).max(100),
  z.number().min(-100).max(100),
  z.number().min(-100).max(100),
]);
export const cameraFields = {
  view: z.enum(['front', 'back', 'left', 'right', 'top', 'bottom', 'isometric']).default('front'),
  target_id: z.string().nullable().default(null),
  yaw: z.number().min(-360).max(360).optional(),
  pitch: z.number().min(-89.5).max(89.5).optional(),
  zoom: z.number().min(0.1).max(10).default(1),
  auto_rotate: z.boolean().default(false),
  speed: z.number().min(-90).max(90).default(15),
  transition: z.number().min(0).max(5).default(0.8),
};
export const cameraSchema = z.object(cameraFields).strict();
export const defaultCamera = () => cameraSchema.parse({});
export const objectSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .max(64),
    shape: z.enum(shapeNames),
    label: z.string().max(120).default(''),
    show_label: z.boolean().default(true),
    description: z.string().max(2000).default(''),
    position: vector.default([0, 0, 0]),
    scale: z.number().min(0.1).max(12).default(1),
    rotation: vector.default([0, 0, 0]),
    points: z.array(vector).min(1).max(12000).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#70e0ed'),
  })
  .strict();
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('camera'), settings: cameraSchema }).strict(),
  z.object({ type: z.literal('focus'), object_id: z.string().nullable() }).strict(),
  z.object({ type: z.literal('next') }).strict(),
  z.object({ type: z.literal('previous') }).strict(),
  z.object({ type: z.literal('goto'), index: z.number().int().min(0).max(19) }).strict(),
  z.object({ type: z.literal('clear') }).strict(),
  z.object({ type: z.literal('notify'), message: z.string().min(1).max(500) }).strict(),
]);
export const interactionSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .max(64),
    label: z.string().min(1).max(80),
    placement: z.enum(['toolbar', 'object', 'screen']).default('toolbar'),
    object_id: z.string().optional(),
    position: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
    disabled: z.boolean().default(false),
    action: actionSchema,
  })
  .strict();
const snapshotFields = {
  assembly: z
    .object({
      mode: z.enum(['morph', 'dissolve']).default('morph'),
      duration: z.number().min(0.2).max(8).default(1.6),
    })
    .strict()
    .default({ mode: 'morph', duration: 1.6 }),
  title: z.string().max(160).default('Untitled construct'),
  explanation: z.string().max(4000).default(''),
  objects: z.array(objectSchema).max(24),
  connections: z
    .array(
      z
        .object({
          from: z.string(),
          to: z.string(),
          label: z.string().max(120).default(''),
        })
        .strict(),
    )
    .max(48)
    .default([]),
  actions: z.array(interactionSchema).max(24).optional(),
  camera: cameraSchema.optional(),
};
export const sceneFields = {
  ...snapshotFields,
  steps: z.array(z.object(snapshotFields).strict()).max(20).default([]),
};
export const sceneSchema = z
  .object(sceneFields)
  .strict()
  .superRefine((scene, ctx) => {
    function validateSnapshot(snapshot, inheritedActions = []) {
      const actions = snapshot.actions ?? inheritedActions;
      const ids = new Set(snapshot.objects.map((o) => o.id));
      if (ids.size !== snapshot.objects.length)
        ctx.addIssue({ code: 'custom', message: 'Object IDs must be unique' });
      for (const c of snapshot.connections) {
        if (!ids.has(c.from) || !ids.has(c.to))
          ctx.addIssue({
            code: 'custom',
            message: 'Connections must reference existing object IDs',
          });
      }
      for (const object of snapshot.objects) {
        if (object.shape === 'pointcloud' && !object.points)
          ctx.addIssue({ code: 'custom', message: 'pointcloud requires points' });
        if (object.shape !== 'pointcloud' && object.points)
          ctx.addIssue({ code: 'custom', message: 'points are only supported for pointcloud' });
      }
      if (new Set(actions.map((a) => a.id)).size !== actions.length)
        ctx.addIssue({ code: 'custom', message: 'Action IDs must be unique in each step' });
      const checkTarget = (id) => {
        if (id != null && !ids.has(id))
          ctx.addIssue({
            code: 'custom',
            message: 'Action or camera target must reference an existing object',
          });
      };
      checkTarget(snapshot.camera?.target_id);
      for (const interaction of actions) {
        if (interaction.placement === 'object') {
          if (!interaction.object_id)
            ctx.addIssue({ code: 'custom', message: 'Object hotspot requires object_id' });
          checkTarget(interaction.object_id);
        }
        if (interaction.placement === 'screen' && !interaction.position)
          ctx.addIssue({ code: 'custom', message: 'Screen button requires normalized position' });
        if (interaction.action.type === 'camera')
          checkTarget(interaction.action.settings.target_id);
        if (interaction.action.type === 'focus') checkTarget(interaction.action.object_id);
        if (interaction.action.type === 'goto' && interaction.action.index >= scene.steps.length)
          ctx.addIssue({ code: 'custom', message: 'Step index is outside the authored sequence' });
      }
    }
    validateSnapshot(scene);
    for (const step of scene.steps) validateSnapshot(step, scene.actions);
  });
export const emptyScene = () =>
  sceneSchema.parse({
    title: 'A space for your next thought',
    explanation:
      'Connect an agent, or try a construct below. Every point is waiting to become something.',
    objects: [],
  });
