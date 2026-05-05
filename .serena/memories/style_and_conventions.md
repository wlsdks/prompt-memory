# Style & Conventions

## Language / Communication
- **Reply in Korean** in this repo (per `CLAUDE.md`).
- Commit messages and code identifiers stay English; user-facing prose can be Korean.

## TypeScript
- ESM only. `module: NodeNext`, explicit `.js` import specifiers.
- `import type { Foo } from "./foo.js"` for type-only deps.
- No Spring-style Controller/Service/Repository hierarchy. Prefer pure functions, small modules, explicit ports.
- Never expand large hub files (`src/web/src/App.tsx`, `src/storage/sqlite.ts`, `src/mcp/score-tool.ts`) without first extracting helpers.
- Do not mix tool/schema definitions, type contracts, handler orchestration, and JSON-RPC routing in a single file (MCP).
- Do not mix query/transaction, row contract, and JSON decoding in a single file (storage).

## Design rules
- Simplicity first. Keep change scope small.
- No band-aid fixes; find the cause and lock it with a test.
- Default to no comments. Add only when *why* is non-obvious.
- Avoid unrelated refactors when fixing a bug.

## Privacy / security rules (hard requirements)
- Never print raw prompt bodies, raw absolute paths, hook payloads, tokens, secrets, or instruction file bodies in CLI/MCP/hook outputs.
- Hook stdout is dangerous because it can become model context — keep capture hooks quiet and fail-open.
- MCP and CLI outputs must be local-only and metadata-oriented unless the user explicitly asks for their own stored prompt content.
- Redaction is applied before Markdown / SQLite / FTS write.
- `prompt-memory` does not extract, store, proxy, or sell Claude.ai / Claude Code / OpenAI / Codex / ChatGPT / Gemini provider tokens.
- Agent judge / rewrite is opt-in and routed through the user's already-authenticated CLI session.

## Workflow
- Plan first for non-trivial work. If 3+ steps or any structural decision, write a checklist in `tasks/todo.md`.
- TDD by default: failing test -> implementation -> full verification.
- Save user corrections as recurrence-prevention rules in `tasks/lessons.md`.
- Commit in focused units, push the working branch, open or update a PR. Do not batch many changes into one commit.

## Git
- Never push to `main` directly.
- Conventional Commits.
- Solo-maintainer phase: PR may merge once CI `test (22)` and `test (24)` pass and unresolved conversations are clear.
- Re-enable a required approving review once an external collaborator joins.

## UI
- Read `DESIGN.md` before any UI work.
- This is a developer tool: quiet, dense work surfaces. No marketing hero or landing.
- Empty / error / delete-confirm states matter more than decoration.
