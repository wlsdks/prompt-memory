# Tech Stack

## Runtime / Language
- **Node.js** `>=22 <25`, ESM (`"type": "module"`).
- **TypeScript** with `module: NodeNext`, `moduleResolution: NodeNext` for server/CLI.
- Browser UI compiled separately by Vite with `moduleResolution: Bundler`.
- Explicit `.js` import specifiers, `import type` for type-only deps.

## Package manager
- **pnpm 10.x** (packageManager pinned to `pnpm@10.18.0`).

## Production dependencies
- `better-sqlite3` — embedded SQLite + FTS5
- `fastify` — local HTTP server (Fastify v5)
- `commander` — CLI framework
- `zod` — schema validation
- `yaml` — YAML parsing
- `recharts` — web dashboard charts

## Dev dependencies
- `vitest` — unit and integration tests
- `playwright` — browser E2E
- `vite` — web bundler
- `prettier` — formatter
- `react` 19 / `react-dom` 19 / `lucide-react`

## Storage
- Markdown archive (source of truth) + SQLite (index) with FTS5 search.
- Defaults under `~/.prompt-memory/`. POSIX permissions: `0700` for sensitive dirs, `0600` for token/config files.

## Quality gates
- `vitest` test suite (~58 test files)
- benchmark v1 (`scripts/benchmark.mjs`)
- release smoke (`scripts/release-smoke.mjs`)
- browser E2E (`scripts/browser-e2e.mjs`)
- quality gate lint (`scripts/quality-gate.mjs`)
- GitHub Actions CI on Node 22 and Node 24
