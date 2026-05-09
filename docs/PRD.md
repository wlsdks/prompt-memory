# prompt-coach PRD

Date: 2026-05-01

Status: Public beta candidate

## 1. Product Positioning

`prompt-coach` is an AI coding prompt memory and improvement workspace, local-first.

It records prompts entered into AI coding tools such as Claude Code and Codex, stores them locally, helps users search and review them, analyzes weak prompting patterns, and helps users write better follow-up requests.

The product is not a generic prompt library. It is a local developer tool for remembering, inspecting, improving, and safely reusing prompts from real coding workflows.

## 2. Goals

Core goals:

- capture supported AI coding tool prompts with explicit local setup
- redact sensitive values before storage
- store a human-readable Markdown archive
- index prompts in SQLite and FTS for fast local search
- expose CLI and local web UI review flows
- help users see recurring weak prompt patterns
- generate copy-based prompt improvement drafts
- support local recovery through `rebuild-index`
- keep external transmission disabled by default

Non-goals for the public beta:

- cloud sync
- team collaboration backend
- automatic prompt rewriting and resubmission into Claude Code/Codex
- hidden/provider-routed external LLM analysis
- raw export through the browser UI
- semantic embedding search

## 3. Users

Primary users:

- developers using Claude Code or Codex repeatedly during coding work
- maintainers who want a local record of their AI coding prompts
- power users who want to understand and improve their prompt habits

The user should be able to answer:

- What did I ask before?
- Which prompts worked well enough to reuse?
- What patterns make my prompts weak?
- How can I rewrite the next request more clearly?
- Where is my data stored, and how can I delete it?

## 4. Product Principles

- Local-first by default.
- Explicit setup before modifying tool configuration.
- Fail open so prompt capture never blocks the underlying AI coding tool.
- Markdown remains the source of truth.
- SQLite is a rebuildable index.
- Redaction is applied before persistent storage.
- Browser APIs should not expose raw absolute paths by default.
- Risky operations require preview or dry-run first.
- Hidden/provider-routed external LLM analysis is not core beta behavior. Any
  tool-assisted judge flow must be explicit, opt-in, redacted, and mediated by
  the user's active agent session.

## 5. Supported Tool Integrations

### Claude Code

Status: MVP path

Expected capabilities:

- install/uninstall hook configuration
- capture user prompt submit events
- post normalized prompt events to the local ingest API
- run doctor checks
- optional status line integration

### Codex

Status: beta adapter

Expected capabilities:

- install/uninstall hook configuration
- enable Codex hooks when supported
- capture prompt submit events through the Codex hook surface
- run doctor checks

Codex support should remain labeled beta until broader platform validation and user feedback are available.

## 6. Data Model

### Normalized Prompt Event

Adapters normalize tool payloads into one internal event contract:

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
- optional tool metadata such as model, transcript path, turn id, permission mode

Raw upstream account tokens, OAuth tokens, browser cookies, CLI session tokens, and private state databases must not be read or stored.

### Markdown Archive

Markdown is the human-readable source of truth. Each prompt is written with frontmatter plus the redacted prompt body.

Requirements:

- include schema version
- include tool and timestamps
- include project/cwd metadata as allowed by privacy policy
- store redacted prompt content by default
- avoid raw secrets in mask mode
- remain readable without the app

### SQLite Index

SQLite stores searchable and aggregatable data:

- prompt rows
- FTS rows
- redaction events
- prompt events
- quality analysis
- improvement drafts
- project policies
- import jobs/records
- export jobs

SQLite must be rebuildable from Markdown where applicable. User-owned policy and job tables are not destroyed by `rebuild-index`.

## 7. CLI Requirements

Required public commands:

- `prompt-coach setup`
- `prompt-coach init`
- `prompt-coach doctor`
- `prompt-coach hook`
- `prompt-coach install-hook`
- `prompt-coach uninstall-hook`
- `prompt-coach statusline`
- `prompt-coach install-statusline`
- `prompt-coach uninstall-statusline`
- `prompt-coach service`
- `prompt-coach server`
- `prompt-coach list`
- `prompt-coach search`
- `prompt-coach show`
- `prompt-coach open`
- `prompt-coach delete`
- `prompt-coach rebuild-index`
- `prompt-coach import`
- `prompt-coach import-job`
- `prompt-coach export`
- `prompt-coach improve`

CLI behavior:

- do not print raw prompt text unless the command is explicitly a local user-facing prompt view
- never print tokens or secrets
- support JSON output where useful for automation
- keep setup previewable with dry-run behavior

## 8. Local Server And API Requirements

The local server binds to loopback by default.

API requirements:

