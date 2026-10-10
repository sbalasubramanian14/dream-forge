---
name: dream-forge
description: Express explanations as interactive 3D particle constructs in the local Dream Forge canvas. Use when the user asks for Dream Forge or an explorable spatial explanation; requires Dream Forge MCP tools or CLI access.
---

# Dream Forge

Build a visual explanation the user can explore while continuing the conversation. Dream Forge renders procedural point clouds, not arbitrary text-to-3D assets or real Gaussian reconstructions.

If `show_scene`, `get_scene`, `focus_object`, and `clear_canvas` are available through the Dream Forge MCP server, use those tools. Read [references/scenes.md](references/scenes.md) for scene fields and examples. Tool names may be prefixed by the client.

If only shell access is available, use `dream-forge show <scene.json>` after starting `dream-forge start` in a persistent terminal. If the CLI is not on PATH, locate the installed repository and use `node <absolute-repo-path>/bin/dream-forge.js`. Do not assume the current project contains the installation. Installation instructions live in the repository README.

## Choosing a construct

Choose shapes that help understanding: boxes for components, cylinders for storage, spheres for actors, toruses for cycles, helixes for paired sequences, and arches for doorways. Use a few readable objects before expanding. Supply labels and descriptions; an attractive shape alone is not an explanation.

Space objects explicitly with `position`. All omitted positions default to the origin and overlap. Keep stable IDs and positions across follow-up scenes. Use connections only for relationships you can explain, and note that animated flow runs from `from` to `to`.

Read the existing scene before replacing it when continuity matters. `show_scene` replaces the whole scene. Focus the relevant object after showing it. Summarize the explanation in text and give the user the canvas URL returned by the tool.

A tool success means a scene was accepted, not that visual QA passed. Inspect the browser when possible. Distinguish illustrative metaphors from real data or simulations. Do not present internal hidden reasoning as visible content; visualize the user-facing explanation and proposed actions.
