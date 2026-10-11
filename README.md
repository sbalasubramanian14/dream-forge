# Dream Forge

**Give your agent a space where ideas take shape.**

Dream Forge is a local 3D particle canvas for AI explanations. It begins as a field of dots. Codex, Claude Code, or another tool-using agent sends a structured scene, and the dots assemble into constructs. Follow-up explanations can reshape the scene, animate connections, or focus an object.

Dream Forge uses procedural point clouds and particle morphing. It is not a Gaussian-splat reconstruction engine or an arbitrary text-to-3D model generator.

![Dream Forge doorway particle construct](docs/preview.png)

## Quick start

Requirements: Node.js 22 or newer, npm, Git, and a browser with WebGL enabled. No API key is required by Dream Forge. Your chosen agent runs separately with its own authentication.

```sh
git clone https://github.com/sbalasubramanian14/dream-forge.git
cd dream-forge
npm ci
npm start
```

Open **http://127.0.0.1:4317**. Keep the terminal running. The canvas starts empty; load a scene through the CLI or an agent. Use **Rotate/Pan**, scroll or +/− to zoom, and click a part or label to inspect. **Fit scene** frames the visible constructs. **More → Dissolve scene** returns to the idle field; **Pause motion** stops particle animation and request playback. Reduced-motion preferences start paused. Constructs remain central, with compact controls along the bottom. Surrounding dust occupies 3D space and reveals deeper layers as you zoom out.

In a second terminal, from the repository:

```sh
node bin/dream-forge.js demo architecture
node bin/dream-forge.js focus database
node bin/dream-forge.js focus all
node bin/dream-forge.js clear
```

## Connect an agent through MCP

Dream Forge exposes a **stdio MCP server**, not a hosted service. Configure the command with an **absolute path** to the cloned repository so it works from any project. The examples below use the Windows path where this project was created; replace it with your own path. On macOS/Linux, use a path such as `/Users/you/projects/dream-forge/bin/dream-forge.js`.

### Codex

```sh
codex mcp add dream-forge -- node "D:/aiprojects/dream-forge/bin/dream-forge.js" mcp
codex mcp list
```

Restart your Codex session after adding the server. Ask:

> Use Dream Forge to explain this application's architecture. Assemble the browser, API, and database, show the request flow, and give each construct a description.

### Claude Code

```sh
claude mcp add --transport stdio --scope user dream-forge -- node "D:/aiprojects/dream-forge/bin/dream-forge.js" mcp
claude mcp list
```

Restart Claude Code and use `/mcp` to check the connection. Then ask:

> Use Dream Forge to show how authentication works in this project. Build a labeled particle scene and focus each component as you explain it.

The MCP process starts a shared local server in the background if needed, or connects to a running server of the same version. The background server survives individual agent clients. Each MCP process receives a private empty canvas; the skill creates an explicit conversation canvas and passes its session ID to every tool call, which also works when a host shares one MCP process across chats. Open the session-specific URL returned by a tool call. For a canvas that stays available independently of agent sessions, run `npm start` first.

### Other MCP clients

Use this stdio configuration, adjusting the path:

```json
{
  "mcpServers": {
    "dream-forge": {
      "command": "node",
      "args": ["D:/aiprojects/dream-forge/bin/dream-forge.js", "mcp"]
    }
  }
}
```

Clients have different configuration locations. The important parts are the command, absolute entrypoint, and `mcp` argument. Any agent with shell access can use the CLI instead.

## Install the optional agent skill

The skill teaches an agent how to choose constructs and preserve scene continuity. It complements MCP; it does not replace the renderer or install dependencies.

From **the project you want the agent to work in**, run:

```sh
node "D:/aiprojects/dream-forge/bin/dream-forge.js" install-skill codex project
node "D:/aiprojects/dream-forge/bin/dream-forge.js" install-skill claude project
```

This copies the skill into `.agents/skills/dream-forge/` for Codex or `.claude/skills/dream-forge/` for Claude Code. To install for all projects, replace `project` with `user`; this uses `~/.agents/skills/` or `~/.claude/skills/`. Existing skill folders are never overwritten automatically. To update an installed copy deliberately, repeat the command with `--update`; it replaces bundled skill files while preserving unrelated files.

