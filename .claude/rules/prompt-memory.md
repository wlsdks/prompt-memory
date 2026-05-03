# prompt-memory Claude Rules

Claude Code must follow these repository rules in addition to `CLAUDE.md` and
`AGENTS.md`.

## Product Identity

- `prompt-memory` is an AI coding prompt memory and improvement workspace,
  local-first.
- It helps Claude Code/Codex users capture prompts locally, find them again,
  analyze weak prompt habits, and write better next requests.
- The product must never become a cloud-first prompt logger or an automatic
  prompt resubmitter.

## Architecture

- Read `docs/ARCHITECTURE.md` before structural changes.
- Keep entrypoints thin:
  - `src/cli`: Commander commands and terminal formatting
  - `src/server`: Fastify HTTP/auth/validation boundary
  - `src/hooks`: fail-open hook wrapper and status
  - `src/mcp`: MCP tool contracts, handlers, and stdio server
  - `src/web`: React UI and browser-only models
- In `src/mcp`, keep tool definitions/schemas in `score-tool-definitions.ts`,
  argument/result contracts in `score-tool-types.ts`, handler orchestration in
  `score-tool.ts`, and JSON-RPC routing in `server.ts`.
- Put reusable rules in:
  - `src/analysis`
  - `src/redaction`
  - `src/storage`
  - `src/shared`
- Use ESM-compatible imports. For type-only dependencies, use `import type`.
- Do not add new domain logic directly to large hub files unless the change is
  clearly part of that boundary.

## Privacy

- Do not print raw prompt bodies, hook payloads, raw absolute paths, tokens,
  secrets, or instruction file bodies.
- Hook stdout is dangerous because it can become model context. Keep capture
  hooks quiet and fail-open.
- MCP and CLI outputs must be local-only and metadata-oriented unless the user
  explicitly asks for their own stored prompt content.
- Tests may use fake secrets only to verify redaction, and must assert those
  fake values are not retained in outputs.

## Verification

Run the relevant targeted tests first, then the release gate:

```sh
pnpm test
pnpm lint
pnpm format
pnpm build
pnpm pack:dry-run
git diff --check
```

For UI work, also run the browser E2E path and inspect the rendered screen.

## Git

- Do not push directly to `main`.
- Commit in focused units using Conventional Commits.
- Push the current branch and keep its pull request updated.
- In the solo-maintainer phase, merge only after Node 22/24 CI passes and unresolved conversations are clear.
- Re-enable one required approving review once an external collaborator or reviewer is available.
