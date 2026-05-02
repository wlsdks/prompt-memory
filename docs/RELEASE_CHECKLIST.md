# Release Checklist

Use this checklist before publishing a public beta or npm package.

## Scope

- [ ] README describes install, init, server, hook install, doctor, uninstall, and delete flows.
- [ ] README states the default storage path.
- [ ] README states that local rule-based analysis preview is implemented.
- [ ] README states that Prompt Coach is copy-based and does not auto-resubmit prompts into Claude Code or Codex.
- [ ] README states that transcript import is CLI-centered and has no web upload UI.
- [ ] README states that browser export is anonymized-only and raw export is not implemented.
- [ ] README documents Benchmark v1 as a local regression baseline, not a real-user quality proof.
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
- [ ] `pnpm benchmark -- --json`
- [ ] `pnpm e2e:browser`
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
- [ ] `docs/BENCHMARK_V1.md`
- [ ] `docs/RELEASE_CHECKLIST.md`
- [ ] `scripts/benchmark.mjs`
- [ ] `scripts/browser-e2e.mjs`
- [ ] `scripts/release-smoke.mjs`

## Security Regression

- [ ] Raw detected secrets are absent from Markdown under `mask` mode.
- [ ] Raw detected secrets are absent from SQLite prompt rows and FTS search results under `mask` mode.
- [ ] Raw prompt-body absolute paths are redacted from Markdown, SQLite, FTS, browser prompt APIs, export surfaces, import job summaries, and hook stdout/stderr.
- [ ] Invalid payload values are not echoed in error responses.
- [ ] Hook wrappers fail open and do not write prompt text to stdout/stderr.
- [ ] Browser state-changing requests require same-origin session and CSRF protection.
- [ ] Ingest routes require bearer auth.
- [ ] Host, Origin, and cross-site browser request checks are enforced.
- [ ] Delete removes Markdown, prompt row, FTS row, redaction events, and related prompt metadata.
- [ ] Anonymized export jobs are invalidated when previewed prompt membership, deletion state, project policy versions, redaction version, or preview counts change.

## PRD2 Feature Regression

- [ ] Project list and policy toggle work in the web UI without exposing raw project paths.
- [ ] `capture_disabled` project policy blocks new ingest for that project.
- [ ] `capture_disabled` project policy skips matching import candidates for known projects.
- [ ] `prompt-memory import --dry-run --save-job` stores a raw-free job summary.
- [ ] `prompt-memory import --execute` imports prompt candidates and supports resume/idempotency.
- [ ] Imported-only filter works in CLI/API list flows.
- [ ] Prompt detail shows local analysis and Prompt Coach draft.
- [ ] Prompt Coach draft can be copied and saved without overwriting the original prompt.
- [ ] Export preview and execute work from both CLI and web UI.
- [ ] Benchmark v1 passes with `privacy_leak_count` equal to 0.
- [ ] Browser E2E passes on desktop and mobile viewport checks.

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
- [ ] Confirm Prompt Coach copy/save works in the web UI.
- [ ] Confirm anonymized export preview and execution work.
- [ ] Confirm Benchmark v1 passes.
- [ ] Delete a prompt and confirm it disappears from CLI and web UI.

## Deferred For Non-CI Local Beta

These items are recommended before a broader public release, but can be deferred for a local-only beta when explicitly documented in release notes:

- [ ] Cross-platform GitHub Actions matrix for macOS, Linux, and Windows.
- [ ] `better-sqlite3` install/open/WAL/FTS5 smoke on each supported release platform.
