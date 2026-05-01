# Release Checklist

Use this checklist before publishing a public beta or npm package.

## Scope

- [ ] README describes install, init, server, hook install, doctor, uninstall, and delete flows.
- [ ] README states the default storage path.
- [ ] README states that local rule-based analysis preview is implemented.
- [ ] README states that external LLM analysis is not implemented and external prompt transmission is disabled by default.
- [ ] README includes a non-affiliation notice for Anthropic and OpenAI.
- [ ] Codex is clearly labeled beta.
- [ ] Adapter guide is up to date.
- [ ] Security policy is up to date.

## Verification

- [ ] `pnpm format`
- [ ] `pnpm test`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm pack:dry-run`
- [ ] `pnpm smoke:release`
- [ ] `git diff --check`

## Package Contents

Confirm `pnpm pack:dry-run` includes:

- [ ] built CLI files under `dist/cli`
- [ ] built server files under `dist/server`
- [ ] built web assets under `dist/web`
- [ ] `README.md`
- [ ] `SECURITY.md`
- [ ] `docs/PRD.md`
- [ ] `docs/TECH_SPEC.md`
- [ ] `docs/IMPLEMENTATION_PLAN.md`
- [ ] `docs/ADAPTERS.md`
- [ ] `docs/RELEASE_CHECKLIST.md`
- [ ] `scripts/release-smoke.mjs`

## Security Regression

- [ ] Raw detected secrets are absent from Markdown under `mask` mode.
- [ ] Raw detected secrets are absent from SQLite prompt rows and FTS search results under `mask` mode.
- [ ] Invalid payload values are not echoed in error responses.
- [ ] Hook wrappers fail open and do not write prompt text to stdout/stderr.
- [ ] Browser state-changing requests require same-origin session and CSRF protection.
- [ ] Ingest routes require bearer auth.
- [ ] Host, Origin, and cross-site browser request checks are enforced.
- [ ] Delete removes Markdown, prompt row, FTS row, redaction events, and related prompt metadata.

## CI

- [ ] Node 22 CI passes.
- [ ] Node 24 CI passes.
- [ ] `better-sqlite3` opens a database and supports WAL/FTS5 in CI.
- [ ] Platform support notes are accurate for the release.

## Manual Smoke

`pnpm smoke:release` automates the core local smoke path below with an isolated temporary data directory and HOME.

- [ ] `prompt-memory init`
- [ ] `prompt-memory server`
- [ ] `prompt-memory install-hook claude-code --dry-run`
- [ ] `prompt-memory install-hook codex --dry-run`
- [ ] Capture one fixture-like Claude Code prompt.
- [ ] Capture one fixture-like Codex prompt.
- [ ] Confirm both prompts appear in CLI.
- [ ] Confirm both prompts appear in the web UI.
- [ ] Delete a prompt and confirm it disappears from CLI and web UI.

## Deferred For Non-CI Local Beta

These items are recommended before a broader public release, but can be deferred for a local-only beta when explicitly documented in release notes:

- [ ] Cross-platform GitHub Actions matrix for macOS, Linux, and Windows.
- [ ] `better-sqlite3` install/open/WAL/FTS5 smoke on each supported release platform.
