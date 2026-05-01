# prompt-memory Implementation Plan

작성일: 2026-05-01  
상태: Implementation Ready  
관련 문서: [PRD.md](./PRD.md), [TECH_SPEC.md](./TECH_SPEC.md)

## 1. 목적

이 문서는 `prompt-memory` MVP 구현을 실제 작업 단위로 분해한다. PRD는 제품 요구사항을, TECH_SPEC은 기술 설계를 정의한다. 이 문서는 어떤 순서로 구현하고, 각 단계가 언제 완료됐다고 볼지 정의한다.

MVP core 완료 기준은 다음이다.

- Claude Code `UserPromptSubmit` hook으로 prompt를 수집한다.
- 저장 전 redaction이 적용된다.
- Markdown 파일과 SQLite 인덱스가 생성된다.
- CLI와 최소 웹 UI에서 목록/검색/상세/삭제가 가능하다.
- 서버가 꺼져 있어도 Claude Code 사용 흐름을 막지 않는다.
- 첫 public beta release 기준에는 Codex adapter가 beta 수준으로 fixture 기반 검증을 통과해야 한다.

## 2. 원칙

- PRD/TECH_SPEC과 충돌하는 구현 결정을 코드에서 임의로 하지 않는다.
- 저장 전 redaction을 우선한다.
- hook wrapper는 항상 fail-open을 기본으로 한다.
- raw prompt는 일반 로그에 남기지 않는다.
- Markdown을 source of truth로 유지하고 SQLite는 인덱스로 취급한다.
- 먼저 CLI와 storage를 안정화하고, 그 다음 웹 UI를 붙인다.

## 3. Phase Overview

| Phase | 목표 | 완료 결과 |
| --- | --- | --- |
| P0 | 프로젝트 골격 | TypeScript package, Node/SQLite/package smoke |
| P1 | Core contracts and bootstrap | shared schema, fixtures, config/init/token, ID/hash |
| P2 | Claude ingest/redaction | Fastify server, auth, Claude ingest API, redaction, storage boundary |
| P3 | Storage | Markdown writer, SQLite migration, FTS, ingest persistence |
| P4 | Claude Code hook | hook wrapper, install/uninstall, doctor |
| P5 | Read/delete API and CLI | prompt API, list/search/show/delete/open/rebuild-index |
| P6 | Web UI | list/detail/settings, sanitized preview |
| P7 | Codex beta | adapter, install/uninstall, fixture tests |
| P8 | Hardening | docs, security tests, release readiness |

## 4. P0: Project Skeleton

### Tasks

- Create `package.json`.
- Configure `pnpm`.
- Configure TypeScript.
- Configure Vitest.
- Configure lint/format scripts.
- Add CLI entrypoint.
- Add build output directory.
- Add `engines.node: >=22 <25`.
- Add CI config target for Node 22 and Node 24.
- Verify `better-sqlite3` install smoke test on current machine.
- Add package dry-run script.

### Files

- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `vitest.config.ts`
- `src/cli/index.ts`
- `src/shared/version.ts`
- `.github/workflows/ci.yml`

### Commands

```sh
pnpm install
pnpm test
pnpm build
pnpm prompt-memory --help
pnpm pack:dry-run
```

### Acceptance

- `pnpm test` passes.
- `pnpm build` passes.
- CLI help prints without crashing.
- `better-sqlite3` can open an in-memory database.
- `better-sqlite3` smoke test verifies WAL and FTS5 on the current machine.
- `pnpm pack:dry-run` shows built CLI files and excludes irrelevant source/test artifacts according to package policy.

## 5. P1: Core Contracts And Bootstrap

### Tasks

- Define `NormalizedPromptEvent`.
- Define `StoredPrompt`.
- Define `RedactionResult`.
- Define config schema.
- Add Claude Code fixture.
- Add Codex fixture.
- Implement config loader and writer.
- Implement `prompt-memory init`.
- Generate app token.
- Generate ingest token.
- Generate web session secret.
- Create data, prompt, log, spool, and quarantine directories.
- Apply owner-only permissions for config, token, secret, DB, log, and prompt paths.
- Implement ID generation.
- Implement stored content HMAC helper.
- Implement safe path helper.

