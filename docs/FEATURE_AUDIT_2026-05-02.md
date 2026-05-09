# Full Feature Audit

Date: 2026-05-02

## Conclusion

The PRD2 core feature set is implemented. Based on the local verification gates, this repository is a public beta release candidate.

The product identity is:

> AI coding prompt memory and improvement workspace, local-first.

In practical terms, `prompt-coach` is a developer tool that records prompts entered into AI coding tools such as Claude Code and Codex, stores them locally, helps users find them again, analyzes weak prompting patterns, and helps users rewrite the next request more clearly.

## Verification Gates

| Gate | Result | Coverage |
| --- | --- | --- |
| CLI help surface | Passed | Built CLI exposes the expected commands and subcommand help |
| `pnpm test` | Passed | 31 test files, 140 tests |
| `pnpm benchmark -- --json` | Passed | privacy, retrieval, coach, analytics, and latency thresholds |
| `pnpm e2e:browser` | Passed | archive, detail, coach, projects, export, mobile overflow |
| `pnpm smoke:release` | Passed | isolated build, CLI, server, storage, web, rebuild, delete, import, export smoke |

Benchmark v1 result from the audit run:

| Metric | Result |
| --- | ---: |
| `privacy_leak_count` | 0 |
| `retrieval_top3` | 1 |
| `coach_gap_fix_rate` | 1 |
| `analytics_score` | 1 |
| `ingest_p95_ms` | 11 |
| `search_p95_ms` | 2 |
| `dashboard_ms` | 9 |
| `export_ms` | 14 |

## Feature Inventory

### 1. Installation And Tool Connection

Available:

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
- Claude Code hook support
- Codex beta hook support
- fail-open hook wrapper

Storage and safety:

- setup and hook configuration are local files only
- hook stdout/stderr do not contain raw prompt bodies

Verdict:

- complete for public beta local setup and capture readiness

### 2. Prompt Capture And Storage

Available:

- Claude Code/Codex ingest API
- bearer-token ingest auth
- redaction before storage
- Markdown archive
- SQLite index
- SQLite FTS search index
- hard delete across Markdown, DB rows, FTS, events, and drafts
- `prompt-coach rebuild-index`

Storage model:

- Markdown is the human-readable source of truth
- SQLite is the searchable and aggregatable index

Verdict:

- complete for the MVP storage model

### 3. Archive Search And Review

Available:

- `prompt-coach list`
- `prompt-coach search`
- `prompt-coach show`
- `prompt-coach open`
- web archive list
- web prompt detail
- tool, project, tag, quality-gap, and imported-only filters
- bookmark and prompt events
- local quality dashboard

Storage and privacy:

- search is SQLite/FTS-backed
- browser APIs use project labels or masked paths instead of raw absolute paths by default

Verdict:

- complete for the "find an old useful prompt again" value proposition

### 4. Prompt Coach And Improvement Drafts

Available:

- `prompt-coach improve`
- local rule-based prompt improvement
- analysis preview and improvement draft in the prompt detail UI
- copy improvement draft
- save improvement draft
- fetch latest saved draft
- delete related drafts when the source prompt is deleted

Storage and safety:

- improvement drafts do not overwrite the original prompt
- drafts pass through redaction again before storage
- no external LLM API is called

Verdict:

- the copy-based Prompt Coach workflow is implemented
- quality is still a rule-based baseline and should be improved with beta feedback

### 5. Prompt Habit Analysis

Available:

- quality gap analysis
- dashboard metrics
- sensitive prompt count
- project distribution
- duplicate, reuse, saved, and quality-gap signals
- AGENTS.md/CLAUDE.md suggestion candidates
- Benchmark v1 analytics regression

Storage and safety:

- analysis results are stored locally in SQLite
- there is no external analysis route or client in the core product

Verdict:

- complete for MVP-level "show my weak prompting patterns"

### 6. Project Control Plane

Available:

