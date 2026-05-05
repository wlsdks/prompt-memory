# prompt-memory Technical Spec

Date: 2026-05-01

Status: Public beta candidate

Related docs:

- [PRD.md](./PRD.md)
- [PRD_PHASE2.md](./PRD_PHASE2.md)
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)

## 1. Purpose

This document defines the technical design for `prompt-memory`, an AI coding prompt memory and improvement workspace, local-first.

The implementation records prompts from supported AI coding tools, redacts sensitive values, stores a Markdown archive, indexes prompts in SQLite/FTS, serves a local web UI, and provides CLI workflows for setup, search, review, import, export, and prompt improvement.

## 2. Stack

| Area            | Choice                           | Reason                                             |
| --------------- | -------------------------------- | -------------------------------------------------- |
| Language        | TypeScript                       | shared types across CLI, server, adapters, and web |
| Runtime         | Node.js 22/24                    | npm distribution and native dependency support     |
| Package manager | pnpm                             | deterministic lockfile and scripts                 |
| CLI             | Commander                        | simple command surface                             |
| HTTP server     | Fastify                          | local API, validation, low overhead                |
| Database        | SQLite                           | local-first single-file storage                    |
| SQLite driver   | better-sqlite3                   | simple local transactions                          |
| Query layer     | direct SQL + repository boundary | transparent migrations and FTS                     |
| Web UI          | Vite + React                     | small local web app                                |
| Validation      | Zod                              | runtime schema validation                          |
| Testing         | Vitest                           | TypeScript unit/integration tests                  |

Unsupported for the public beta:

- Electron shell
- cloud sync
- hidden external LLM analysis
- hosted backend

## 3. Package Layout

```text
src/
  adapters/
  analysis/
  cli/
  config/
  exporter/
  hooks/
  importer/
  mcp/
  redaction/
  server/
  shared/
  storage/
  web/
scripts/
docs/
commands/
plugins/
integrations/
```

Architecture rules and module ownership are documented in
[ARCHITECTURE.md](./ARCHITECTURE.md). In short, `cli`, `server`, `hooks`, `mcp`,
and `web` are runtime entrypoints; reusable local rules belong in `analysis`,
`redaction`, `storage`, or `shared`.

`dist/` contains built CLI/server modules and web assets. The npm package ships built files and does not require Vite at runtime.

## 4. Data Locations

Default storage lives under the user's home directory.

Expected data categories:

- config
- ingest token
- app/session secret
- Markdown archive
- SQLite database
- logs/diagnostics without prompt bodies

Permissions:

- POSIX systems should prefer owner-only permissions for tokens and config.
- Windows should use owner-only ACL checks where applicable.

## 5. Core Flow

### Capture Flow

1. User installs hooks through `prompt-memory setup` or `install-hook`.
2. Claude Code/Codex sends a hook payload.
3. The hook wrapper normalizes the payload.
4. The wrapper posts to the local ingest API with a bearer token.
5. The local server validates and redacts.
6. Markdown is written.
7. SQLite prompt rows and FTS rows are inserted.
8. Local analysis is calculated.
9. The hook fails open if the server is unavailable.

Important rules:

- hook stdout is empty for prompt capture
- hook failures do not block the AI coding tool
- prompt bodies are not logged
- tokens are never printed
- optional Prompt Rewrite Guard may return supported `UserPromptSubmit` JSON
  output. `block-and-copy` blocks weak prompts and shows a local improvement
  draft for manual paste/enter. It does not type into the terminal, replace
  composer text, or auto-submit prompts.
- optional `context` mode adds model-visible rewrite guidance and is not a true
  prompt replacement.

### Search Flow

1. CLI or web UI requests prompt list/search.
2. Server queries SQLite and FTS.
3. Response returns redacted snippets and masked project labels by default.
4. Detail API returns the stored prompt content according to the local storage policy.

### Delete Flow

Hard delete removes:

- Markdown file
- prompt row
- FTS row
- redaction rows
- prompt events
- tags/analysis metadata
- improvement drafts

### Rebuild Flow

`rebuild-index` treats Markdown as the source of truth and rebuilds prompt index/FTS state. User-owned policy/job tables are preserved.

### MCP Prompt Scoring Flow

1. User registers `prompt-memory mcp` with a local MCP client such as Claude Code
   or Codex.
