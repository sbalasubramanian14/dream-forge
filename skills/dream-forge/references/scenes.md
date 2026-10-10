# Scene contract

Call `show_scene` with `title`, `explanation`, `objects`, and `connections`. Titles are limited to 160 characters; explanations to 4000. Maximum 24 objects and 48 connections.

Object fields:

- `id`: unique letters, numbers, underscores or hyphens, max 64 characters.
- `shape`: `sphere`, `box`, `torus`, `cylinder`, `cone`, `arch`, `helix`, `tree`, `gear`, `rocket`, `ruins`, or `pointcloud`.
- `label`: max 120 characters, default empty.
- `show_label`: boolean, default true. Set false for supporting geometry such as orbit paths or ring disks to avoid label clutter.
- `description`: max 2000 characters, default empty. Shown when focused.
- `position`: `[x,y,z]`, each coordinate between -100 and 100; default `[0,0,0]`. Y is up.
- `scale`: uniform size multiplier, 0.1 to 12, default 1.
- `color`: six-digit hex, default `#70e0ed`.
- `rotation`: Euler XYZ angles in radians, default `[0,0,0]`.
- `points`: required only for `pointcloud`; 1 to 12,000 local `[x,y,z]` coordinates. Compose agent-generated geometry as data, not executable code. Keep the full payload below 1 MiB.

Connection fields: `from`, `to` (existing IDs), optional `label` (max 120 characters). Flows move from source to destination.

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

## Camera

`set_camera({"view":"right","target_id":"api","zoom":1.5})` automatically fits the API from its right side. Presets: front, back, left, right, top, bottom, isometric. Optional yaw/pitch are absolute degrees, with pitch limited to ±89.5. Zoom is 0.1 to 10 relative to fit. Optional auto_rotate (boolean), speed (degrees/second, -90 to 90), transition (0 to 5 seconds; 0 snaps). Omitted target_id is null (all objects). Commands replace settings. Manual input interrupts orbit; reduced motion/pause stops it.

## Human controls and steps

Add up to 24 `actions` to a snapshot. Each is `{id,label,placement,action}`. Placement defaults to toolbar. Object placement requires object_id; screen placement requires normalized position [x,y] (0 to 1). An optional disabled flag is supported. Behavior is one of:

- `{type:"camera",settings:{view:"right",zoom:1.5}}`
- `{type:"focus",object_id:"api"}` (null resets)
- `{type:"next"}` or `{type:"previous"}`
- `{type:"goto",index:0}`
- `{type:"clear"}`
- `{type:"notify",message:"Explain this part"}`

Add up to 20 `steps`, each with title, explanation, objects, connections, optional actions, and optional camera. No nested steps. Step actions inherit overview actions when omitted; [] removes them. All object references must exist in the snapshot where the action is used. Overview index is -1; steps begin at 0. `go_to_step({index:0})` navigates. `activate_action({id:"next"})` invokes a control. Human clicks use the same action registry.

`get_scene` returns step, requested camera, and the last 32 interactions. Notify records intent without waking the agent or executing code. Read those events when responding to human choices. See the installed repository's examples/walkthrough.json for a complete sequence.
