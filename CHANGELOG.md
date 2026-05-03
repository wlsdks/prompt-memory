# Changelog

All notable changes to prompt-memory will be documented in this file.

The format follows a simple reverse-chronological release log. This project is
currently pre-release, so entries may change before `1.0.0`.

## 0.1.0-beta.0 - Unreleased

### Added

- Local-first prompt capture for Claude Code and Codex beta hook flows.
- Markdown source-of-truth archive with SQLite/FTS search index.
- Local web UI for archive search, prompt detail review, deletion, project
  policy, anonymized export, quality dashboard, and Prompt Coach drafts.
- Copy-based Prompt Coach that produces approval-ready improvement drafts
  without automatically resubmitting prompts.
- Transcript import CLI with dry-run, saved jobs, execute/resume flow, and
  imported-only filtering.
- Anonymized export preview/job flow for CLI and web UI.
- Local benchmark v1 for privacy, retrieval, prompt improvement, analytics, and
  latency regression signals.
- English/Korean web UI language switch.
- English and Korean README files.

### Security

- Local-only server binding by default.
- Hook ingest bearer token stored locally.
- Same-origin session cookie and CSRF protection for browser writes.
- Best-effort redaction before Markdown, SQLite, and FTS storage in mask mode.
- Privacy regression checks for Markdown, SQLite, FTS, browser APIs, import
  jobs, export jobs, and hook output.
