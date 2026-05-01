# Adapter Guide

`prompt-memory` adapters normalize tool-specific hook payloads into one internal event contract.

## Adapter Contract

An adapter must produce `NormalizedPromptEvent` from `src/shared/schema.ts`.

Required fields:

- `tool`
- `source_event`
- `prompt`
- `session_id`
- `cwd`
- `created_at`
- `received_at`
- `idempotency_key`
- `adapter_version`
- `schema_version`

Tool-specific fields such as `turn_id`, `transcript_path`, `model`, or `permission_mode` should be included only when the hook payload provides them.

## Rules

- Use official hook payloads as canonical ingest sources.
- Normalize control characters before storage.
- Reject non-absolute paths.
- Do not read upstream account tokens, OAuth tokens, browser cookies, CLI session tokens, or private state databases.
- Do not log raw prompt text.
- Keep idempotency stable for repeated delivery of the same hook event.
- Add fixture-based tests before implementation.
- Add one server ingest test that proves auth, redaction, and storage contracts match existing adapters.
- Add one storage integration test when the adapter is expected to write Markdown, SQLite, and FTS rows.

## Current Adapters

### Claude Code

- Tool name: `claude-code`
- Ingest route: `/api/v1/ingest/claude-code`
- Hook command: `prompt-memory hook claude-code`
- Install command: `prompt-memory install-hook claude-code`

### Codex Beta

- Tool name: `codex`
- Ingest route: `/api/v1/ingest/codex`
- Hook command: `prompt-memory hook codex`
- Install command: `prompt-memory install-hook codex`
- Status: beta

Codex hooks require `[features].codex_hooks = true` in `config.toml`.
