# Efficiency Review

Date: 2026-05-02

Status: Phase 2 planning input

## Conclusion

`prompt-memory` has moved beyond the first MVP. It already includes local capture, local storage, search, delete, hook install/diagnostics, web UI, local rule-based analysis, tags, quality gaps, dashboard metrics, reuse signals, duplicate detection, project policy, import, export, Prompt Coach, benchmark, and release smoke coverage.

The next work should not simply add more analysis features. The strongest improvements are the ones that reduce user effort and release risk:

1. make old prompts easy to import safely
2. make project-level capture/export policy clear
3. turn weak prompts into better next requests
4. keep risky flows behind preview, consent, and audit boundaries

## Current Efficiency Assessment

| Area | Current state | Assessment |
| --- | --- | --- |
| Setup/capture | `setup`, service, Claude Code/Codex hooks, doctor, statusline | High |
| Storage/recovery | Markdown source of truth, SQLite/FTS, `rebuild-index`, hard delete | High |
| Search/review | list/search/detail, URL filters, snippets, queue navigation | High |
| Analysis | `local-rules-v1`, checklist, tags, dashboard, project profile | Medium-high |
| Reuse | copy event, bookmark, reused focus, useful prompt surfaces | Medium-high |
| Duplicate handling | exact duplicate groups from redacted content hash | Medium |
| Project control | project policy UI/API for capture/export boundaries | Medium-high |
| Historical data | CLI transcript import with dry-run/execute/resume | High for power users |
| External analysis | intentionally not implemented | Deferred |
| Release validation | benchmark, browser E2E, release smoke, pack dry-run | High |

## User Workflow Efficiency

The strongest current workflow is "find, inspect, and reuse prompts that already exist." The web UI opens directly on useful product surfaces instead of a marketing page, search/filter state is visible, dashboard drilldown links back to prompt lists, and Prompt Coach gives a copy-based improvement path.

The remaining workflow gap is deeper prompt iteration. The product can propose a better draft, but it does not yet compare versions, measure downstream task success, or learn from accepted/rejected improvements.

## Development Efficiency

The implementation is still compact enough for a single TypeScript package. CLI, server, storage, and web are separated well enough for public beta iteration.

Risk areas:

- `src/storage/sqlite.ts` is large and may need splitting when more reconciliation or job logic is added.
- project policy, import jobs, and export jobs have different lifecycles from prompt rows and should remain clearly separated.
- external LLM analysis would require security, consent, audit, cost, preview, and provider UI; it should not be treated as a small analyzer replacement.

## Priority Order

| Priority | Candidate | Value | Risk/cost | Decision |
| --- | --- | --- | --- | --- |
| 1 | Project Control Plane | High | Medium | Needed for capture/export/analysis boundaries |
| 2 | Transcript Import | Very high | High | Gives value from historical prompts |
| 3 | Prompt Improvement Workspace | High | Medium | Connects memory to better next prompts |
| 4 | Anonymized Export | Medium | Medium | Useful for review/sharing with privacy constraints |
| 5 | External LLM Analysis | High | High | Keep outside core until opt-in boundaries are mature |
| 6 | Semantic Duplicate/Cluster | Medium | High | Defer until local embedding or opt-in approach is clear |

## Development Rules For Future Work

- Do not expose raw prompts through stdout, server errors, browser URLs, or dashboard aggregates.
- Apply project policy consistently to capture, import, export, and future analysis.
- Provide dry-run or preview before risky import/export/analysis operations.
- Keep Markdown as the source of truth and SQLite as a rebuildable index.
- Add storage/API tests first; verify UI changes in a browser.