Restart the agent, then invoke `$dream-forge` in Codex or `/dream-forge` in Claude Code. MCP setup is still required if you want tool calls. For a shell-only workflow, run `npm link` in the Dream Forge repository once to make `dream-forge` available on PATH, or call the absolute Node entrypoint directly.

## Isolated sessions and saved history

Use one canvas per conversation. New canvases start as an empty particle field even when other saved canvases exist. Every update in that conversation uses the same session ID and URL. Sessions isolate geometry, camera requests, steps, interactions, event streams, and history.

MCP agents use `get_capabilities`, then `create_session`, and pass the returned `session.id` as `session_id` on subsequent tools. A separate MCP process also gets a private default canvas automatically, but explicit conversation IDs avoid assumptions about how a host shares MCP connections. The optional skill teaches this workflow.

For shell agents:

```sh
node bin/dream-forge.js session new "My explanation"
# Retain the returned session_id, then use it on every command:
node bin/dream-forge.js show scene.json --session YOUR_SESSION_ID
node bin/dream-forge.js camera isometric --session YOUR_SESSION_ID
node bin/dream-forge.js history --session YOUR_SESSION_ID
```

Open the returned URL, such as `http://127.0.0.1:4317/?session=YOUR_SESSION_ID`. `DREAM_FORGE_SESSION` is an alternative for a dedicated shell. Unscoped commands and the bare localhost URL use the shared `local` sandbox for manual demos.

The **History** drawer lists previous scenes and guided steps, and links to saved canvases. Select a snapshot to restore it without discarding newer history. Scene, clear, and step changes are recorded; camera-only updates and notifications are not. History retains up to 50 snapshots and 16 MiB per session, removing the oldest first.

State and history persist under `~/.dream-forge/<port>/` by default. Set `DREAM_FORGE_DATA_DIR` to change the parent directory, or `DREAM_FORGE_PERSIST=0` for temporary in-memory canvases. Agent sessions persist after the agent closes. New sessions remain empty; resuming a saved session requires its explicit ID. The background server keeps running until `node bin/dream-forge.js stop` is called (this stops all canvases on that port); run `npm start` in a dedicated terminal instead if you want direct control of its lifetime.

## Compose with the full capability guide

MCP includes server instructions and `get_capabilities`, which exposes the complete current JSON schema, cross-reference rules, limits, and feature guide. The optional skill teaches the agent to read it once, create a conversation canvas, validate its complete scene, and draw it. `validate_scene` checks a payload without modifying the canvas; CLI equivalent: `node bin/dream-forge.js validate scene.json`. This catches structural errors and broken references before drawing; visual quality still requires inspection.

After updating Dream Forge, restart its running server and your agent's MCP connection, and update installed copies of the skill with `install-skill codex user --update` or `install-skill claude user --update` (use `project` for project installations). Existing skill installations are not overwritten automatically.

Example single prompt after setup:

> Use Dream Forge to explain this system in a fresh canvas. Read its capabilities first, validate the scene, give me an overview and clickable steps, and preserve history as you refine it.

## CLI reference

| Command                                                     | Result                                            |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `dream-forge start`                                         | Serve the browser canvas in the foreground        |
| `dream-forge mcp`                                           | Run the stdio MCP server and start/reuse a canvas |
| `dream-forge show scene.json`                               | Validate and replace the complete scene           |
| `dream-forge demo <name>`                                   | Display a bundled example                         |
| `dream-forge focus object-id`                               | Focus one construct                               |
| `dream-forge focus all`                                     | Frame all constructs                              |
| `dream-forge camera <view\|file.json> [zoom] [target-id]`   | Set camera view, zoom, target, or orbit           |
| `dream-forge clear`                                         | Dissolve into the idle particle field             |
| `dream-forge status`                                        | Print the current scene, focus, and revision      |
| `dream-forge install-skill <codex\|claude> [project\|user]` | Install agent guidance                            |

Additional commands: `stop` (all canvases on this port), `session new [name]`, `session list`, `capabilities`, `validate scene.json`, `history`, and `restore history-id`. Add `--session ID` to commands that act on a canvas. Skill updates accept `--update`.

Without `npm link`, use `node bin/dream-forge.js` in place of `dream-forge` from the repository.

The default port is 4317. Set `DREAM_FORGE_PORT` on both the server and calling CLI/MCP process to change it:

```powershell
$env:DREAM_FORGE_PORT = "4320"
npm start
```