2. The client launches the command as a stdio subprocess.
3. The MCP server exposes `get_prompt_memory_status`, `coach_prompt`,
   `score_prompt`, `improve_prompt`, `apply_clarifications`,
   `ask_clarifying_questions`, `record_clarifications`,
   `prepare_agent_rewrite`, `record_agent_rewrite`, `score_prompt_archive`,
   `review_project_instructions`, `prepare_agent_judge_batch`, and
   `record_agent_judgments`.
4. `get_prompt_memory_status` checks whether local storage is initialized,
   whether prompts have been captured, and which MCP tool to call next.
5. `score_prompt` accepts exactly one of direct prompt text, a stored prompt id,
   or `latest: true`.
6. Direct prompt text is analyzed locally and is not stored.
7. Stored prompt scoring reads existing local analysis from SQLite and does not
   return prompt bodies.
8. `improve_prompt` accepts exactly one of direct prompt text, a stored prompt
   id, or `latest: true`, then returns a copy-based draft that requires user
   approval before resubmission.
9. `prepare_agent_rewrite` returns one locally redacted prompt body, local score
   metadata, a local baseline draft, and a rewrite contract for the active
   Claude Code, Codex, or Gemini CLI session. `prompt-memory` does not call a
   provider or route credentials for this workflow.
10. `record_agent_rewrite` stores the active agent session's approved rewrite as
    a redacted improvement draft without returning the rewrite body or storing
    the original prompt body.
11. Archive scoring reads recent prompt summaries from SQLite and returns an
   aggregate score, distribution, recurring quality gaps, practice plan, next
   prompt template, and low-score prompt ids without prompt bodies or raw paths.
12. Project instruction review reads local project metadata from SQLite, can
    rescan `AGENTS.md` / `CLAUDE.md`, and returns checklist metadata without
    instruction file bodies or raw paths.
13. `prepare_agent_judge_batch` returns a bounded set of locally redacted
    prompt bodies plus a rubric for the active Claude Code, Codex, or Gemini CLI
    session to judge. `prompt-memory` does not call a provider or route
    credentials for this workflow.
14. `record_agent_judgments` stores advisory scores, confidence, risks, and
    suggestions from the active agent session without prompt bodies or raw
    paths.
15. Read MCP tools are declared as read-only, idempotent, and local-only through
    tool annotations. `record_agent_rewrite` and `record_agent_judgments` are
    declared as non-destructive write tools. Every tool declares an MCP
    `outputSchema`, and `tools/call` returns both serialized JSON text and
    `structuredContent` for clients that can consume structured tool results.

Important rules:

- stdout is reserved for newline-delimited JSON-RPC MCP messages
- no hidden external LLM calls are made by `prompt-memory`
- agent rewrite/judge mode is explicit: the active user-controlled agent
  session rewrites or judges redacted packets and then records approved metadata
- MCP read tool definitions include read-only/local-only risk hints
- MCP rewrite/judgment recording tools are non-destructive write tools; rewrite
  recording stores a redacted draft and judgment recording stores metadata only
- MCP tool definitions include `outputSchema` for structured result fields
- MCP tool responses include `structuredContent` plus a JSON text content block
- direct MCP prompt input is not written to Markdown or SQLite
- improvement MCP results are copy-based drafts, are never auto-submitted, and
  archive-backed rewrites do not return the stored original prompt body
- MCP tool results return score metadata and checklist explanations, not prompt
  bodies
- status MCP results are readiness metadata only and never include prompt bodies
  or raw absolute paths
- archive MCP results are metadata-only and bounded by `max_prompts`
- project instruction MCP results are metadata-only and never include file
  bodies or raw absolute paths
- agent-judge packet results may include redacted prompt bodies by explicit
  request, but never raw prompt bodies, raw absolute paths, or secrets

## 6. Adapter Contract

Adapters produce a normalized prompt event.

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

Rules:

- use official hook payloads as canonical ingest sources where available
- normalize control characters
- reject invalid path values
- keep idempotency stable
- do not read upstream account tokens or private state databases
- add fixture tests for each adapter

## 7. API Design

### Shared Rules

- bind to `127.0.0.1` by default
- deny CORS by default
- validate Host/Origin/Sec-Fetch-Site for browser requests
- use bearer auth for ingest
- use app/session access and CSRF protection for browser mutations
- cap request body and prompt lengths
- do not log request/response bodies
- do not echo rejected raw values in validation errors

### Route Groups

