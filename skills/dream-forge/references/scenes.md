# Scene contract

## Fast particle text

For letters or short text, call `show_text({text:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",session_id:ID})` after creating or resuming this conversation's canvas. It generates and validates a complete glyph scene internally and returns a compact result with rows and URL. No custom generator, `validate_scene`, or full schema lookup is needed for this built-in path. CLI equivalent: `text "ABCDEFGHIJKLMNOPQRSTUVWXYZ" --session ID`. Supports uppercase A–Z, digits, spaces, newlines and `- . ? !`; lowercase is rendered uppercase. Limit: 144 characters, arranged in at most 12 rows of 8. Unsupported characters are rejected without changing the canvas.

## Custom scenes

Call `show_scene` with `title`, `explanation`, `objects`, and `connections`. Titles are limited to 160 characters; explanations to 4000. Maximum 24 objects and 48 connections.

Object fields:

- `id`: unique letters, numbers, underscores or hyphens, max 64 characters.
- `shape`: `sphere`, `box`, `torus`, `cylinder`, `cone`, `arch`, `helix`, `tree`, `gear`, `rocket`, `ruins`, or `pointcloud`.
- `label`: max 120 characters, default empty.
- `show_label`: boolean, default true. Set false for supporting geometry such as orbit paths or ring disks to avoid label clutter.
- `role`: `component` (default) or `boundary`. Boundaries get crisp bounding-box outlines and allow labels inside their interiors. Use this for intentionally box-shaped VPCs, subnets, nodes, or logical grouping frames; do not use it for arbitrary curved geometry.
- `parent_id`: nullable ID of another object in the same snapshot, default null. Defines the selection/isolation hierarchy. Parents must exist and must not form cycles. This is authored semantic containment, not automatic containment inferred from overlapping geometry.
- `description`: max 2000 characters, default empty. Shown when focused.
- `position`: `[x,y,z]`, each coordinate between -100 and 100; default `[0,0,0]`. Y is up.
- `scale`: uniform size multiplier, 0.1 to 12, default 1.
- `color`: six-digit hex, default `#70e0ed`.
- `rotation`: Euler XYZ angles in radians, default `[0,0,0]`.
- `points`: required only for `pointcloud`; 1 to 12,000 local `[x,y,z]` coordinates. Compose agent-generated geometry as data, not executable code. Keep the full payload below 1 MiB.

Connection fields: `from`, `to` (existing IDs), optional `label` (max 120 characters), and `kind`: `traffic`, `configuration`, or `relationship` (default). The viewer can filter these separately. Flows move from source to destination; configuration flows represent configuration, not application requests.

```json
{
  "title": "A request reaches storage",
  "explanation": "An illustrative flow from a client through an API to storage.",
  "objects": [
    {
      "id": "client",
      "shape": "box",
      "label": "Client",
      "position": [-5, 0, 0],
      "description": "Sends a request."
    },
    {
      "id": "api",
      "shape": "sphere",
      "label": "API",
      "position": [0, 0, 0],
      "description": "Validates and processes the request."
    },
    {
      "id": "storage",
      "shape": "cylinder",
      "label": "Storage",
      "position": [5, 0, 0],
      "description": "Reads or writes persistent data."
    }
  ],
  "connections": [
    { "from": "client", "to": "api", "label": "request" },
    { "from": "api", "to": "storage", "label": "query" }
  ]
}
```

Focus: `focus_object({"id":"api"})`. Frame all: `focus_object({"id":null})`. Read: `get_scene({})`. Dissolve: `clear_canvas({})`.

CLI equivalent: write the scene as a UTF-8 JSON file and run `dream-forge show <file>`, then `dream-forge focus api`. To reset, run `dream-forge clear`. Port defaults to 4317; `DREAM_FORGE_PORT` must match the running server.

## Sessions, redraws, and history

A fresh conversation uses `create_session({name:"Explanation"})`, which returns `session.id`, empty objects/history, and an isolated URL. Supply `session_id` on every subsequent MCP tool call. Each MCP process also has a private default canvas, but hosts can share processes; explicit IDs provide conversation isolation. `list_sessions` can find a requested existing canvas. Do not reset an existing session unless the user requests it.

CLI: `session new Explanation` returns the ID. Then use `show scene.json --session ID`, `camera right --session ID`, `history --session ID`, and `restore HISTORY_ID --session ID`. `DREAM_FORGE_SESSION` is an alternative for one dedicated shell. Omitting it uses the shared `local` sandbox. HTTP requests use `?session=ID` on the API URL; the browser uses the same query on its page URL.

