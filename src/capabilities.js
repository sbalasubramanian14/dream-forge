import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { sceneSchema } from './schema.js';
import { VERSION } from './version.js';

export async function getCapabilities() {
  return {
    version: VERSION,
    scene_schema: z.toJSONSchema(sceneSchema),
    guide: await readFile(
      new URL('../skills/dream-forge/references/scenes.md', import.meta.url),
      'utf8',
    ),
    limits: {
      objects: 24,
      connections: 48,
      actions: 24,
      steps: 20,
      points_per_object: 12000,
      payload_bytes: 1048576,
      history_entries: 50,
      history_bytes: 16777216,
    },
    validation_rules: [
      'Unique object and action IDs per snapshot.',
      'Connections, camera targets, and action targets must exist in their active snapshot.',
      'pointcloud requires points; other shapes must not supply points.',
      'Screen controls require normalized position; object controls require object_id.',
      'goto must reference an authored step or overview (-1). Inherited actions must remain valid in every step.',
      'Object parent_id references another object in the same snapshot; the hierarchy must be acyclic.',
      'Journey paths require existing objects and a directed traffic connection for each consecutive hop.',
    ],
    workflow:
      'Read this guide once. Create one fresh session per conversation and pass its session_id on every tool call. Validate the complete scene, then show it. Preserve IDs for morphs. Use history to restore earlier scenes. A successful tool response validates acceptance, not visual quality.',
  };
}
