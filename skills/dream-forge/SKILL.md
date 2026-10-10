---
name: dream-forge
description: Build interactive 3D particle explanations in Dream Forge, with an isolated canvas per conversation, camera control, authored actions, redraw transitions, and saved history. Use when the user asks for Dream Forge or an explorable spatial explanation; requires MCP tools or the local CLI.
---

# Dream Forge

Dream Forge displays agent-authored procedural particles, not arbitrary text-to-3D assets or Gaussian reconstructions. Keep the user-facing explanation truthful about illustrative scale and omitted details.

## Start once per conversation

With MCP, call `get_capabilities` once before composing. It returns the current complete JSON schema, semantic rules, limits, and this feature guide. Call `create_session` with a meaningful name, retain its `session.id`, and pass it as `session_id` on every subsequent tool call. Open or link the returned URL. Do not create another session for every reply, reuse a different conversation's canvas, or assume one MCP process always represents one chat. To resume a requested existing canvas, use `list_sessions` and retain its ID instead.

With shell access, locate the installed repository and use `node <absolute-repo-path>/bin/dream-forge.js`. Start the server if needed, call `session new <name>` once, and pass `--session <returned-id>` on every scene/camera/history command. `capabilities` exposes the same guide. The unscoped CLI and bare localhost URL use the shared `local` sandbox; avoid those in concurrent agent conversations.

## Compose in one pass

Read [references/scenes.md](references/scenes.md) for the full scene contract, cameras, actions, steps, history, and transitions. Choose a few readable semantic objects before expanding. Position every object explicitly; omitted positions overlap at the origin. Use stable IDs across revisions to preserve particle continuity. Build custom geometry as `pointcloud` data when built-in shapes are insufficient. Labels, descriptions, and controls should explain the construct rather than expose implementation details.

Validate the complete payload with `validate_scene` and the same session ID before `show_scene`. Shell equivalent: `validate scene.json`, then `show scene.json --session <id>`. Fix all reported semantic errors together. Showing a scene replaces it entirely; omitted objects disappear. A tool success confirms acceptance, not visual quality. Inspect a screenshot when browser tools are available.

Choose `assembly: {mode: "morph", duration: 1.6}` for direct reshaping, or `mode: "dissolve"` to disperse and rebuild. These also apply to step snapshots. Do not clear the canvas before every revision: history and transitions already handle replacement. Fresh sessions start empty, and `clear_canvas` keeps earlier history.

Use camera tools to present an appropriate view and focus. All-camera framing is preferable for an overview; focus a part for detailed discussion. Let human input interrupt agent orbit. Author actions and steps when they help exploration; object hotspots avoid geometry and label collisions, while screen controls keep their authored positions. Tiny objects use compact markers with hover/focus names.

## Continue the same canvas

Read `get_scene` before expanding an explanation. It includes the active step, requested camera, session metadata, history summaries, and the last 32 interactions. Use `list_history` and `restore_history` for earlier scenes; restoration keeps newer history available. `notify` records human intent without automatically waking the agent. Read those events when the user asks to act on a click.

Reply with the canvas URL and a brief explanation of the useful controls. Do not promise physical accuracy, measured geometry, current orbital positions, persistence outside the configured local store, or hidden reasoning visualization.
