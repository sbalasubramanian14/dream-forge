# Development

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

See [AGENTS.md](../AGENTS.md) for implementation conventions. Dependencies are locked in `package-lock.json`. GitHub Actions runs tests on Windows and Linux with Node 22.

Run `npm run format` to apply the shared Prettier conventions and `npm run format:check` to check formatting. To add an interaction behavior, extend the discriminated action schema, register its handler in `src/state.js`, and add behavioral tests. Keep transport handling, state changes, renderer behavior, and DOM controls separate. Camera commands do not rebuild geometry, and notifications do not reset the camera.

Integration references: [Codex MCP](https://developers.openai.com/codex/mcp), [Codex skills](https://developers.openai.com/codex/skills), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Claude Code skills](https://code.claude.com/docs/en/skills).
