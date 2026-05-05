# Code Structure

## Top-level layout
```
src/
  adapters/    external hook payload -> normalized prompt events
  analysis/    deterministic local scoring, coaching, improvement logic
  cli/         Commander commands and terminal formatting
  config/      local config, tokens, path initialization
  exporter/    anonymized export preview and execution
  hooks/       fail-open hook wrapper and delivery status
  importer/    markdown/source import and dry-run planning
  judge/       background auto-judge worker, privacy redaction for judge packets
  mcp/         MCP tool definitions, typed contracts, handlers, stdio server
  packaging/   plugin/marketplace packaging helpers
  redaction/   secret detection and redacted prompt representations
  security/    auth tokens, CSRF, file permissions
  server/      Fastify routes, auth, browser/API boundary
  shared/      shared schemas, ids, hashing, version helpers
  storage/     SQLite/Markdown persistence, row contracts, JSON decoders
  web/         React app, browser-only models, styles, charts
```

## Entrypoints
`cli`, `server`, `hooks`, `mcp`, and `web`. They orchestrate; reusable rules live in `analysis`, `redaction`, `storage`, `shared`.

Bin entries (from `package.json`):
- `prompt-memory` -> `dist/cli/index.js`
- `pm-claude` -> `dist/cli/pm-claude.js`
- `pm-codex` -> `dist/cli/pm-codex.js`

## MCP module split (do not collapse)
- `score-tool-definitions.ts` — tool definitions / JSON schemas
- `score-tool-types.ts` — argument/result TypeScript contracts
- `score-tool.ts` — handler orchestration
- `server.ts` — JSON-RPC routing
- Same split for `agent-rewrite-tool*` and `agent-judge-tool*`.

## Storage module split (do not collapse)
- `sqlite.ts` — query / transaction assembly
- `sqlite-rows.ts` — row contracts
- `sqlite-json.ts` — defensive JSON decoding
- `markdown.ts`, `judge-score.ts`, `coach-feedback.ts`, `agent-judgments.ts`

## Web app
- React 19 + Vite. Largest hub: `src/web/src/App.tsx`.
- Browser uses project labels or masked paths (no raw absolute paths).

## Code size
~164 TypeScript files, ~41k LOC, 58 test files.
