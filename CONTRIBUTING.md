# Contributing

Open an issue for a reproducible bug or proposed feature, or send a focused pull request. Include the scene payload, reproduction steps, browser/OS and Node versions. Do not include secrets or private project data in examples.

Read [development instructions](docs/development.md) and [AGENTS.md](AGENTS.md). Runtime changes require `npm test`; check formatting with `npm run format:check`. Visual changes require headed browser verification. Test servers must not modify user canvases.

Update schema, transports, examples, renderer and documentation together for new scene features. Preserve loopback binding, data-only scenes and protocol-only MCP stdout.

Run `npm run docs:media` after installing Playwright Chromium to regenerate screenshots and the recording. Review actual captures before committing. No model calls or API keys are required.