```sh
# macOS / Linux
DREAM_FORGE_PORT=4320 npm start
```

For a custom MCP port, add `--env DREAM_FORGE_PORT=4320` to `codex mcp add`, or `--env DREAM_FORGE_PORT=4320` to `claude mcp add`, before the `--` separator.

## Scene format

```json
{
  "title": "Follow a request",
  "explanation": "The browser calls the API, which queries storage.",
  "objects": [
    { "id": "browser", "shape": "box", "label": "Browser", "position": [-4, 0, 0] },
    { "id": "api", "shape": "sphere", "label": "API", "position": [0, 0, 0] },
    { "id": "db", "shape": "cylinder", "label": "Database", "position": [4, 0, 0] }
  ],
  "connections": [
    { "from": "browser", "to": "api", "label": "request" },
    { "from": "api", "to": "db", "label": "query" }
  ]
}
```

Supported shapes: `sphere`, `box`, `torus`, `cylinder`, `cone`, `arch`, `helix`, `tree`, `gear`, `rocket`, `ruins`, and `pointcloud`.

Each object has a unique `id` (letters, numbers, underscores, hyphens; maximum 64 characters), `shape`, optional `label`, `description`, `position` `[x,y,z]` (each coordinate -100 to 100), uniform `scale` (0.1 to 12), hex `color`, and Euler XYZ `rotation` in radians (default `[0,0,0]`). Defaults: position `[0,0,0]`, scale `1`, color `#70e0ed`, empty label and description. The Y axis points up. Set `show_label: false` on supporting geometry to hide its label without removing its particles.

Scenes support up to 24 objects and 48 connections. Connections reference existing object IDs and show directed particle flow from `from` to `to`. `show` replaces the entire scene. Preserve IDs and positions when expanding an explanation. Invalid scenes are rejected without changing the current scene. There is no arbitrary JavaScript execution in scene payloads.

For agent-defined geometry, use `shape: "pointcloud"` and provide `points`, an array of 1 to 12,000 local `[x,y,z]` coordinates (each coordinate -100 to 100). Scale and rotation are applied before the object is placed in the scene. The full JSON payload is limited to 1 MiB. Points are sampled across the fixed particle budget, so large clouds may be displayed at lower density.

```json
{
  "title": "A custom construct",
  "objects": [
    {
      "id": "custom",
      "shape": "pointcloud",
      "label": "Agent geometry",
      "points": [
        [-2, -1, 0],
        [2, -1, 0],
        [0, 2, 0],
        [0, 0, 1]
      ],
      "rotation": [0, 0.7, 0]
    }
  ]
}
```

Demo names: `portal`, `tree`, `mechanism`, `orbits`, `rocket`, `architecture`, `helix`, `solar-system`, `walkthrough`, and `aws-eks`. Example JSON files are shared by the CLI and served as read-only assets for browser testing; there is no scene-replacing dropdown in the viewer.

## Adaptive labels

Object labels and object-attached controls sit outside projected geometry, use leader lines, and avoid other annotations and interface panels. Tiny objects and crowded buttons become compact markers. Hover or keyboard-focus a marker to reveal its name; click it to inspect or activate it. Zooming in restores full labels. Off-screen annotations and captions without a clear placement are hidden. Agent-positioned screen buttons keep their authored positions.

## Redrawing constructs

Add `"assembly": {"mode":"morph","duration":1.6}` to a scene or step. `morph` is the default and directly reshapes particles. `dissolve` disperses them into the idle field for half the duration, then reforms the new construct. Duration is 0.2 to 8 seconds total. Paused/reduced-motion canvases show new scenes immediately. Replacing the same geometry still runs a redraw; camera changes and notifications do not.

## Agent camera control

Call `set_camera` through MCP, `POST /api/camera`, or the CLI:

```sh
node bin/dream-forge.js camera right 1.5
node bin/dream-forge.js camera isometric 1 tree
node bin/dream-forge.js camera camera.json
```

```json
{
  "view": "isometric",
  "target_id": "tree",
  "zoom": 1.2,
  "auto_rotate": true,
  "speed": 12,
  "transition": 0.8
}
```

