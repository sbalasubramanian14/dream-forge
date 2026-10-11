import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export const canvasTools = [
  'get_capabilities',
  'get_scene',
  'validate_scene',
  'list_sessions',
  'list_history',
  'create_session',
  'show_text',
  'show_scene',
  'focus_object',
  'set_camera',
  'go_to_step',
  'activate_action',
  'clear_canvas',
  'restore_history',
];

/** Explicit opt-in: update only local Dream Forge canvas permissions, preserving other config. */
export async function approveCanvasTools(
  configPath = resolve(process.env.CODEX_HOME || resolve(homedir(), '.codex'), 'config.toml'),
) {
  let config = await readFile(configPath, 'utf8');
  for (const tool of canvasTools) {
    const heading = `[mcp_servers.dream-forge.tools.${tool}]`;
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = new RegExp(`^${escaped}[^\\n]*\\n([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`, 'm');
    const match = config.match(block);
    if (match) {
      const content = /^\s*approval_mode\s*=.*$/m.test(match[1])
        ? match[1].replace(/^\s*approval_mode\s*=.*$/m, 'approval_mode = "approve"')
        : `approval_mode = "approve"\n${match[1]}`;
      config = config.replace(block, `${heading}\n${content}`);
    } else {
      if (
        new RegExp(
          `^\\[mcp_servers\\.(?:"dream-forge"|'dream-forge')\\.tools\\.${tool}\\]`,
          'm',
        ).test(config)
      )
        throw new Error(`Quoted policy for ${tool} exists. Review it manually before opting in.`);
      config += `\n${heading}\napproval_mode = "approve"\n`;
    }
  }
  await writeFile(configPath, config);
  return configPath;
}
