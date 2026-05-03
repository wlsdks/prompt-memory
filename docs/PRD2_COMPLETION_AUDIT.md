# PRD2 Completion Audit

Date: 2026-05-02

## Conclusion

The PRD2 core feature set is complete for a local public beta candidate.

Implemented areas:

- Project Control Plane
- transcript import execution/resume
- Prompt Coach improvement drafts
- anonymized export preview/job flow
- local quality dashboard
- Benchmark v1 and browser E2E regression coverage

The remaining work is not core PRD2 implementation. It is release operations, cross-platform validation, and real-user feedback.

## Completion Matrix

| Area | Status | Evidence | Remaining work |
| --- | --- | --- | --- |
| Project identity/policy | Complete | `project_policies`, `policy_audit_events`, Projects API, policy UI, capture-disabled ingest/import, browser path masking | Connect analysis/retention/external policy fields when those future execution paths exist |
| Transcript import | Complete | `import --dry-run`, `--save-job`, `--execute`, `--resume`, `import_records`, imported-only filters | Web import UI/API is not implemented |
| Prompt Improvement Workspace | Complete | `improvePrompt`, `prompt-memory improve`, detail UI preview/copy/save, `prompt_improvement_drafts`, benchmark coach metric | Real-user quality evaluation after beta |
| Import execution/resume hardening | Complete | idempotency keys, resume job, assistant/tool skip, malformed record tolerance, redaction reapplication | Directory/glob import remains intentionally excluded |
| Anonymized export preset | Complete | CLI/UI preview, `export_jobs`, job execution, anonymization, small-set warning, invalidation | Raw export remains intentionally unsupported |
| External/tool-assisted analysis | Excluded from PRD2 core | PRD2 shipped without provider clients or hidden network paths; later MCP agent-judge is explicit and user-session mediated | Keep hidden/provider-routed LLM calls out of core |

## Key Notes

### Project Control Plane

Implemented:

- policy storage and audit events
- project list response without raw paths by default
- CSRF-protected policy mutation
- capture-disabled ingest blocking
- capture-disabled import candidate skip
- raw-free audit metadata

Current boundary:

- `analysis_disabled`, `retention_candidate_days`, and `external_analysis_opt_in` are stored/displayed for future execution paths.
- Settings/local diagnostics may still expose local paths to the local user.

### Transcript Import

Implemented:

- single JSONL dry-run
- raw-free import job summaries
- malformed record tolerance
- assistant/tool/unsupported role skip
- execute/resume with idempotency
- imported-only filtering
- release smoke coverage

Current boundary:

- import is CLI-centered
- no web upload UI exists yet

### Prompt Improvement Workspace

Implemented:

- local `local-rules-v1` prompt improvement
- CLI improvement command
- web detail preview/copy/save
- redaction before draft storage
- draft cleanup on prompt hard delete
- benchmark regression for coach output

Current boundary:

- improvement is rule-based
- no automatic prompt replacement or resubmission into Claude Code/Codex exists

### Anonymized Export

Implemented:

- anonymized export only in browser UI
- CLI preview/job flow
- raw-free `export_jobs`
- `job_id` execution
- masked prompt payload
- policy/redaction/count invalidation

Current boundary:

- raw export is intentionally unsupported for public beta

## Security And API Boundary

Satisfied:

- state-changing browser API requires app access and CSRF protection
- ingest API requires bearer auth
- hooks fail open
- hook stdout/stderr do not contain prompt bodies
- browser/export surfaces mask raw paths by default
- privacy regression checks secrets and raw paths across Markdown, SQLite, FTS, browser APIs, import jobs, export jobs, and hook outputs
- no hidden/provider-routed external LLM analysis path exists in core; the later
  MCP agent-judge path is explicit, redacted, and evaluated by the active
  user-controlled agent session

Partial:

- Settings/local diagnostics can include raw local paths for the local user

## Final Judgment

PRD2 implementation and the local public beta release gate are complete. The next release decision should be based on release notes, npm publishing readiness, CI/platform validation, and beta-user feedback collection.
