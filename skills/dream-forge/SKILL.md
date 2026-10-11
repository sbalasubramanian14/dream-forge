---
name: dream-forge
description: Build interactive 3D particle explanations in Dream Forge, with an isolated canvas per conversation, camera control, authored actions, redraw transitions, and saved history. Use when the user asks for Dream Forge or an explorable spatial explanation; requires MCP tools or the local CLI.
---

# Dream Forge

Dream Forge displays agent-authored procedural particles, not arbitrary text-to-3D assets or Gaussian reconstructions. Keep the user-facing explanation truthful about illustrative scale and omitted details.

## Start once per conversation

For simple letters or short text, use the fast path: `create_session` once (or reuse this conversation's ID), then `show_text({text:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",session_id:ID})`. This tool builds and validates the glyphs internally, so a full capability/schema lookup and custom generator are unnecessary. It supports A–Z, 0–9, spaces, newlines, and `- . ? !`; lowercase becomes uppercase. Return its URL directly; inspect the browser for this built-in path when the user requests visual review or reports a rendering problem. The equivalent CLI command is `text "ABCDEFGHIJKLMNOPQRSTUVWXYZ" --session ID` using the installed paths below. For other constructs, use the normal scene workflow.

With MCP, call `get_capabilities` once before composing. It returns the current complete JSON schema, semantic rules, limits, and this feature guide. Call `create_session` with a meaningful name, retain its `session.id`, and pass it as `session_id` on every subsequent tool call. Open or link the returned URL. Do not create another session for every reply, reuse a different conversation's canvas, or assume one MCP process always represents one chat. To resume a requested existing canvas, use `list_sessions` and retain its ID instead.

With shell access, first read `installation.json` beside this installed SKILL.md. The installer writes the exact `node`, `cli`, `repository`, and `version` there; use those paths directly rather than scanning the user's filesystem. For older skill copies without that file, check the client's existing Dream Forge MCP configuration or `dream-forge` on PATH before searching. If MCP tools are unavailable, use this CLI path immediately. Do not assume that installing a skill makes MCP tools available in an already-running chat.

Start the server if needed, call `session new <name>` once, and pass `--session <returned-id>` on every scene/camera/history command. `capabilities` exposes the same guide. The unscoped CLI and bare localhost URL use the shared `local` sandbox; avoid those in concurrent agent conversations. For letters or a short text construct, use `text "ABCDEFGHIJKLMNOPQRSTUVWXYZ" --session ID`; it generates and validates particle glyphs without writing a custom generator. Read `doctor` output if a connection fails; a different running server version needs a restart, which interrupts all canvases on that port but preserves saved history.

## Compose in one pass

Read [references/scenes.md](references/scenes.md) for the full scene contract, cameras, actions, steps, history, and transitions. Choose a few readable semantic objects before expanding. Position every object explicitly; omitted positions overlap at the origin. Use stable IDs across revisions to preserve particle continuity. Build custom geometry as `pointcloud` data when built-in shapes are insufficient. Labels, descriptions, and controls should explain the construct rather than expose implementation details.

Validate custom scene payloads with `validate_scene` and the same session ID before `show_scene`. Shell equivalent: `validate scene.json`, then `show scene.json --session <id>`. The built-in `show_text`/`text` path validates internally. Fix all reported semantic errors together. Showing a scene replaces it entirely; omitted objects disappear. A tool success confirms acceptance, not visual quality. Inspect a screenshot when browser tools are available.

Choose `assembly: {mode: "morph", duration: 1.6}` for direct reshaping, or `mode: "dissolve"` to disperse and rebuild. These also apply to step snapshots. Do not clear the canvas before every revision: history and transitions already handle replacement. Fresh sessions start empty, and `clear_canvas` keeps earlier history.

Use camera tools to present an appropriate view and focus. All-camera framing is preferable for an overview; focus a part for detailed discussion. Let human input interrupt agent orbit. Author actions and steps when they help exploration; object hotspots avoid geometry and label collisions, while screen controls keep their authored positions. Tiny objects use compact markers with hover/focus names.

For diagrams, declare box-shaped frames as `role: "boundary"` and supply acyclic `parent_id` relationships for physical or logical containment. Classify connections with `kind: "traffic"`, `"configuration"`, or `"relationship"`. Author a `journey` with an explicit ordered path only when its consecutive hops have directed traffic connections. The built-in viewer provides step navigation, inspection, label dragging, camera controls, layers and playback; avoid duplicate Next/Previous actions. Read the scene guide for details. Keep data-plane requests separate from configuration relationships.

## Continue the same canvas

Read `get_scene` before expanding an explanation. It includes the active step, requested camera, session metadata, history summaries, and the last 32 interactions. Use `list_history` and `restore_history` for earlier scenes; restoration keeps newer history available. `notify` records human intent without automatically waking the agent. Read those events when the user asks to act on a click.

Reply with the canvas URL and a brief explanation of the useful controls. Do not promise physical accuracy, measured geometry, current orbital positions, persistence outside the configured local store, or hidden reasoning visualization.