### Files

- `src/shared/schema.ts`
- `src/shared/ids.ts`
- `src/shared/hashing.ts`
- `src/shared/time.ts`
- `src/storage/paths.ts`
- `src/config/config.ts`
- `src/config/tokens.ts`
- `src/cli/commands/init.ts`
- `src/adapters/types.ts`
- `src/adapters/fixtures/claude-code-user-prompt-submit.json`
- `src/adapters/fixtures/codex-user-prompt-submit.json`

### Acceptance

- Fixtures validate with Zod schemas.
- ID generation is deterministic in tests when time/randomness is mocked.
- HMAC helper does not expose raw prompt.
- Path helper resolves user home and rejects traversal attempts.
- `prompt-memory init` creates `config.json`, `hook-auth.json`, app token, ingest token, web session secret, and required directories.
- Token and secret files are owner-only.
- Re-running `prompt-memory init` is idempotent and does not rotate existing secrets unless explicitly requested.

## 6. P2: Claude Ingest And Redaction

### Tasks

- Create Fastify server factory.
- Add `/api/v1/health`.
- Add auth middleware.
- Add ingest token support.
- Add app token support.
- Add `/api/v1/ingest/claude-code`.
- Implement Claude Code adapter normalization.
- Implement redaction detectors.
- Implement redaction policy: `mask`, `raw`, `reject`.
- Add storage port/interface and a mocked storage implementation for P2 tests.
- Add capture exclusion checks before persistence boundary.
- Add path canonicalization for `cwd`, `project_root`, and `transcript_path`.
- Add string normalization, control character handling, and field length limits.
- Add Host validation.
- Add Origin/Sec-Fetch-Site validation for browser-originated requests.
- Add default deny-all CORS.
- Add body size, prompt length, query length, and rate limits.
- Ensure raw prompt is not logged.

### Files

- `src/server/create-server.ts`
- `src/server/auth.ts`
- `src/server/errors.ts`
- `src/server/routes/health.ts`
- `src/server/routes/ingest.ts`
- `src/adapters/claude-code.ts`
- `src/redaction/redact.ts`
- `src/redaction/detectors.ts`
- `src/storage/ports.ts`

### Acceptance

- Unauthenticated ingest is rejected.
- Wrong ingest token is rejected.
- Valid Claude Code fixture normalizes.
- Empty prompt is rejected.
- `mask` mode removes detected secrets.
- `reject` mode does not call the storage port.
- Capture exclusion does not call the storage port.
- Invalid Host is rejected.
- Cross-origin browser request is rejected.
- Default CORS policy does not allow arbitrary origins.
- Oversized body, oversized prompt, oversized query, and rate limit overflow are rejected.
- String fields are normalized and unsafe control characters are rejected or removed according to schema policy.
- Path fields are canonicalized and traversal attempts are rejected.
- Server logs do not include raw prompt, auth header, cookie, or CSRF header.
- Server returns RFC 7807 problem responses.

## 7. P3: Storage

### Tasks

- Implement data directory initialization.
- Implement owner-only permission setup.
- Implement SQLite connection.
- Implement migration runner.
- Add initial DDL.
- Enable WAL mode.
- Implement repositories.
- Implement Markdown writer.
- Implement Markdown reader.
- Implement FTS insert/update/delete.
- Implement FTS query escaping and search limits.
- Implement idempotency check.
- Implement storage reconciliation basics.
- Connect Claude ingest route to real storage.

### Files

- `src/storage/sqlite.ts`
- `src/storage/migrations/001_initial.sql`
- `src/storage/repositories/prompts.ts`
- `src/storage/repositories/projects.ts`
- `src/storage/repositories/sessions.ts`
- `src/storage/repositories/settings.ts`
- `src/storage/markdown.ts`

### Acceptance

