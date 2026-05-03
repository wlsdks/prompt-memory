# prompt-memory Implementation Plan

Date: 2026-05-01

Status: Public beta candidate

Related docs:

- [PRD.md](./PRD.md)
- [TECH_SPEC.md](./TECH_SPEC.md)
- [PRD_PHASE2.md](./PRD_PHASE2.md)
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)

## 1. Purpose

This plan breaks `prompt-memory` into implementation phases and release gates.

The product identity is:

> AI coding prompt memory and improvement workspace, local-first.

The implementation goal is to help Claude Code and Codex users safely record prompts locally, find them again, understand weak prompting habits, and write better next requests through a copy-based Prompt Coach workflow.

## 2. Engineering Principles

- Keep Markdown as the source of truth.
- Treat SQLite as a rebuildable index.
- Redact before persistent storage.
- Keep hooks fail-open.
- Do not log prompt bodies or tokens.
- Prefer explicit setup and dry-run before writing tool configuration.
- Add tests before feature implementation where behavior is risky.
- Verify user-facing web changes in a real browser.
- Do not add external LLM/network analysis to the core beta.

## 3. Phase Overview

| Phase | Goal | Status |
| --- | --- | --- |
| P0 | Project skeleton and package smoke | Complete |
| P1 | Normalized event contract and adapters | Complete |
| P2 | Local server, auth, validation, redaction | Complete |
| P3 | Markdown, SQLite, FTS, delete, rebuild | Complete |
| P4 | Claude Code hook install/doctor | Complete |
| P5 | CLI list/search/show/delete/open | Complete |
| P6 | Web archive/detail/dashboard | Complete |
| P7 | Codex beta adapter | Complete |
| P8 | Release smoke and package readiness | Complete |
| P9 | Project Control Plane | Complete |
| P10 | Transcript import | Complete |
| P11 | Prompt Improvement Workspace | Complete |
| P12 | Anonymized export | Complete |
| P13 | Benchmark and browser E2E | Complete |
| P14 | English/Korean docs and npm beta readiness | In progress |

## 4. Public Beta Completion Criteria

The beta is implementation-complete when:

- setup initializes local config and storage
- Claude Code hook capture works
- Codex beta hook capture works
- hooks fail open
- prompts are redacted before storage
- Markdown and SQLite/FTS rows are created
- CLI can list/search/show/delete/open prompts
- web UI can list/search/detail/delete prompts
- Prompt Coach can create, copy, and save improvement drafts
- project capture/export policies are enforced
- CLI import dry-run/execute/resume works
- anonymized export preview/job flow works in CLI and web
- `rebuild-index` can recover prompt index state from Markdown
- benchmark and release smoke pass
- npm package includes built files and English/Korean public README docs

## 5. Verification Gates

Default gate:

```sh
pnpm test
pnpm lint
pnpm build
pnpm pack:dry-run
git diff --check
```

Release gate:

```sh
pnpm benchmark -- --json
pnpm e2e:browser
pnpm smoke:release
```

Package smoke:

```sh
npm pack
npm install -g ./prompt-memory-<version>.tgz
prompt-memory --help
```

## 6. Current Implemented Surface

CLI commands:

- `setup`
- `init`
- `doctor`
- `hook`
- `install-hook`
- `uninstall-hook`
- `statusline`
- `install-statusline`
- `uninstall-statusline`
- `service`
- `server`
- `list`
- `search`
- `show`
- `open`
- `delete`
- `rebuild-index`
- `import`
- `import-job`
- `export`
- `improve`

API groups:

- health
- session
- ingest
- prompts
- projects
- exports
- settings
- static web UI

Web screens:

- archive
- prompt detail
- Prompt Coach
- dashboard/quality
- projects
- export

## 7. Release-Readiness Work

Before the first npm beta publish:

- keep package version as a prerelease such as `0.1.0-beta.0`
- run the full release gate on Node 22
- ensure `npm pack --dry-run` includes built CLI/server/web files
- check that `dist/cli/index.js` is executable
- verify `npm whoami`
- verify package name availability or ownership
- publish with `npm publish --tag beta`

## 8. Deferred Work

Deferred from public beta:

- external LLM analysis
- Claude Code/Codex tool-assisted analysis
- automatic prompt rewrite/resubmission
- GitHub integration
- web import upload UI
- semantic embedding search
- raw export
- team/cloud sync
- full cross-platform release matrix

## 9. Next Steps After Beta

1. Add CI release gates for Node 22 and Node 24.
2. Expand smoke coverage across macOS, Linux, and Windows.
3. Collect beta feedback on Prompt Coach usefulness.
4. Decide whether to add web import upload.
5. Decide whether semantic search can remain local-first.
6. Revisit external/tool-assisted analysis only with explicit opt-in, preview, and audit.