Views: `front`, `back`, `left`, `right`, `top`, `bottom`, `isometric`. Optional absolute `yaw` (-360 to 360) and `pitch` (-89.5 to 89.5) are in degrees and override the preset. `target_id: null` fits the entire scene; an object ID fits that object. `zoom` ranges from 0.1 to 10 relative to automatic framing: 1 fits, 2 moves twice as close, 0.5 moves farther away. `speed` is orbit speed in degrees/second (-90 to 90), and `transition` sets the smoothing time scale (0 to 5 seconds; 0 snaps). Each command replaces camera settings. Manual dragging or zooming interrupts agent camera motion. Pause/reduced-motion settings stop auto-orbit. Scene replacement and Reset view restore default framing.

Surrounding particles live in world space across ten distance scales. Their apparent sizes shrink with depth, and camera movement produces parallax. More distant layers fade in gradually as you zoom out; the field is finite and covers the supported camera range. The requested camera is returned in state; user-adjusted camera positions are local to each browser and are not reported as live pose feedback.

## Agent-authored buttons and guided steps

Try `node bin/dream-forge.js demo walkthrough`. An agent can author `actions` and up to 20 `steps` in a scene. Each step is a scene snapshot with its own objects, connections, title, explanation, optional camera, and optional actions. Missing step actions inherit the overview actions; `actions: []` removes them. The initial overview is step -1. Steps are zero-based. The viewer supplies progress, a step picker, Previous/Next, and Return to overview; duplicate authored Next/Previous toolbar controls are hidden.

```json
{
  "title": "Explore a mechanism",
  "objects": [{ "id": "gear", "shape": "gear", "label": "Gear" }],
  "actions": [
    {
      "id": "side",
      "label": "View its side",
      "placement": "object",
      "object_id": "gear",
      "action": {
        "type": "camera",
        "settings": { "view": "right", "target_id": "gear", "zoom": 1.2 }
      }
    },
    { "id": "next", "label": "Show the next step", "action": { "type": "next" } },
    {
      "id": "ask",
      "label": "Explain these teeth",
      "placement": "screen",
      "position": [0.85, 0.3],
      "action": { "type": "notify", "message": "Explain the gear teeth." }
    }
  ],
  "steps": [
    {
      "title": "The teeth transmit force",
      "objects": [{ "id": "gear", "shape": "gear", "label": "Gear teeth" }],
      "actions": [{ "id": "back", "label": "Back to overview", "action": { "type": "previous" } }]
    }
  ]
}
```

Each interaction has a unique `id`, human-readable `label`, and an `action`. Placement can be `toolbar` (default), `object` (requires `object_id`, follows that construct), or `screen` (requires normalized `position: [x,y]`, each 0 to 1). Screen controls are clamped within the viewport. Optional `disabled: true` disables a control.

Supported behaviors:

| Action              | Fields                    | Behavior                              |
| ------------------- | ------------------------- | ------------------------------------- |
| `camera`            | `settings`                | Change view, fit, zoom, or auto-orbit |
| `focus`             | `object_id` or null       | Focus a part or reset to all objects  |
| `next` / `previous` | None                      | Navigate the authored sequence        |
| `goto`              | Zero-based `index`, or -1 | Jump to a specific step or overview   |
| `clear`             | None                      | Dissolve and clear the sequence       |
| `notify`            | `message`                 | Record a user intent for the agent    |

Controls are generated from scene data, not hardcoded per demo. Actions are validated against the active snapshot. Human clicks and the MCP `activate_action` tool use the same action registry. `go_to_step` navigates directly. State keeps the last 32 interaction records, including the clicked control and step transition. `notify` does **not** automatically wake an agent or generate a response; the agent reads `get_scene` to respond to recorded intent. No scene action executes arbitrary JavaScript or HTML.

### MCP tools

| Tool              | Arguments                       | Purpose                             |
| ----------------- | ------------------------------- | ----------------------------------- |
| `show_scene`      | Full scene fields above         | Assemble or replace a scene         |
| `focus_object`    | `{"id":"api"}` or `{"id":null}` | Focus an object or frame all        |
| `get_scene`       | `{}`                            | Read the current state              |
| `clear_canvas`    | `{}`                            | Return to idle dots                 |
| `set_camera`      | Camera settings above           | Present a view, zoom, fit, or orbit |
| `go_to_step`      | `{"index":0}` or `{"index":-1}` | Navigate a step or overview         |
| `activate_action` | `{"id":"next"}`                 | Activate a scene-defined control    |

