import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { sceneFields, cameraFields } from './schema.js';
import { request, getPort } from './client.js';
import { startServer } from './server.js';
import { shapeNames } from '../web/geometry.js';

export async function startMcp() {
  let ownedServer;
  try {
    ownedServer = await startServer(getPort());
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    const health = await request('health');
    if (health.app !== 'dream-forge') throw new Error('Port is occupied by another application');
  }
  const server = new McpServer({ name: 'dream-forge', version: '0.3.0' });
  const wrap = (handler) => async (args) => {
    try {
      const value = await handler(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ url: `http://127.0.0.1:${getPort()}`, ...value }),
          },
        ],
      };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  };
  server.registerTool(
    'show_scene',
    {
      description: `Assemble a centered 3D particle construct. Replaces the complete scene. Shapes: ${shapeNames.join(', ')}. pointcloud requires a points array of local [x,y,z] coordinates. Rotation is Euler XYZ in radians. Use stable IDs, positions, labels, and explanations.`,
      inputSchema: sceneFields,
    },
    wrap((args) => request('scene', args)),
  );
  server.registerTool(
    'focus_object',
    {
      description: 'Move the canvas camera toward an object. Use null to frame the entire scene.',
      inputSchema: { id: z.string().nullable() },
    },
    wrap((args) => request('focus', args)),
  );
  server.registerTool(
    'clear_canvas',
    { description: 'Dissolve constructs into the idle particle field.', inputSchema: {} },
    wrap(() => request('clear', {})),
  );
  server.registerTool(
    'get_scene',
    {
      description: 'Read the current scene and focused object before updating it.',
      inputSchema: {},
    },
    wrap(() => request('state')),
  );
  server.registerTool(
    'set_camera',
    {
      description:
        'Present a construct from front, back, left, right, top, bottom, or isometric. Automatically fits the selected target_id (null means all). zoom is relative to auto-fit: 1 fits, 2 is twice as close, 0.5 is wider. Optional absolute yaw/pitch in degrees override the preset. auto_rotate enables orbit at speed degrees/second. transition sets seconds (0 snaps). Replaces camera settings; does not modify geometry. Manual browser movement interrupts the presentation; get_scene reports requested settings, not the user-adjusted camera pose.',
      inputSchema: cameraFields,
    },
    wrap((args) => request('camera', args)),
  );
  server.registerTool(
    'go_to_step',
    {
      description:
        'Navigate an authored scene sequence. index is zero-based; -1 returns to the overview. Step snapshots can define their own controls and camera settings.',
      inputSchema: { index: z.number().int().min(-1).max(19) },
    },
    wrap((args) => request('step', args)),
  );
  server.registerTool(
    'activate_action',
    {
      description:
        'Activate an agent-authored scene button by id. Human clicks use the same validated actions. get_scene includes the last 32 interaction events; notify records an intent for the agent to read but does not automatically wake it.',
      inputSchema: { id: z.string() },
    },
    wrap((args) => request('action', args)),
  );
  await server.connect(new StdioServerTransport());
  console.error(`Dream Forge canvas: http://127.0.0.1:${getPort()}`);
  process.stdin.on('end', () => {
    ownedServer?.closeAllConnections();
    ownedServer?.close();
  });
}