- First run creates data directory, DB, and prompts directory.
- Migration table records `001_initial`.
- Ingest writes one Markdown file.
- Ingest writes one SQLite prompt row.
- Duplicate ingest returns existing prompt and creates no extra file.
- FTS search finds stored prompt.
- Malformed FTS syntax returns validation error without SQL injection risk.
- `rebuild-index` re-runs redaction validation before writing FTS rows.
- `redactionMode=mask` does not store raw secret in Markdown, SQLite, or FTS.
- Claude ingest writes one prompt end-to-end through API, redaction, Markdown, SQLite, and FTS.

## 8. P4: Claude Code Hook Integration

### Tasks

- Implement hook wrapper.
- Wrapper reads stdin JSON.
- Wrapper reads ingest token from owner-only token file.
- Wrapper posts to local server with short timeout.
- Wrapper exits `0` when server is down.
- Wrapper writes empty stdout.
- Implement `install-hook claude-code`.
- Implement `install-hook claude-code --dry-run`.
- Implement `uninstall-hook claude-code`.
- Add settings backup.
- Add duplicate hook detection.
- Add doctor checks for Claude Code.

### Files

- `src/hooks/wrapper.ts`
- `src/hooks/post-to-server.ts`
- `src/cli/commands/install-hook.ts`
- `src/cli/commands/uninstall-hook.ts`
- `src/cli/commands/doctor.ts`

### Acceptance

- Hook wrapper does not print prompt to stdout/stderr.
- Server down does not block hook execution.
- Dry run shows intended settings diff.
- Install backs up existing settings.
- Install does not duplicate existing prompt-memory hook.
- Uninstall removes hook and hook token.
- Doctor detects missing server, missing token, invalid settings, and last ingest status.

## 9. P5: Read/Delete API And CLI

### Tasks

- Implement `server`.
- Implement `GET /api/v1/prompts`.
- Implement `GET /api/v1/prompts/:id`.
- Implement `DELETE /api/v1/prompts/:id`.
- Implement `list`.
- Implement `search`.
- Implement `show`.
- Implement `delete`.
- Implement `open`.
- Implement `rebuild-index`.
- Add CLI output formatting.

### Files

- `src/cli/commands/server.ts`
- `src/server/routes/prompts.ts`
- `src/cli/commands/list.ts`
- `src/cli/commands/search.ts`
- `src/cli/commands/show.ts`
- `src/cli/commands/delete.ts`
- `src/cli/commands/open.ts`
- `src/cli/commands/rebuild-index.ts`

### Acceptance

- `prompt-memory server` starts local server.
- `GET /api/v1/prompts` returns cursor-paginated newest-first results.
- `GET /api/v1/prompts/:id` returns metadata and stored Markdown body.
- `DELETE /api/v1/prompts/:id` requires auth and CSRF/same-origin protection for cookie-authenticated web requests.
- `prompt-memory list` shows recent prompts.
- `prompt-memory search <query>` returns FTS results.
- `prompt-memory show <id>` prints metadata and stored body.
- `prompt-memory delete <id>` removes Markdown, DB row, tag links, analysis, redaction events, queue references, and FTS row.
- `prompt-memory rebuild-index` recreates SQLite/FTS from Markdown.
- Given three stored prompts, list/search/show/delete behavior is consistent between API and CLI.

## 10. P6: Web UI

### Tasks

- Add Vite React setup.
- Add API client.
- Add local session cookie flow.
- Add prompt list page.
- Add filters.
- Add prompt detail page.
- Add sanitized Markdown preview.
- Add settings page.
- Add delete action.
- Serve built assets from Fastify.
- Build web assets during prepack/release.
- Keep Vite as a devDependency only.

### Files

- `src/web/index.html`
- `src/web/src/App.tsx`
- `src/web/src/api.ts`
- `src/web/src/routes/PromptList.tsx`
- `src/web/src/routes/PromptDetail.tsx`
- `src/web/src/routes/Settings.tsx`
- `src/server/routes/static.ts`

### Acceptance

- Browser can open prompt list.
- Browser can view prompt detail.
- Dangerous Markdown does not execute script.
- `javascript:`, `data:`, `file:` links are blocked.
- External images are not loaded.
- Delete action requires CSRF/same-origin protection.
- Fastify serves built web assets with CSP: `default-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'`.
- Runtime package install does not require Vite.