Additional MCP tools: `create_session({name})`, `list_sessions({})`, `get_capabilities({})`, `validate_scene(full-scene-fields)`, `list_history({session_id})`, and `restore_history({session_id,id})`. All scene/camera/action/step/history tools accept `session_id`. Retain the returned session ID throughout one conversation.

Tool responses include the canvas URL and current state. A successful tool response confirms the server accepted a scene; it does not prove the browser rendered it. Use a browser screenshot or ask the user to inspect the visuals when visual accuracy matters.

### Local HTTP API

- `GET /api/health`: application identity and version.
- `GET /api/state`: current state.
- `GET /api/events`: server-sent scene updates, including initial state.
- `POST /api/scene`: full scene JSON.
- `POST /api/focus`: `{"id":"object-id"}` or `{"id":null}`.
- `POST /api/clear`: `{}`.
- `POST /api/camera`: validated camera settings.
- `POST /api/step`: `{"index":0}` (or -1 for overview).
- `POST /api/action`: `{"id":"scene-action-id"}`.
- `GET /api/sessions` and `POST /api/sessions`: list canvases or create one with optional `{name}`.
- `GET /api/capabilities`: full guide, current schema, and limits.
- `POST /api/validate`: validate scene JSON without drawing.
- `GET /api/history`: history summaries for this session.
- `POST /api/restore`: `{id:"history-id"}`.
- `POST /api/shutdown`: stop the local server for all canvases on the port.

Session-scoped endpoints use `?session=ID`; omission uses the local sandbox.

POST requests require `Content-Type: application/json`. The server binds to `127.0.0.1` and rejects foreign Host/Origin headers. No CORS access is enabled. It is intended for trusted local tools; other local processes can access it. There are no runtime cloud requests, telemetry, or API keys. npm needs network access to install dependencies.

## Viewing explanations

The canvas has no demo dropdown: an agent's explanation stays in place until a scene command changes it. Load bundled examples through `dream-forge demo <name>`, including `aws-eks` for the eight-step multi-region request journey.

Constructs assemble from luminous particles, retain gentle particle motion when formed, and keep a surrounding world-space dust field. Boundary outlines and connection guides stay subtle and appear after assembly, so the particle formation remains the main visual. Pause motion freezes the living particle effect as well as transitions and playback.

- **Rotate / Pan** choose what left-drag does. Right-drag also pans; scroll and +/− zoom. **Fit scene** frames visible objects. Touch supports one-finger rotate/pan and two-finger camera gestures.
- Click a part or its label to inspect it without moving the camera. **Zoom to selection** moves closer. **Isolate selection** keeps its parents and descendants; Layers → Show everything exits isolation. Picking uses component bounding volumes; large boundaries are selected through their labels.
- Drag a label to place it yourself. Positions persist locally per browser, session and snapshot/object. More → Reset label positions returns to automatic placement. Manual pins can overlap other labels, so the viewer retains control over them.
- **Read explanation** opens the complete text in a scrollable panel. The caption remains short. Overview, Previous/Next, progress and the step picker work for any authored sequence. Left/right arrow keys navigate when a form control is not focused.
- **Layers** filters boundaries, labels, traffic, configuration, other connections and ambient particles. **More** contains fullscreen, reset label positions and Dissolve scene.
- History groups step visits under their scene revision while preserving individual restore buttons and bounded persisted snapshots.

Declare `role: "boundary"` for intentionally box-shaped grouping geometry. The renderer adds a clear bounding-box outline and places inner labels without treating the whole boundary as a solid obstacle. `parent_id` references another object in the same snapshot, creating an acyclic hierarchy for selection and isolation. It does not change positions or enforce geometric containment. Use one meaningful parent; overlapping namespace and physical-node relationships should be explained explicitly.

Connections support `kind: "traffic" | "configuration" | "relationship"` (default relationship). An optional snapshot `journey` makes ordered playback available:

```json
{
  "label": "Follow one request",
  "path": ["browser", "alb", "pod"],
  "seconds_per_hop": 1.6
}
```

Each consecutive pair must have an explicit directed traffic connection. The viewer supplies Play/Pause, Replay and playback speed. Global Pause motion also pauses the marker; reduced-motion users can explicitly Resume motion. Traffic filtering suspends playback. Journeys are authored illustrations, not live packet traces, and are never inferred from arbitrary graph order. New fields are optional; older scenes remain valid.