| Route group                  | Purpose                                       |
| ---------------------------- | --------------------------------------------- |
| `/api/v1/health`             | server health                                 |
| `/api/v1/session`            | local browser session and CSRF                |
| `/api/v1/ingest/claude-code` | Claude Code ingest                            |
| `/api/v1/ingest/codex`       | Codex ingest                                  |
| `/api/v1/prompts`            | list/search/detail/events/improvements/delete |
| `/api/v1/score`              | archive prompt score review                   |
| `/api/v1/projects`           | project list and policy mutation              |
| `/api/v1/exports`            | anonymized export preview and execution       |
| `/api/v1/settings`           | local diagnostics/config view                 |

## 8. Storage Design

Primary SQLite tables:

- `schema_migrations`
- `prompts`
- `prompt_fts`
- `redaction_events`
- `prompt_events`
- `prompt_tags`
- `prompt_analysis`
- `prompt_improvement_drafts`
- `project_policies`
- `policy_audit_events`
- `import_jobs`
- `import_records`
- `import_errors`
- `export_jobs`

FTS:

- indexes redacted prompt content and searchable metadata
- must not contain raw detected secrets in mask mode

Transactions:

- prompt creation writes Markdown and SQLite index coherently
- delete cleans all dependent prompt data
- export/import jobs store raw-free summaries/snapshots

## 9. Redaction

Redaction runs before persistent storage and before improvement draft storage.

Detected categories can include:

- API keys
- bearer tokens
- private keys
- credentials
- absolute paths in prompt bodies where configured

Public beta claim:

- redaction is best effort
- users should not rely on it as a complete DLP system

## 10. Analysis And Prompt Coach

Local analysis is deterministic and rule-based.

It detects prompt quality gaps:

- goal missing
- context missing
- scope missing
- verification missing
- output format missing

It also derives a local Prompt Quality Score:

- range: `0-100`
- weights: goal clarity `25`, background context `20`, scope limits `20`, output format `15`, verification criteria `20`
- status scoring: `good` earns full weight, `weak` earns half weight, `missing` earns zero
- bands: `excellent >= 85`, `good >= 60`, `needs_work >= 40`, `weak < 40`

Prompt Coach creates a copy-based improvement draft. Drafts:

- do not overwrite source prompts
- can be copied
- can be saved locally
- are redacted before storage
- are deleted with the source prompt

## 11. Import Design

Import supports:

- dry-run
- save raw-free job summary
- execute
- resume
- idempotency
- imported-only filtering

Parser rules:

- allowlist supported record shapes
- skip assistant/tool/unsupported records
- skip very large lines
- tolerate malformed records
- never store raw source path, raw secret, or raw import payload in job summaries

## 12. Export Design

Public beta export is anonymized-only.

Preview:

- computes included/excluded fields
- counts prompts and sensitive records
- counts residual identifier categories
- stores raw-free `export_jobs`

Execute:

- accepts only `job_id`
- validates preview membership/count/policy/redaction state
- returns anonymized payload

Payload:

- anonymous id
- tool
- coarse date
- project alias
- masked prompt
- tags
- quality gaps

Excluded:

- raw prompt id
- raw cwd/project path/transcript path
- tokens/secrets
- raw metadata

## 13. Web UI Design

The UI is a dense local developer tool.

Core screens:

- archive list
- prompt detail
- Prompt Coach panel
- dashboard
- projects
- export

UI requirements:

- no marketing landing page as the primary surface
- no nested cards for major app layout
- responsive desktop/mobile behavior
- no horizontal overflow on supported mobile viewport
- state-changing actions use CSRF-protected API calls

## 14. Testing Strategy

Required test layers:

- unit tests for redaction, hashing, analysis, adapters
- storage tests for SQLite/FTS/delete/rebuild/job behavior
- CLI command tests
- API auth/CSRF/privacy tests
- privacy regression fixture
- browser E2E
- release smoke
- benchmark
- package dry-run

Core commands:

```sh
pnpm test
pnpm lint
pnpm build
pnpm benchmark -- --json
pnpm e2e:browser
pnpm smoke:release
pnpm pack:dry-run
git diff --check
```

## 15. Release Boundary

The public beta can claim:

- local-first prompt archive
- Claude Code MVP support
- Codex beta support
- Markdown source of truth
- SQLite/FTS index
- CLI and web UI
- Prompt Coach copy/save workflow
- project capture/export policy
- CLI import
- anonymized export
- local benchmark and release smoke
- opt-in MCP agent-judge packet and judgment metadata storage

The public beta must not claim:

- full secret-proof redaction
- provider-hosted or hidden external LLM analysis
- automatic prompt resubmission
- GitHub integration
- stable cross-platform support beyond validated platforms
