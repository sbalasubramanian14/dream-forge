# Scene contract

Call `show_scene` with `title`, `explanation`, `objects`, and `connections`. Titles are limited to 160 characters; explanations to 4000. Maximum 24 objects and 48 connections.

Object fields:

- `id`: unique letters, numbers, underscores or hyphens, max 64 characters.
- `shape`: `sphere`, `box`, `torus`, `cylinder`, `cone`, `arch`, or `helix`.
- `label`: max 120 characters, default empty.
- `description`: max 2000 characters, default empty. Shown when focused.
- `position`: `[x,y,z]`, each coordinate between -100 and 100; default `[0,0,0]`. Y is up.
- `scale`: uniform size multiplier, 0.1 to 12, default 1.
- `color`: six-digit hex, default `#70e0ed`.

Connection fields: `from`, `to` (existing IDs), optional `label` (max 120 characters). Flows move from source to destination.

```json
{
  "title": "A request reaches storage",
  "explanation": "An illustrative flow from a client through an API to storage.",
  "objects": [
    {"id":"client","shape":"box","label":"Client","position":[-5,0,0],"description":"Sends a request."},
    {"id":"api","shape":"sphere","label":"API","position":[0,0,0],"description":"Validates and processes the request."},
    {"id":"storage","shape":"cylinder","label":"Storage","position":[5,0,0],"description":"Reads or writes persistent data."}
  ],
  "connections": [
    {"from":"client","to":"api","label":"request"},
    {"from":"api","to":"storage","label":"query"}
  ]
}
```

Focus: `focus_object({"id":"api"})`. Frame all: `focus_object({"id":null})`. Read: `get_scene({})`. Dissolve: `clear_canvas({})`.

CLI equivalent: write the scene as a UTF-8 JSON file and run `dream-forge show <file>`, then `dream-forge focus api`. To reset, run `dream-forge clear`. Port defaults to 4317; `DREAM_FORGE_PORT` must match the running server.