- project list API and web UI
- project policy update API and web UI
- `capture_disabled`
- `export_disabled`
- `analysis_disabled` stored/displayed
- `retention_candidate_days` stored/displayed
- `external_analysis_opt_in` stored/displayed
- policy audit events

Storage and safety:

- policies and audit events are stored in SQLite
- browser surfaces show labels instead of raw project paths by default

Verdict:

- capture/export policy enforcement is connected to real execution paths
- analysis, retention, and external-analysis policy fields are reserved for future execution paths

### 7. Transcript Import

Available:

- `prompt-coach import --dry-run`
- `prompt-coach import --save-job`
- `prompt-coach import --execute`
- `prompt-coach import --resume`
- `prompt-coach import-job`
- malformed line tolerance
- assistant/tool/unsupported role skip
- large line skip
- idempotency key
- `import_records`
- imported-only list/search/API filter
- capture-disabled project import skip

Storage and safety:

- executed imports are redacted before Markdown/SQLite/FTS storage
- import jobs and records do not store raw prompt text, raw source paths, or raw secrets

Verdict:

- CLI-centered import is complete
- there is no web import upload UI yet

### 8. Anonymized Export

Available:

- `prompt-coach export --anonymized --preview`
- `prompt-coach export --anonymized --job`
- web export preview
- web export execution
- included/excluded field summary
- sensitive count
- residual identifier count
- small-set warning
- preview job invalidation
- JSON copy/download UI

Storage and safety:

- export job snapshots do not store raw prompt ids, raw cwd, raw paths, or raw secrets
- export payloads contain anonymized ids, masked prompts, tags, quality gaps, coarse dates, and project aliases

Verdict:

- public-safe anonymized export is complete
- raw export is intentionally not implemented

### 9. Web UI

Available:

- archive list
- prompt detail
- Prompt Coach panel
- project policy screen
- export screen
- dashboard/quality view
- delete confirmation
- copy/download interactions
- desktop/mobile layout

Verification:

- automated browser E2E checks archive -> detail -> coach copy/save -> projects -> export -> mobile overflow

Verdict:

- core public beta UI is functional

### 10. Privacy And Local-First Security

Available:

- local-only default behavior
- prompt/secret redaction
- browser/export raw path masking
- ingest bearer auth
- browser state-changing API CSRF protection
- fail-open hook wrapper
- privacy regression fixture
- raw-free anonymized export
- no hidden external LLM analysis

Known boundary:

- redaction is best effort
- Settings/local diagnostics may show local paths to the local user

Verdict:

- the public claim should be "local-first, best-effort redaction, anonymized export"

### 11. Benchmark And Release Verification

Available:

- `pnpm benchmark`
- `pnpm benchmark -- --json`
- `pnpm e2e:browser`
- `pnpm smoke:release`
- `pnpm pack:dry-run`
- release checklist

Measured areas:

- privacy leak count
- search retrieval top-k
- coach gap fix rate
- analytics usefulness
- ingest/search/dashboard/export latency

Verdict:

- the repository can measure product-value regressions, not just functional correctness

## Explicitly Not Implemented

- automatic prompt interception, rewrite, and resubmission into Claude Code/Codex
- always-allow auto-approval for rewritten prompts
- hidden external LLM/API based prompt scoring
- GitHub integration
- web import upload UI
- raw export
- semantic embedding search
- real-user archive based opt-in benchmark
- full macOS/Windows/Linux arm64 release smoke matrix

## Remaining Risks

- Benchmark v1 uses synthetic fixtures, so it does not fully represent real-user usefulness.
- Prompt Coach is rule-based and may not improve complex coding requests deeply enough.
- Settings/local diagnostics can expose some raw paths to the local user.
- `better-sqlite3` has platform-specific native install risk.
- Codex support should remain labeled as a beta adapter.

## Recommended Next Steps

1. Write release notes.
2. Decide whether to tag and publish the public beta.
3. Lock Node 22/24 release gates in GitHub Actions.
4. Expand macOS/Windows/Linux arm64 smoke coverage.
5. Design beta feedback collection for Prompt Coach quality.
