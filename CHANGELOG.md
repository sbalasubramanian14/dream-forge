# Changelog

## 0.6.0

Early developer release distributed through GitHub. No npm publication or marketplace plugin is included.

- Added a dependency-free setup command that installs locked packages, registers MCP through Codex/Claude Code, and installs a user skill without manual path editing.
- Added `setup`, `doctor`, `text`, and `--version` commands. Doctor tests a disposable MCP connection and browser assets without touching saved canvases.
- Added the fast `show_text` MCP tool with compact responses and internally validated particle glyphs.
- Installed skills now include exact local paths in `installation.json`, avoiding broad filesystem searches.
- Preserved explicit replacement behavior for existing registrations/skills and unrelated files during updates.
- Added an explicit Codex `--approve-canvas` opt-in for trusted local drawing tools, leaving other tool policies unchanged.
- Added the 14-step bubble-sort example: 9 comparisons and 4 swaps.
- Reworked installation, update, uninstall and troubleshooting documentation, with actual screenshots and a reproducible headed recording script.
- Added setup/diagnostic/text tests and a Linux headed-browser CI job.

Scene schema and saved-canvas format are unchanged from 0.5.0. Stop older running servers before reconnecting the new MCP version and refresh browser tabs.

## 0.5.0

- Added viewer navigation, inspection, draggable labels, hierarchy isolation, filters, and ordered request playback.
- Restored luminous particle formation and motion inside settled constructs.
- Added isolated canvases, bounded persisted history, capabilities and scene preflight validation.