## 11. P7: Codex Beta

### Tasks

- Complete Codex adapter tests.
- Add `/api/v1/ingest/codex`.
- Implement Codex adapter normalization.
- Implement `install-hook codex`.
- Implement `install-hook codex --dry-run`.
- Implement `uninstall-hook codex`.
- Detect `[features].codex_hooks`.
- Detect duplicate hooks across user/project sources.
- Add Codex doctor checks.

### Files

- `src/adapters/codex.ts`
- `src/server/routes/ingest.ts`
- `src/hooks/wrapper.ts`
- `src/cli/commands/install-hook.ts`
- `src/cli/commands/uninstall-hook.ts`
- `src/cli/commands/doctor.ts`

### Acceptance

- Codex fixture normalizes.
- Codex ingest route uses the same auth, validation, redaction, idempotency, and storage contracts as Claude ingest.
- Codex hook wrapper exits fail-open.
- Codex install does not corrupt existing config.
- Duplicate Codex hook detection works across user/project sources.
- Codex beta status is visible in docs/help text.

## 12. P8: Hardening

### Tasks

- Add README installation guide.
- Add non-affiliation notice.
- Add privacy/security section.
- Add supported platforms section.
- Add adapter contribution guide.
- Add issue templates.
- Add security regression tests.
- Add release checklist.
- Add cross-platform CI matrix for Node 22 and Node 24.
- Add `better-sqlite3` install/open/WAL/FTS5 smoke tests on macOS x64/arm64, Linux x64/arm64, and Windows x64 where runner support allows.
- Add npm package contents verification.
- Ensure external LLM analysis code path is absent or disabled by default.

### Acceptance

- README explains storage location, deletion, external transmission defaults, and hook removal.
- README does not imply OpenAI/Anthropic affiliation.
- Tests verify no OAuth/session token extraction.
- Tests verify raw prompt is not logged.
- Tests verify redacted values do not appear in Markdown/SQLite/FTS.
- Tests verify invalid Host/Origin/Sec-Fetch-Site handling.
- Tests verify CSRF/same-origin protection on state-changing cookie-authenticated web requests.
- Tests verify FTS query escaping and query length limits.
- Tests verify hard delete removes Markdown, SQLite rows, FTS rows, analyses, tag links, redaction events, and queue references.
- Package dry run includes built CLI and built web assets.
- Release CI verifies Node 22/24.
- Release CI verifies `better-sqlite3` install/open/WAL/FTS5 on supported release platforms.
- `pnpm test` and `pnpm build` pass.

## 13. Dependency Order

```text
P0
  -> P1
    -> P2
      -> P3
        -> P4
        -> P5
          -> P6
      -> P7
        -> P8
```

P1 must provide config/init/token bootstrap before P2 auth and P4 hook work begin. P2 proves security, normalization, redaction, and persistence boundary with mocked storage. P3 connects the boundary to Markdown/SQLite/FTS. P4 and P5 can proceed after P3 because both need real storage. P6 begins after P5 read/delete API behavior is stable. P7 Codex beta can start after P2 contracts are stable, but release hardening in P8 remains the final gate.

## 14. Definition Of Done

Core MVP is done when:

- All P0-P6 acceptance items pass.
- Node 22/24 CI passes.
- Package dry run includes built CLI files and built web assets.
- `better-sqlite3` release smoke tests pass on supported platforms or a documented fallback decision is made before release.
- The app can capture one Claude Code prompt end-to-end.
- The captured prompt is visible in CLI and web UI.
- The prompt can be deleted cleanly.
- `doctor` can diagnose common install and runtime failures.
- No raw secret appears in Markdown, SQLite, FTS, diagnostics, or web preview under `mask` mode.

First public beta release is done when:

- Core MVP is done.
- P7 fixture tests pass and Codex is clearly labeled beta.
- P8 security/documentation checks pass.

## 15. First Implementation Task

Start with P0.

Concrete first task:

```text
Scaffold TypeScript package with pnpm, Commander CLI, Vitest, and a smoke test that opens an in-memory better-sqlite3 database.
```
