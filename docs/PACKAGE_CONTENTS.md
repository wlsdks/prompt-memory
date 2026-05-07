# Package Contents

This document describes what should be included when `prompt-memory` is
published to npm.

Check the current package with:

```sh
npm pack --dry-run --json
```

## Included

The npm package intentionally includes:

- `dist/cli`: the compiled `prompt-memory` CLI entrypoint plus experimental
  `pm-claude` and `pm-codex` wrapper entrypoints
- `dist/server`: the compiled local Fastify server and web API
- `dist/web`: the compiled React web UI assets
- `dist/storage`, `dist/analysis`, `dist/hooks`, `dist/importer`,
  `dist/exporter`, and related runtime modules
- `README.md`, `README.ko.md`, `CHANGELOG.md`, `LICENSE`, `SECURITY.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SUPPORT.md`
- public product and release docs under `docs/`
  - includes `docs/LEGAL_USAGE_GUIDE.md` so users can inspect the provider
    documentation boundary for agent-judge mode
- Claude Code plugin artifacts under `.claude-plugin`, `commands`, and
  `integrations/claude-code`
- Codex plugin artifacts under `plugins/prompt-memory`
- local verification scripts: `scripts/benchmark.mjs`,
  `scripts/browser-e2e.mjs`, `scripts/quality-gate.mjs`, and
  `scripts/release-smoke.mjs`

## Excluded

The npm package should not include:

- source TypeScript files under `src/`
- test fixtures under `tests/`
- GitHub workflow and issue template files under `.github/`
- local runtime data such as `.prompt-memory/`, SQLite databases, logs,
  spool files, quarantine files, and prompt archives
- environment files such as `.env`
- local package artifacts such as `*.tgz`
- dependency folders such as `node_modules/`
- editor, OS, browser report, and temporary cache files

## Privacy Boundary

The package must not contain real prompts, real credentials, personal machine
paths, local prompt archives, or private database files. Release scripts may
contain synthetic fixtures such as `/Users/example` and fake API-key-shaped
strings to test redaction behavior.

## Source Maps

The build emits `.map` files inside `dist/` so that local development can step
through compiled output. These maps are excluded from the published tarball
through a `!dist/**/*.map` entry in `package.json#files` because end users of
the CLI do not need them, and the saved bytes (~1 MB unpacked, ~75 files)
shrink every install. The maps that stay in `dist/` for local debugging must
not contain private paths, credentials, or local data.
