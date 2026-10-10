# Working on Dream Forge

Dream Forge is a local agent-driven particle canvas. Keep scene rendering independent of any AI vendor or API key.

- Use Node ESM and the existing plain browser modules. Run `npm test` after runtime changes.
- Treat `src/schema.js` as the scene contract. Update docs, examples, MCP inputs, and renderer support together when changing it.
- MCP stdout is protocol-only. Diagnostics belong on stderr.
- Keep the HTTP server loopback-only. Do not introduce runtime execution of agent-supplied JavaScript or HTML.
- Preserve textContent for all user/agent labels and explanations.
- Scene commands replace the complete scene; do not imply partial updates exist.
- Verify visuals in a real headed browser for rendering changes. Exercise idle, assembly, scene replacement, focus, pause, and dissolve.
- Keep the dark particle-first canvas spacious. Labels and controls should support understanding without obscuring constructs.
- Describe procedural visuals and metaphors honestly; do not claim Gaussian reconstruction, live traces, or physical accuracy.
- Keep camera behavior in `web/camera-controller.js`, control rendering in `web/interactions.js`, and pure action/state transitions in `src/state.js`.
- Keep annotation projection and collision layout in `web/annotations.js`. Object labels, edge captions, and object hotspots share this layout; screen controls retain agent-defined placements.
- Keep session storage and history in `src/sessions.js`, redraw interpolation in `web/particle-transition.js`, and browser history controls in `web/history.js`. Every agent conversation must use an explicit session ID. Tests use temporary or disabled persistence and separate ports.
- Keep `get_capabilities`, the installed skill, and scene examples consistent with the schema. A validated scene is not proof of visual quality.
- Extend the discriminated action schema, registry, and behavioral tests together for new actions. Keep snapshots immutable and preserve validation before mutation.
- Format with `npm run format`; verify with `npm run format:check`. Browser tests use their own server on port 4319 and must not modify the user's live canvas.