Every scene snapshot supports `assembly: {mode:"morph",duration:1.6}`. Mode is morph (default) or dissolve; duration is 0.2 to 8 seconds total. Morph interpolates into the new geometry. Dissolve spends half the duration dispersing into idle particles and half rebuilding. Pause/reduced motion snaps new scenes to the final construct. Same-geometry redraws still run the requested assembly animation. Camera changes and notifications do not trigger redraws.

Each accepted scene, clear, or step change saves a history snapshot. Camera changes and notify actions do not create history entries. `list_history({session_id:ID})` returns summary IDs; `restore_history({session_id:ID,id:HISTORY_ID})` restores the geometry, authored sequence, step, and saved camera without removing newer history. The browser's History drawer also lists saved canvases. Up to 50 entries and 16 MiB of snapshots are retained per canvas; oldest entries are removed first. Current state and history are persisted in the configured local data directory by default, including across server restarts. Fresh random sessions remain empty even if other canvases are saved.

`get_capabilities` returns this guide and the current JSON schema. `validate_scene` checks the complete scene without mutating state/history; geometry and cross-reference checks go beyond JSON structural validation. In the CLI, `validate scene.json` runs locally without a server. Include session_id in MCP arguments, not inside a scene JSON file submitted through the CLI.

## Camera

`set_camera({"view":"right","target_id":"api","zoom":1.5})` automatically fits the API from its right side. Presets: front, back, left, right, top, bottom, isometric. Optional yaw/pitch are absolute degrees, with pitch limited to ±89.5. Zoom is 0.1 to 10 relative to fit. Optional auto_rotate (boolean), speed (degrees/second, -90 to 90), transition (0 to 5 seconds; 0 snaps). Omitted target_id is null (all objects). Commands replace settings. Manual input interrupts orbit; reduced motion/pause stops it.

## Human controls and steps

Add up to 24 `actions` to a snapshot. Each is `{id,label,placement,action}`. Placement defaults to toolbar. Object placement requires object_id; screen placement requires normalized position [x,y] (0 to 1). An optional disabled flag is supported. Behavior is one of:

- `{type:"camera",settings:{view:"right",zoom:1.5}}`
- `{type:"focus",object_id:"api"}` (null resets)
- `{type:"next"}` or `{type:"previous"}`
- `{type:"goto",index:0}` (use -1 for the overview)
- `{type:"clear"}`
- `{type:"notify",message:"Explain this part"}`

Add up to 20 `steps`, each with title, explanation, objects, connections, optional actions, and optional camera. No nested steps. Step actions inherit overview actions when omitted; [] removes them. All object references must exist in the snapshot where the action is used. Overview index is -1; steps begin at 0. `go_to_step({index:0})` navigates. `activate_action({id:"next"})` invokes a control. Human clicks use the same action registry.

`get_scene` returns step, requested camera, and the last 32 interactions. Notify records intent without waking the agent or executing code. Read those events when responding to human choices. See the installed repository's examples/walkthrough.json for a complete sequence.

## Viewer and request playback

The viewer supplies Overview, Previous, Next, a step picker, progress, Rotate/Pan, zoom, Fit scene, layers, and a full explanation panel. Avoid authoring duplicate Next/Previous toolbar buttons; these are hidden when a sequence exists. Keep authored actions for domain-specific choices and hotspots. Demos are available through the CLI, not a scene-replacing canvas dropdown.

Clicking geometry or a label inspects without moving the camera. Zoom to selection is separate. Selection highlights the object and its parent chain. Isolate selection retains the selection, descendants, and ancestors. Layer filters independently control boundaries, labels, traffic, configuration, other connections, and ambient particles. These viewer preferences do not mutate authored geometry. Drag labels to pin them to normalized screen positions; positions persist in this browser per session and snapshot title/object ID. More → Reset label positions removes them. Manual placement can override automatic collision avoidance.

For an actual ordered request or response, author an optional `journey` on each relevant snapshot:

```json
{
  "label": "Follow one HTTPS request",
  "path": ["browser", "alb", "pod"],
  "seconds_per_hop": 1.6
}
```

Path length is 2–49 IDs, with seconds_per_hop between 0.2 and 10. Every consecutive pair must have a directed connection with `kind: "traffic"`. Repeated IDs are allowed, for example a round trip, when the directed return edges are present. The viewer never infers a request route from connection order. Configuration and DNS lookups should not be silently presented as HTTP hops. Play/Pause, Replay and 0.5×/1×/2× speed control the highlighted marker. Global Pause motion and reduced-motion preferences also pause playback; explicitly Resume motion to animate. Hide traffic to suspend the marker. Paths are illustrative, not live traces.

History groups visits to steps under their scene revision; every underlying snapshot remains restorable. Camera gestures, inspection and layer filters do not create extra history snapshots. See `examples/aws-eks.json` for a two-region walkthrough using boundaries, parent relationships, typed edges and request playback.
