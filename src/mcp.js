import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { VERSION } from './version.js';
import { sceneFields, cameraFields } from './schema.js';
import { request, getPort, canvasUrl } from './client.js';
import { startServer } from './server.js';
import { ensureServer } from './ensure-server.js';
import { shapeNames } from '../web/geometry.js';
import { textScene } from './text-scene.js';

export async function startMcp() {
  let ownedServer;
  if (process.env.DREAM_FORGE_SERVER_MODE === 'process') {
    ownedServer = await startServer(getPort());
  } else await ensureServer();
  const defaultId = process.env.DREAM_FORGE_SESSION || randomUUID();
  if (!(await request('sessions')).sessions.some((s) => s.id === defaultId))
    await request('sessions', { id: defaultId, name: 'Agent session' });
  const server = new McpServer(
    { name: 'dream-forge', version: VERSION },
    {
      instructions:
        'For simple letters/text, create_session then show_text; it generates and validates glyphs internally, so no schema lookup or generator is needed. Before composing custom scenes, call get_capabilities. Each conversation needs its own create_session and must pass the returned session_id on subsequent tools, especially if the host shares an MCP process across conversations. Fresh sessions start empty. Use validate_scene for custom scene preflight and assembly.mode for morph versus dissolve.',
    },
  );
  const wrap = (handler) => async (args) => {
    try {
      const { session_id = defaultId, ...input } = args;
      const scoped = (path, body) => request(path, body, getPort(), session_id);
      const value = await handler(input, scoped);
      const resultSession = value.session?.id || session_id;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ url: canvasUrl(resultSession), ...value }),
          },
        ],
      };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  };
  server.registerTool(
    'show_text',
    {
      description:
        'Fast path for particle letters or short text: generates, validates and displays glyphs without custom code or a full schema lookup. Supports A–Z, 0–9, spaces, newlines and - . ? !; lowercase becomes uppercase. Up to 144 characters within 12 rows of 8. Use a fresh conversation session_id or your retained ID. Returns a compact result and canvas URL.',
      inputSchema: { text: z.string().min(1).max(144), session_id: z.string().optional() },
    },
    wrap(async (args, scoped) => {
      const state = await scoped('scene', textScene(args.text));
      return {
        session: state.session,
        title: state.scene.title,
        rows: state.scene.objects.map((object) => object.description),
        revision: state.revision,
      };
    }),
  );
  server.registerTool(
    'show_scene',
    {
      description: `Assemble a centered 3D particle construct. Replaces the complete scene. Shapes: ${shapeNames.join(', ')}. pointcloud requires a points array of local [x,y,z] coordinates. Rotation is Euler XYZ in radians. Use stable IDs, positions, labels, and explanations.`,
      inputSchema: { ...sceneFields, session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('scene', args)),
  );
  server.registerTool(
    'focus_object',
    {
      description: 'Move the canvas camera toward an object. Use null to frame the entire scene.',
      inputSchema: { id: z.string().nullable(), session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('focus', args)),
  );
  server.registerTool(
    'clear_canvas',
    {
      description: 'Dissolve constructs into the idle particle field.',
      inputSchema: { session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('clear', {})),
  );
  server.registerTool(
    'get_scene',
    {
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      description: 'Read the current scene and focused object before updating it.',
      inputSchema: { session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('state')),
  );
  server.registerTool(
    'set_camera',
    {
      description:
        'Present a construct from front, back, left, right, top, bottom, or isometric. Automatically fits the selected target_id (null means all). zoom is relative to auto-fit: 1 fits, 2 is twice as close, 0.5 is wider. Optional absolute yaw/pitch in degrees override the preset. auto_rotate enables orbit at speed degrees/second. transition sets seconds (0 snaps). Replaces camera settings; does not modify geometry. Manual browser movement interrupts the presentation; get_scene reports requested settings, not the user-adjusted camera pose.',
      inputSchema: { ...cameraFields, session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('camera', args)),
  );
  server.registerTool(
    'go_to_step',
    {
      description:
        'Navigate an authored scene sequence. index is zero-based; -1 returns to the overview. Step snapshots can define their own controls and camera settings.',
      inputSchema: { index: z.number().int().min(-1).max(19), session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('step', args)),
  );
  server.registerTool(
    'activate_action',
    {
      description:
        'Activate an agent-authored scene button by id. Human clicks use the same validated actions. get_scene includes the last 32 interaction events; notify records an intent for the agent to read but does not automatically wake it.',
      inputSchema: { id: z.string(), session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('action', args)),
  );
  server.registerTool(
    'create_session',
    {
      description:
        'Create a fresh empty canvas for a conversation. Keep the returned session.id and URL; pass session_id on every subsequent tool. Do not create a new session for each reply.',
      inputSchema: { name: z.string().min(1).max(120).optional() },
    },
    wrap((args) => request('sessions', args)),
  );
  server.registerTool(
    'get_capabilities',
    {
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      description:
        'Read once before using Dream Forge: complete JSON schema, semantic validation rules, all shapes, cameras, actions, steps, session isolation, redraw modes, history, limits, and recommended workflow.',
      inputSchema: {},
    },
    wrap(() => request('capabilities')),
  );
  server.registerTool(
    'list_sessions',
    {
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      description:
        'List saved local canvases and their IDs. Resume one only when requested; otherwise create a fresh session. Pass its id as session_id and open the corresponding URL.',
      inputSchema: {},
    },
    wrap(() => request('sessions')),
  );
  server.registerTool(
    'validate_scene',
    {
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      description:
        'Validate and normalize a full scene without changing the canvas or history. Checks geometry and cross-references. A valid scene still needs visual review.',
      inputSchema: { ...sceneFields, session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('validate', args)),
  );
  server.registerTool(
    'list_history',
    {
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      description:
        'List this session?s saved scene/step snapshots. Use restore_history with an entry id to return to it.',
      inputSchema: { session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('history')),
  );
  server.registerTool(
    'restore_history',
    {
      description:
        'Restore a saved scene and camera from this session without deleting newer history.',
      inputSchema: { id: z.string(), session_id: z.string().optional() },
    },
    wrap((args, scoped) => scoped('restore', args)),
  );
  await server.connect(new StdioServerTransport());
  console.error(`Dream Forge canvas: ${canvasUrl(defaultId)}`);
  process.stdin.on('end', () => {
    ownedServer?.closeAllConnections();
    ownedServer?.close();
  });
}