- ingest routes require bearer auth
- browser state-changing routes require app access and CSRF protection
- browser APIs reject cross-site access
- validation errors do not echo rejected raw values
- request logs do not include prompt bodies, tokens, cookies, or CSRF headers

Core route groups:

- health/session
- ingest
- prompts
- projects
- exports
- settings
- static web UI

## 9. Web UI Requirements

The web UI is an operational developer tool, not a marketing landing page.

Required screens:

- archive list
- prompt detail
- Prompt Coach panel
- quality/dashboard view
- project policy screen
- anonymized export screen
- delete confirmation

Required behavior:

- searchable/filterable prompt archive
- detail view with analysis and improvement draft
- copy-based prompt improvement workflow
- project policy toggles
- anonymized export preview and execution
- responsive desktop/mobile layout

## 10. Prompt Analysis And Coach

The public beta uses local rule-based analysis.

Analysis should identify:

- missing goal
- missing context
- missing scope
- missing verification criteria
- missing output format
- sensitive content signals
- reuse/bookmark/copy signals

Prompt Coach should:

- generate a clearer draft
- preserve user intent
- add goal, context, scope, verification, and output format sections
- pass through redaction before storage
- remain copy-based
- never auto-submit a rewritten prompt into Claude Code or Codex

## 11. Project Policy

Projects can have local policy fields:

- `capture_disabled`
- `export_disabled`
- `analysis_disabled`
- `retention_candidate_days`
- `external_analysis_opt_in`

Public beta execution paths:

- `capture_disabled` blocks new ingest for the project
- `capture_disabled` skips matching import candidates
- `export_disabled` excludes project prompts from export candidates

Reserved fields:

- `analysis_disabled`, retention, and external analysis fields are stored/displayed for future execution paths

## 12. Transcript Import

Import is CLI-centered in the public beta.

Required behavior:

- support dry-run before execution
- support raw-free saved import job summaries
- execute import with redaction
- support resume/idempotency
- skip assistant/tool/unsupported records
- tolerate malformed records
- avoid storing raw source paths, raw prompts, and raw secrets in import job output
- expose imported-only filters for review

No web upload UI is required for the public beta.

## 13. Anonymized Export

Public beta export is anonymized-only.

Required behavior:

- preview first
- create raw-free export jobs
- execute by `job_id`
- invalidate preview jobs when membership, deletion state, policy, redaction version, preset, or count changes
- include masked prompts, tags, quality gaps, tool, coarse date, and project alias
- exclude tokens, raw paths, raw metadata, and raw prompt ids
- warn about small-set re-identification risk

Raw export is intentionally not implemented for the browser or public beta CLI surface.

## 14. Privacy And Security Requirements

Required:

- best-effort redaction before storage
- no OAuth/session token extraction
- no upstream provider credential reuse
- local-only default
- no external prompt transmission by default
- same-origin browser protection
- bearer auth for ingest
- fail-open hook wrapper
- delete cleanup across Markdown, DB, FTS, redaction rows, events, and drafts

The README must clearly state:

- where data is stored
- how to delete prompts
- how to uninstall hooks
- that redaction is best effort
- that hidden provider calls are not implemented and optional agent-mediated
  judge flows require explicit user request
- that the project is not affiliated with Anthropic or OpenAI

## 15. Benchmark And Release Requirements

Required local gates:

- `pnpm test`
- `pnpm lint`
- `pnpm build`
- `pnpm benchmark -- --json`
- `pnpm e2e:browser`
- `pnpm smoke:release`
- `pnpm pack:dry-run`
- `git diff --check`

Benchmark v1 measures:

- privacy leak count
- retrieval top-k
- Prompt Coach gap fix rate
- Prompt Quality Score calibration
- analytics usefulness
- local runtime latency

## 16. Acceptance Criteria

The public beta is acceptable when:

- a new user can install, set up, and capture the first prompt locally
- hooks fail open when the server is unavailable
- prompts are redacted before persistent storage
- Markdown and SQLite records are created
- CLI and web UI can list/search/show/delete prompts
- Prompt Coach can produce and save copy-based improvement drafts
- project capture policy is enforced
- CLI import dry-run/execute/resume works
- anonymized export preview/job flow works
- privacy regression tests pass
- benchmark and release smoke pass
- package contents include built CLI/server/web assets and English/Korean public README documentation

## 17. Open Questions

- How should beta users provide feedback on Prompt Coach quality?
- When should semantic search be introduced, and should it be local-only?
- Should web import upload be added before a stable release?
- Which platforms should be considered officially supported after the beta?
- Should a future GitHub integration connect prompts to issues/PRs?
