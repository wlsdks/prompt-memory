# prompt-memory Phase 2 PRD

Date: 2026-05-02

Status: Implemented for PRD2 core

Related docs:

- [PRD.md](./PRD.md)
- [EFFICIENCY_REVIEW.md](./EFFICIENCY_REVIEW.md)
- [TECH_SPEC.md](./TECH_SPEC.md)
- [PRD2_COMPLETION_AUDIT.md](./PRD2_COMPLETION_AUDIT.md)

## 1. Purpose

Phase 2 expands `prompt-memory` from a safe local prompt archive into a local-first prompt memory and improvement workspace.

The product should help users:

- operate capture/export policy per project
- import old prompt history safely
- understand weak prompt habits
- rewrite the next prompt more clearly
- export anonymized data without leaking raw local identifiers

This document is an implementation PRD, not a business KPI document. Completion is judged by feature behavior, privacy boundaries, recovery behavior, tests, browser checks, and release smoke.

## 2. Baseline Before Phase 2

The baseline already included:

- Claude Code/Codex prompt capture
- fail-open hooks
- setup, doctor, server, service, and statusline commands
- Markdown archive
- SQLite/FTS index
- hard delete
- `rebuild-index`
- CLI list/search/show/delete/open
- web list/detail/dashboard/settings
- local session cookie and CSRF protection
- local rule-based analysis preview
- checklist, tags, quality gaps, and suggestions
- copy/bookmark/reuse signals
- exact duplicate detection
- release smoke and pack dry-run

## 3. Phase 2 Core Scope

Phase 2 core is limited to:

1. Project Control Plane
2. Transcript Import
3. Prompt Improvement Workspace
4. Import execution/resume hardening
5. Anonymized Export
6. Benchmark/browser/release regression coverage

External LLM analysis and tool-assisted analysis are not Phase 2 core. They require a later gated beta.

## 4. Product Principles

- Preserve local-first defaults.
- Keep external transmission disabled.
- Apply project policy consistently to capture, import, export, and future analysis.
- Use preview or dry-run before risky operations.
- Never damage existing Markdown/SQLite data during import/export.
- Run generated drafts through redaction before storage.
- Do not automatically edit `AGENTS.md`, `CLAUDE.md`, or project settings.
- Do not automatically replace or resubmit prompts into Claude Code/Codex.

## 5. Shared Security And API Requirements

- All Phase 2 browser APIs require app access.
- All mutations and preview job creation routes require CSRF protection.
- Ingest bearer tokens are not accepted for management APIs.
- Problem details, audit events, and browser responses must not include raw prompts, raw secrets, provider API keys, tokens, or raw import payloads.
- Browser project/prompt surfaces must not expose raw paths by default.
- Provider responses, rewrite drafts, instruction candidates, and imported transcript text are untrusted content.
- UI rendering must reuse the sanitizer/CSP boundary.
- `AGENTS.md` and `CLAUDE.md` suggestions are copy-only unless a future explicit write flow is added.

## 6. Project Control Plane

Goal:

- let users inspect and control project-level capture/export/analysis boundaries

Implemented capabilities:

- project list API
- project policy update API
- project policy web UI
- `capture_disabled`
- `export_disabled`
- stored/displayed `analysis_disabled`
- stored/displayed `retention_candidate_days`
- stored/displayed `external_analysis_opt_in`
- policy audit events
- raw path masking on browser surfaces

Acceptance criteria:

- policy mutation requires app access and CSRF
- project API responses do not include tokens, raw prompts, raw secrets, or raw transcript paths
- capture-disabled projects do not persist new prompt ingest
- capture-disabled known projects skip matching import candidates
- export candidate selection respects export-disabled policy
- policy audit events are raw-free

## 7. Transcript Import

Goal:

- allow users to bring historical prompt records into the local archive safely

Implemented capabilities:

- `prompt-memory import --dry-run`
- `prompt-memory import --save-job`
- `prompt-memory import --execute`
- `prompt-memory import --resume`
- `prompt-memory import-job`
- raw-free import job summaries
- malformed record tolerance
- assistant/tool/unsupported role skip
- large line skip
- idempotency key
- `import_records`
- imported-only filters

Acceptance criteria:

- dry-run does not create prompt Markdown, prompt index rows, or FTS rows
- executed import redacts before storage
- one malformed record does not stop the whole import
- assistant/tool output is not stored as user prompt content
- imported prompts appear in list/search/detail/dashboard flows
- imported-only filters work

Public beta boundary:

- import is CLI-centered
- web import upload UI is not implemented

## 8. Prompt Improvement Workspace

Goal:

- help users turn weak prompts into clearer next requests

Implemented capabilities:

- `prompt-memory improve`
- `local-rules-v1` improvement generation
- prompt detail improvement panel
- copy improvement draft
- save improvement draft
- latest draft retrieval
- draft cleanup on prompt delete
- Benchmark v1 coach metric

Acceptance criteria:

- drafts do not overwrite source prompts
- drafts pass through redaction before storage
- raw secrets are not reintroduced
- copy/save interactions work in web UI
- prompt deletion removes related drafts

Public beta boundary:

- no automatic resubmission into Claude Code/Codex
- no external LLM judge or rewrite provider

## 9. Anonymized Export

Goal:

- let users inspect and export a privacy-preserving review dataset

Implemented capabilities:

- CLI anonymized preview/job flow
- web anonymized preview/execution
- raw-free `export_jobs`
- `job_id` execution
- included/excluded field summary
- sensitive count
- residual identifier count
- small-set warning
- preview invalidation
- JSON copy/download UI

Acceptance criteria:

- export jobs store no raw prompt ids, raw paths, raw cwd, or raw secrets
- export result contains masked prompts and anonymized metadata
- deleted prompts are excluded
- policy/redaction/count changes invalidate stale preview jobs
- browser UI does not expose raw export

Public beta boundary:

- raw export is not implemented

## 10. External Or Tool-Assisted Analysis Appendix

External LLM analysis is excluded from Phase 2 core.

This includes calling installed tools such as Claude Code or Codex as analysis executors. That may avoid storing a separate provider API key, but the payload can still leave the local machine through the user's tool account. It is not local-only.

Any future gated beta must require:

- global opt-in
- project opt-in
- prompt-level preview
- redaction preview
- provider/model/command disclosure
- timeout and cost boundaries
- audit events
- no automatic project file writes
- no automatic `AGENTS.md` or `CLAUDE.md` writes

## 11. Implemented Storage Additions

Phase 2 adds or relies on:

- `project_policies`
- `policy_audit_events`
- `import_jobs`
- `import_records`
- `import_errors`
- `prompt_improvement_drafts`
- `export_jobs`

## 12. Verification Gates

Required:

- unit and storage tests for new data contracts
- API tests for auth/CSRF/privacy behavior
- browser E2E for archive/detail/coach/projects/export/mobile
- privacy regression fixture
- Benchmark v1
- release smoke
- pack dry-run

## 13. Final Status

PRD2 core is complete. The remaining work is release-oriented:

- English public documentation
- release notes
- beta tag and npm publish decision
- Node 22/24 CI gate
- cross-platform smoke expansion
- beta feedback loop for Prompt Coach quality
