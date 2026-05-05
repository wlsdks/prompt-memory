# Task Completion Checklist

Run before declaring a task complete or opening a PR.

## 1. Targeted tests first
- Run the narrowest relevant vitest scope (e.g. `pnpm test -- src/storage`).
- Add or update tests for new behavior. TDD is the default.

## 2. Full local gate
```sh
pnpm test
pnpm lint
pnpm format        # prettier --check; use pnpm format:write to auto-fix
pnpm build
pnpm pack:dry-run
git diff --check
```

## 3. Surface-specific
- **UI / server changes**: `pnpm e2e:browser` and inspect the rendered page (Playwright). Verify desktop + mobile viewport, empty/error states, delete confirmation, no text overlap.
- **Hook changes**: confirm fail-open behavior, no raw prompt body or token in stdout/stderr.
- **MCP changes**: keep `score-tool-definitions.ts` / `score-tool-types.ts` / `score-tool.ts` / `server.ts` separation; output schema must remain redaction-safe.
- **Storage changes**: keep `sqlite.ts` / `sqlite-rows.ts` / `sqlite-json.ts` separation; verify rebuild-index round-trips.
- **Release-affecting changes**: `pnpm smoke:release` and `pnpm benchmark -- --json`.

## 4. Privacy regression
- Confirm CLI / MCP / hook / browser outputs do not leak prompt bodies, raw absolute paths, tokens, or instruction file bodies.
- New tests that touch redaction must use fake secrets and assert the fakes are not retained downstream.

## 5. Docs / package contents
- Update `CHANGELOG.md` for user-visible changes.
- Update `docs/PACKAGE_CONTENTS.md` if new runtime/public surface ships.
- Update relevant `docs/*.md` (PRD / ARCHITECTURE / TECH_SPEC / ADAPTERS / PRE_PUBLISH_PRIVACY_AUDIT) when the change affects them.

## 6. Git
- Commit in focused units with Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- Push the working branch (never push to `main` directly).
- Open or update the PR.
- Solo-maintainer merge: only after `test (22)` and `test (24)` pass and unresolved conversations are clear.

## 7. Final report
Final response to the user must include:
- Commit hash(es)
- Push status
- Verification commands run + their results
- Any remaining risks or follow-ups
