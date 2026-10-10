import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { request, getPort } from './client.js';
import { VERSION } from './version.js';

/** A shared daemon survives individual MCP clients so other session canvases stay available. */
export async function ensureServer() {
  const check = async () => {
    const health = await request('health');
    if (health.app !== 'dream-forge') throw new Error('Port is occupied by another application');
    if (health.version !== VERSION)
      throw new Error(`Restart the Dream Forge server to use version ${VERSION}`);
  };
  try {
    await check();
    return;
  } catch (error) {
    if (!error.cause) throw error;
  }
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('../bin/dream-forge.js', import.meta.url)), 'start'],
    { detached: true, windowsHide: true, stdio: 'ignore', env: { ...process.env } },
  );
  let launchError;
  child.on('error', (error) => {
    launchError = error;
  });
  child.unref();
  for (let i = 0; i < 60; i++) {
    if (launchError) throw launchError;
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      await check();
      return;
    } catch (error) {
      if (!error.cause) throw error;
    }
  }
  throw new Error(
    `Unable to start Dream Forge on port ${getPort()}. Run npm start to inspect the error.`,
  );
}