Viewer inspection, label pins, camera gestures and filters remain local to the browser and do not become agent interaction events. Use authored notify buttons when you want to record a question for the agent.

The AWS example models Route 53 DNS and regional ALBs with pod IP targets, following [AWS ALB routing guidance](https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html). Namespace overlays follow the [Kubernetes namespace model](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/). Data replication is illustrative and requires an explicit application strategy.

## Scope

Included: 24,000 morphing construct particles plus a 14,000-point world-space dust field, eleven procedural shapes and custom point clouds, per-object rotation, typed connections, request playback, rotate/pan/zoom, direct inspection, movable labels, parent-aware isolation, layer filtering, guided navigation, grouped history, ten examples, CLI, MCP, and installable skills.

Current limits: updates to the same session are serialized and the last accepted update wins, no semantic object generation, no imported mesh or splat files, no physical simulation, and no pixel-perfect recreation of the reference image. Particle assignment between different shapes is a simple deterministic mapping; it can produce crossing trajectories. Large scenes share a fixed particle budget.

Next directions: mesh-to-particle sampling, better spatial particle matching, scene timelines, and optional generated 3D assets. These are roadmap items, not shipped capabilities.

## Development

```sh
npm ci
npm test
npm start
```

Source layout:

- `web/`: Three.js canvas, particle geometry, browser controls.
- `web/camera-controller.js`: camera framing, smooth viewpoint transitions, and orbit.
- `web/interactions.js`: scene-defined buttons and hotspots.
- `web/annotations.js`: projected object bounds, collision-aware labels, leader lines, and compact markers.
- `web/particle-field.js`: surrounding 3D dust, depth attenuation, and distance-scale visibility.
- `src/`: validated scene contract, local HTTP server, MCP tools.
- `src/state.js`: pure state transitions and the action registry.
- `src/sessions.js`: session isolation, serialized updates, bounded history, and atomic persistence.
- `src/capabilities.js`: agent discovery from the maintained schema and skill reference.
- `web/history.js` and `web/particle-transition.js`: history controls and redraw behavior.
- `bin/`: CLI and skill installer.
- `skills/dream-forge/`: portable agent instructions and scene reference.
- `examples/`: scenes an agent can use immediately.
- `test/`: validation, HTTP lifecycle, CLI, and MCP integration checks.

For browser verification and a headed preview:

```sh
npx playwright install chromium
npm run test:browser
npm run preview
```

The browser suite starts its own server on port **4319**, opens Chromium visibly, and checks scene changes, focus, orbit/zoom controls, pause, dissolve, state restoration, custom geometry, the richer catalog, and a mobile viewport with reduced motion. It does not modify the live preview on port 4317. Screenshots are written to the ignored `test-results/` folder. The preview command leaves a headed browser open until you close it. It starts a local server if needed. Refresh or reopen existing preview tabs after updating the code to load the new renderer.

See [AGENTS.md](AGENTS.md) for implementation conventions. Dependencies are locked in `package-lock.json`. GitHub Actions runs tests on Windows and Linux with Node 22.

Run `npm run format` to apply the shared Prettier conventions and `npm run format:check` to check formatting. To add an interaction behavior, extend the discriminated action schema, register its handler in `src/state.js`, and add behavioral tests. Keep transport handling, state changes, renderer behavior, and DOM controls separate. Camera commands do not rebuild geometry, and notifications do not reset the camera.

Integration references: [Codex MCP](https://developers.openai.com/codex/mcp), [Codex skills](https://developers.openai.com/codex/skills), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Claude Code skills](https://code.claude.com/docs/en/skills).

## Troubleshooting

- **Connection refused:** start the canvas, or connect the MCP server. Check that both processes use the same port.
- **Port already in use:** MCP can reuse an existing Dream Forge server. Otherwise stop the conflicting process or choose another port.
- **Blank canvas:** enable browser hardware acceleration and check the console for WebGL errors. Node dependencies must be installed.
- **MCP tools missing:** check the absolute path, run the client’s MCP list command, and restart the agent session. Do not run `npm start` as the stdio command; use the entrypoint with `mcp`.
- **Skill installed but no tools:** skills supply instructions. Configure MCP separately or use the CLI.
- **Windows command not found after `npm link`:** reopen the terminal, or use `node` with the absolute entrypoint.

MIT licensed.
