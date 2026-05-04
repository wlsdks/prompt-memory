# Changelog

All notable changes to prompt-memory will be documented in this file.

The format follows a simple reverse-chronological release log. This project is
currently pre-release, so entries may change before `1.0.0`.

## 0.1.0-beta.0 - Unreleased

This is the first public beta. The release covers local capture, storage,
search, deletion, prompt analysis, project policy, transcript import,
anonymized export, Prompt Coach drafts, Prompt Practice workspace, MCP scoring
tools, benchmark/release validation, and an English/Korean web UI.

### Added

#### Setup and capture

- `prompt-memory setup`, `prompt-memory init`, `prompt-memory doctor`,
  `prompt-memory hook`, `prompt-memory install-hook`/`uninstall-hook`,
  `prompt-memory statusline`/`install-statusline`/`uninstall-statusline`,
  and `prompt-memory service` for guided local installation and diagnostics.
- `setup --profile coach` to register a low-friction rewrite guidance profile
  through hook context, with a Claude Code status line installed when
  Claude Code is detected.
- `setup --register-mcp` to register `prompt-memory mcp` with detected
  Claude Code and/or Codex CLIs.
- `prompt-memory start --open-web` to launch the local server and open the
  web workspace on a new agent session.
- Claude Code hook wrapper, settings install, and doctor checks.
- Codex beta hook adapter, install, and doctor checks.
- `prompt-memory buddy` for hook diagnostics during a live session.

#### Storage and recovery

- Markdown source-of-truth archive with SQLite/FTS search index.
- Hard delete across Markdown, DB rows, FTS, events, and drafts.
- `prompt-memory rebuild-index` to reconstruct the SQLite index from the
  Markdown archive.
- Project quality profiles persisted in SQLite.
- Reused-prompt focus, duplicate prompt candidate detection, and
  local prompt usefulness tracking.

#### Web UI

- Archive list with prompt snippets, active filter bar, tool/project/tag/
  quality-gap/imported-only filters, and prompt focus filters.
- Prompt detail view with analysis preview, improvement draft, agent follow-up
  commands, queue navigation, gap drilldown, and return action.
- Quality dashboard with metric drilldown, distribution drilldown, trend, and
  trend day drilldown.
- Project policy screen with capture/export/analysis/retention/external-analysis
  fields and audit events.
- Agent command center and vertical status line surfaces.
- Anonymized export preview and execution UI with included/excluded field
  summary, sensitive count, residual identifier count, and small-set warning.
- English/Korean language switch.

#### Prompt Coach and Prompt Practice

- Local rule-based analysis preview (`local-rules-v1`) and checklist.
- `prompt-memory improve` and `prompt-memory coach` commands.
- Approval-based Prompt Coach with copy/save improvement draft, latest-saved
  draft fetch, and related-draft cleanup on prompt deletion.
- Coach follow-up commands and recommended next agent action.
- Prompt Practice workspace with one-click builder, fixed-draft copy action,
  score history, and outcome feedback that does not store draft text.

#### Import and export

- `prompt-memory import` with `--dry-run`, `--save-job`, `--execute`,
  `--resume`, and `prompt-memory import-job` for transcript import jobs.
- Capture-disabled project import skip and imported-only filtering.
- `prompt-memory export --anonymized` with `--preview` and `--job` for
  raw-free anonymized export.

#### MCP and agent workflows

- Local stdio MCP server (`prompt-memory mcp`) with prompt scoring tools.
- Agent prompt wrappers, agent-assisted rewrite workflow, and
  agent-mediated judge tools for explicit redacted-packet handoff.
- Prompt rewrite guard that prevents silent prompt resubmission.

#### Validation and packaging

- Local benchmark v1 with privacy, retrieval, coach, analytics, and latency
  thresholds (`pnpm benchmark`, `pnpm benchmark -- --json`).
- Browser E2E smoke covering archive, detail, coach, projects, export, and
  mobile overflow (`pnpm e2e:browser`).
- Local release smoke harness (`pnpm smoke:release`) covering isolated build,
  CLI, server, storage, web, rebuild, delete, import, and export.
- Claude Code and Codex marketplace plugin packaging.
- English and Korean README, full feature audit, release readiness docs,
  marketplace install guide, package contents check, and pre-publish privacy
  audit.

### Changed

- Activation flow simplified so that `setup --profile coach` covers MCP
  registration and the status line in one step instead of separate commands.
- Web app, prompt detail, prompt practice, and habit coach panel split into
  component-owned modules and CSS so that `App.tsx` and the global
  stylesheet do not accumulate per-screen logic.
- MCP tool contracts split into definitions, types, handler orchestration, and
  JSON-RPC routing so that adding a tool does not touch one large file.
- Storage boundaries clarified between query/transaction, row contracts, and
  defensive JSON decoding.
- Solo-maintainer PR rules documented so that public beta merges no longer
  require an external approving review while remaining gated on Node 22 and
  Node 24 CI plus resolved conversations.
- Prompt-memory product identity statement aligned across docs, CLI help,
  setup output, and Coach surface text.

### Fixed

- Installed Claude Code and Codex hooks now use a stable absolute CLI path
  so that hook execution survives `npm`/`pnpm` global path differences.
- Existing Claude Code status line commands are preserved and chained when
  the prompt-memory status line is installed, and restored on uninstall.
- Multiline Claude Code status line output is preserved instead of being
  collapsed to a single line.
- Web filter controls now have stable accessible names so that screen
  reader and automated UI checks do not collide on duplicate labels.

### Security

- Local-only server binding by default.
- Hook ingest bearer token stored locally; same-origin session cookie and
  CSRF protection for browser writes.
- Best-effort redaction before Markdown, SQLite, and FTS storage in mask mode,
  including explicit secret assignments and Google API keys.
- Browser/export raw path masking; export job snapshots do not store raw
  prompt ids, raw cwd, raw paths, or raw secrets.
- Privacy regression checks for Markdown, SQLite, FTS, browser APIs, import
  jobs, export jobs, and hook output.
- Prompt Coach output redaction hardened so that improvement drafts and
  follow-up commands do not leak prompt body, raw paths, or tokens.
- Agent judge / MCP rewrite handoff is opt-in and routes through the user's
  active Claude Code/Codex/Gemini CLI session; prompt-memory does not extract
  or proxy provider credentials and does not call external LLMs from its own
  process.
