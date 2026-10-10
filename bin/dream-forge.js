#!/usr/bin/env node
import { readFile, mkdir, cp, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';
import { request, getPort, canvasUrl } from '../src/client.js';
import { constructs } from '../web/catalog.js';

const [command = 'help', ...args] = process.argv.slice(2);
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const sessionFlag = args.indexOf('--session');
  if (sessionFlag >= 0) {
    if (!args[sessionFlag + 1]) throw new Error('--session requires an ID');
    process.env.DREAM_FORGE_SESSION = args[sessionFlag + 1];
    args.splice(sessionFlag, 2);
  }
  if (command === 'start') {
    await startServer(getPort());
    console.log(
      `Dream Forge is ready at http://127.0.0.1:${getPort()}\nKeep this terminal open. Ctrl+C stops the canvas.`,
    );
  } else if (command === 'stop') {
    console.log(JSON.stringify(await request('shutdown', {})));
  } else if (command === 'mcp') {
    const { startMcp } = await import('../src/mcp.js');
    await startMcp();
  } else if (command === 'session') {
    if (args[0] === 'new') {
      const state = await request('sessions', { name: args.slice(1).join(' ') || 'Agent canvas' });
      console.log(
        JSON.stringify(
          { session_id: state.session.id, url: canvasUrl(state.session.id), ...state },
          null,
          2,
        ),
      );
    } else if (args[0] === 'list') console.log(JSON.stringify(await request('sessions'), null, 2));
    else throw new Error('Usage: dream-forge session <new [name]|list>');
  } else if (command === 'capabilities') {
    console.log(JSON.stringify(await request('capabilities'), null, 2));
  } else if (command === 'validate') {
    if (!args[0]) throw new Error('Usage: dream-forge validate <scene.json>');
    const { sceneSchema } = await import('../src/schema.js');
    sceneSchema.parse(JSON.parse(await readFile(resolve(args[0]), 'utf8')));
    console.log('Scene valid. Canvas and history unchanged.');
  } else if (command === 'history') {
    console.log(JSON.stringify(await request('history'), null, 2));
  } else if (command === 'restore') {
    if (!args[0]) throw new Error('Usage: dream-forge restore <history-id> [--session ID]');
    console.log(JSON.stringify(await request('restore', { id: args[0] }), null, 2));
  } else if (command === 'show') {
    if (!args[0]) throw new Error('Usage: dream-forge show <scene.json>');
    console.log(
      JSON.stringify(
        await request('scene', JSON.parse(await readFile(resolve(args[0]), 'utf8'))),
        null,
        2,
      ),
    );
  } else if (command === 'demo') {
    const name = args[0] || 'architecture';
    if (!constructs.some((c) => c.id === name))
      throw new Error(`Demo must be ${constructs.map((c) => c.id).join(', ')}`);
    console.log(
      JSON.stringify(
        await request('scene', JSON.parse(await readFile(`${root}/examples/${name}.json`, 'utf8'))),
        null,
        2,
      ),
    );
  } else if (command === 'focus') {
    if (!args[0]) throw new Error('Usage: dream-forge focus <object-id|all>');
    console.log(JSON.stringify(await request('focus', { id: args[0] === 'all' ? null : args[0] })));
  } else if (command === 'camera') {
    if (!args[0])
      throw new Error('Usage: dream-forge camera <view|camera.json> [zoom] [target-id]');
    const settings = args[0].endsWith('.json')
      ? JSON.parse(await readFile(resolve(args[0]), 'utf8'))
      : {
          view: args[0],
          zoom: args[1] === undefined ? 1 : Number(args[1]),
          target_id: args[2] || null,
        };
    console.log(JSON.stringify(await request('camera', settings), null, 2));
  } else if (command === 'clear') {
    console.log(JSON.stringify(await request('clear', {})));
  } else if (command === 'status') {
    console.log(JSON.stringify(await request('state'), null, 2));
  } else if (command === 'install-skill') {
    const agent = args[0];
    const scope = args[1] || 'project';
    if (!['codex', 'claude'].includes(agent) || !['project', 'user'].includes(scope))
      throw new Error('Usage: dream-forge install-skill <codex|claude> [project|user]');
    const base = scope === 'user' ? homedir() : process.cwd();
    const folder = agent === 'claude' ? '.claude' : '.agents';
    const target = resolve(base, folder, 'skills', 'dream-forge');
    let exists = false;
    try {
      await access(target);
      exists = true;
    } catch {}
    const update = args.includes('--update');
    if (exists && !update)
      throw new Error(`Skill already exists at ${target}. Remove or update it explicitly.`);
    await mkdir(resolve(base, folder, 'skills'), { recursive: true });
    await cp(`${root}/skills/dream-forge`, target, {
      recursive: true,
      errorOnExist: !update,
      force: update,
    });
    console.log(`Installed Dream Forge skill at ${target}`);
  } else if (command === 'help' || command === '--help') {
    console.log(
      'Dream Forge\n\nstart                   Serve the local canvas\nstop                    Stop the server on this port (all canvases)\nmcp                     Start stdio MCP and a canvas if needed\nshow <scene.json>       Replace the scene\ndemo <portal|tree|mechanism|orbits|rocket|architecture|helix|solar-system|walkthrough>\ncamera <view|file.json> [zoom] [target-id]\nfocus <id|all>          Focus an object or frame all\nclear                   Dissolve into the idle field\nstatus                  Read the current scene\nsession new [name]     Create an empty isolated canvas\nsession list           List canvases\ncapabilities           Read the full agent guide and schema\nvalidate <scene.json>  Check before drawing\nhistory                List saved scenes\nrestore <history-id>   Restore a saved scene\ninstall-skill <codex|claude> [project|user] [--update]\n\nUse --session ID on scene commands, or set DREAM_FORGE_SESSION. DREAM_FORGE_PORT sets the port (default 4317).',
    );
  } else {
    throw new Error(`Unknown command: ${command}. Run dream-forge --help.`);
  }
} catch (error) {
  console.error(
    `Dream Forge: ${error.message}${error.cause ? '. Start the canvas with dream-forge start.' : ''}`,
  );
  process.exitCode = 1;
}
