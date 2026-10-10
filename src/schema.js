import { z } from 'zod';

const vector = z.tuple([z.number().min(-100).max(100), z.number().min(-100).max(100), z.number().min(-100).max(100)]);
export const objectSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(64),
  shape: z.enum(['sphere', 'box', 'torus', 'cylinder', 'cone', 'arch', 'helix']),
  label: z.string().max(120).default(''),
  description: z.string().max(2000).default(''),
  position: vector.default([0, 0, 0]),
  scale: z.number().min(0.1).max(12).default(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#70e0ed')
}).strict();
export const sceneFields = {
  title: z.string().max(160).default('Untitled construct'),
  explanation: z.string().max(4000).default(''),
  objects: z.array(objectSchema).max(24),
  connections: z.array(z.object({
    from: z.string(), to: z.string(), label: z.string().max(120).default('')
  }).strict()).max(48).default([])
};
export const sceneSchema = z.object(sceneFields).strict().superRefine((scene, ctx) => {
  const ids = new Set(scene.objects.map(o => o.id));
  if (ids.size !== scene.objects.length) ctx.addIssue({code: 'custom', message: 'Object IDs must be unique'});
  for (const c of scene.connections) {
    if (!ids.has(c.from) || !ids.has(c.to)) ctx.addIssue({code: 'custom', message: 'Connections must reference existing object IDs'});
  }
});
export const emptyScene = () => sceneSchema.parse({title: 'A space for your next thought', explanation: 'Connect an agent, or try a construct below. Every point is waiting to become something.', objects: []});
