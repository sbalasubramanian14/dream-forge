#!/usr/bin/env node
import { readFile, mkdir, cp, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server.js';
import { request, getPort } from '../src/client.js';

const [command = 'help', ...args] = process.argv.slice(2);
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  if (command === 'start') {
    await startServer(getPort());
    console.log(`Dream Forge is ready at http://127.0.0.1:${getPort()}\nKeep this terminal open. Ctrl+C stops the canvas.`);
  } else if (command === 'mcp') {
    const {startMcp} = await import('../src/mcp.js'); await startMcp();
  } else if (command === 'show') {
    if (!args[0]) throw new Error('Usage: dream-forge show <scene.json>');
    console.log(JSON.stringify(await request('scene', JSON.parse(await readFile(resolve(args[0]), 'utf8'))), null, 2));
  } else if (command === 'demo') {
    const name = args[0] || 'architecture';
    if (!['architecture', 'portal', 'helix'].includes(name)) throw new Error('Demo must be architecture, portal, or helix');
    console.log(JSON.stringify(await request('scene', JSON.parse(await readFile(`${root}/examples/${name}.json`, 'utf8'))), null, 2));
  } else if (command === 'focus') {
    if (!args[0]) throw new Error('Usage: dream-forge focus <object-id|all>');
    console.log(JSON.stringify(await request('focus', {id: args[0] === 'all' ? null : args[0]})));
  } else if (command === 'clear') {console.log(JSON.stringify(await request('clear', {})));}
  else if (command === 'status') {console.log(JSON.stringify(await request('state'), null, 2));}
  else if (command === 'install-skill') {
    const agent = args[0]; const scope = args[1] || 'project';
    if (!['codex', 'claude'].includes(agent) || !['project', 'user'].includes(scope)) throw new Error('Usage: dream-forge install-skill <codex|claude> [project|user]');
    const base = scope === 'user' ? homedir() : process.cwd();
    const folder = agent === 'claude' ? '.claude' : '.agents';
    const target = resolve(base, folder, 'skills', 'dream-forge');
    let exists = false; try {await access(target); exists = true;} catch {}
    if (exists) throw new Error(`Skill already exists at ${target}. Remove or update it explicitly.`);
    await mkdir(resolve(base, folder, 'skills'), {recursive: true});
    await cp(`${root}/skills/dream-forge`, target, {recursive: true, errorOnExist: true, force: false});
    console.log(`Installed Dream Forge skill at ${target}`);
  } else if (command === 'help' || command === '--help') {
    console.log('Dream Forge\n\nstart                   Serve the local canvas\nmcp                     Start stdio MCP and a canvas if needed\nshow <scene.json>       Replace the scene\ndemo [architecture|portal|helix]\nfocus <id|all>          Focus an object or frame all\nclear                   Dissolve into the idle field\nstatus                  Read the current scene\ninstall-skill <codex|claude> [project|user]\n\nDREAM_FORGE_PORT sets the port (default 4317).');
  } else {throw new Error(`Unknown command: ${command}. Run dream-forge --help.`);}
} catch (error) {console.error(`Dream Forge: ${error.message}${error.cause ? '. Start the canvas with dream-forge start.' : ''}`); process.exitCode = 1;}
