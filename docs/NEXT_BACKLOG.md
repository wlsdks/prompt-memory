# Next Backlog (post 2026-05-08 multi-track session)

This is the prioritized "what to pick up next" list after the multi-track
session that landed Tracks B/C/A2/A3 as PRs and Tracks A1/A4 as Proposed
ADRs. It is intentionally short. The PRD itself
(`docs/PRD.md`, `docs/PRD_PHASE2.md`) and the completion audit
(`docs/PRD2_COMPLETION_AUDIT.md`) remain the source of truth for product
scope; this file is the operational queue.

## What we know is done

- Phase 2 product scope is implemented for the local public beta candidate
  (see `docs/PRD2_COMPLETION_AUDIT.md`).
- Per-session 2026-05-08 deliveries: CLI `UserError` discipline (PR #237),
  service CLI plain-text + launchctl error mapping (PR #238), ingest
  pipeline extracted with importer redaction-reject fix (PR #239), shared
  coaching threshold module (PR #240), ADRs 0001 and 0002 (PR #241).

## Prioritized queue

### 1. User-flow validation passes (high signal, low cost)

The Phase 2 features are implemented; the open question is whether the
flows feel right end to end. Two quick passes are worth scheduling before
investing in more refactors:

- **MCP coach loop audit**: run a real Claude Code session through
  `score_prompt` → `improve_prompt` → `record_clarifications` → store, and
  log every friction point that requires the user to context-switch (open
  a terminal, run a CLI command, leave the agent). Outcome: a punch list of
  copy/paste-shaped fixes.
- **Reuse loop audit**: pick a stored high-score prompt, find it via the
  web UI search, and try to reuse it for a new task (copy → edit →
  resubmit). Note where the path breaks (e.g. is "copy this prompt"
  visible? is there a "fork into draft"?). Outcome: a punch list of UX
  fixes, possibly one or two new UI affordances.

These are user-perspective tasks rather than refactors. They should run in
a fresh session with the explicit role of "user trying to do work" rather
than "engineer touching code."

### 2. ADR-0001 Option A — codify MCP per-tool default

Smallest concrete refactor in the queue. Options are recorded in
`docs/adr/0001-mcp-per-tool-modules.md`. Action items:

- Add a one-paragraph rule to `docs/ARCHITECTURE.md` stating that new MCP
  tools default to the per-tool layout
  (`src/mcp/<tool-name>-tool.ts`).
- Optionally introduce `src/mcp/registry.ts` (Option C) to remove the
  manual `PROMPT_MEMORY_MCP_TOOL_HANDLERS` literal in `server.ts`. Keep the
  legacy `score-tool-*.ts` files in place.

### 3. ADR-0002 implementation — capability negotiation

Medium-cost refactor. Options are recorded in
`docs/adr/0002-storage-capability-registry.md`. Pre-work: list every
optional storage method consumed today and the failure mode each call site
chose. Then introduce a small `requireCapabilities(storage, [...])`
helper at route registration time. Stretch: extend the same idea to MCP
tool registration so `tools/list` filters out unavailable tools.

### 4. `App.tsx` query-hook extraction (Track A candidate 5)

Held during the Track A grilling because the value is technical-debt
reduction rather than feature gain. Worth scheduling once the user-flow
audits surface a concrete "this UI behavior was hard to add because of
App.tsx" signal. Until that lands, the file size budget and existing
component split keep it manageable.

### 5. UI patrol cron (Track E)

`ui-patrol` skill set up to keep design regressions visible across
sessions. Low-touch operationally.

## Explicit non-goals

- External LLM provider integrations remain gated beta scope per
  `docs/PRD_PHASE2.md` §10. Do not promote them into core.
- "Project policy dormant fields" (`analysis_disabled`,
  `retention_candidate_days`, `external_analysis_opt_in`) are reserved for
  future execution paths and should not be wired up before the user flow
  exists to consume them.
- The CLI `--json` raw `cwd` field on `list/search/show` is design intent
  for automation/restore; do not redact it.
