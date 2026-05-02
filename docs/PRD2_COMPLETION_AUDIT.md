# PRD2 Completion Audit

작성일: 2026-05-02

## 결론

PRD2 core 기능은 개발 완료로 볼 수 있다. 현재 구현은 Project Control Plane, transcript import 실행, Prompt Coach 개선 draft, anonymized export preview/job, local quality dashboard까지 실제 사용 가능한 수준으로 연결되어 있다.

다만 public beta release 완료로 보기는 아직 이르다. PRD2 수용 기준을 엄격히 적용하면 browser raw path 표시 경계, project policy의 import/export 후보 반영 범위, export job invalidation 조건, 자동 브라우저 E2E와 benchmark가 남아 있다.

## 완료 판정

| 영역                              | 판정        | 근거                                                                                                                                                            | 남은 작업                                                                                                        |
| --------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Project identity/policy           | 부분 완료   | `project_policies`, `policy_audit_events`, `GET /api/v1/projects`, `PATCH /api/v1/projects/:id/policy`, capture-disabled ingest 차단, browser path masking 구현 | analysis/import candidate에는 policy 적용이 아직 제한적이다.                                                     |
| Transcript import                 | 완료        | `prompt-memory import --dry-run`, `--save-job`, `--execute`, `--resume`, `import_records`, imported-only list filter 구현                                       | Web import UI/API는 없다. PRD2 core에서는 CLI 중심으로 허용 가능하지만 public beta 문서에 명시해야 한다.         |
| Prompt Improvement Workspace      | 완료        | local `improvePrompt`, `prompt-memory improve`, detail UI 개선안 preview/copy/save, `prompt_improvement_drafts` 구현                                            | 품질 평가는 rule-based라 실제 개선 품질 benchmark가 필요하다.                                                    |
| Import execution/resume hardening | 완료        | idempotency key, resume job, assistant/tool skip, malformed record tolerance, redaction 재적용 구현                                                             | 디렉터리/glob import는 의도적으로 제외. source allowlist와 file/line limit은 유지 검증 필요.                     |
| Anonymized export preset          | 부분 완료   | UI/CLI export preview, `export_jobs`, job id execution, path/secret anonymization, small-set warning 구현                                                       | preview 이후 policy/redaction/preset 변경 invalidation은 완전하지 않다. 삭제 invalidation과 count 일치는 구현됨. |
| External/tool-assisted analysis   | 의도적 제외 | route/table/network client가 core에 없음                                                                                                                        | gated beta로만 재검토.                                                                                           |

## PRD2 Core별 상세

### 1. Project Control Plane

구현된 것:

- `project_policies`, `policy_audit_events` migration과 storage port가 있다.
- project list는 raw path 대신 `project_id`, label, counts, policy만 반환한다.
- policy update는 app access와 CSRF를 요구한다.
- audit event는 raw prompt/path/secret 없이 변경 field와 policy hash를 기록한다.
- ingest에서 `capture_disabled`가 켜진 프로젝트는 저장하지 않는다.
- policy lookup 실패 시 prompt persistence를 호출하지 않고 fail-open 응답을 반환한다.

근거:

- `src/server/routes/projects.ts`
- `src/server/create-server.test.ts`
- `src/storage/sqlite-storage.test.ts`
- `src/server/routes/ingest.ts`

현재 하드닝:

- browser prompt list/detail/dashboard API 응답의 `cwd`, prompt snippet, detail markdown, dashboard project key는 raw absolute path 대신 project label 또는 `[REDACTED:path]`를 반환한다.
- 대시보드에서 project label을 눌러도 목록 필터가 동작하도록 `cwd_prefix`에는 basename fallback을 허용한다.

갭:

- `analysis_disabled`, `retention_candidate_days`, `external_analysis_opt_in` 필드는 저장/표시되지만 실제 analysis/retention/external execution에는 아직 연결되지 않았다.
- Settings API의 `data_dir`와 `excluded_project_roots`는 운영 진단 용도라 raw local path를 포함한다. public beta 문서에서 이 경계를 명시하거나 settings도 masked display로 바꿀지 결정해야 한다.

판정:

- 운영 제어의 최소 구현은 완료.
- public beta 전에는 settings 진단 path 표시 경계만 별도 판단하면 된다.

### 2. Transcript Import

구현된 것:

- 단일 JSONL 파일 dry-run을 제공한다.
- dry-run은 Markdown/SQLite prompt index/FTS를 변경하지 않고 raw-free job summary를 저장할 수 있다.
- assistant/tool role, 빈 prompt, unsupported record, malformed JSONL, too-large line을 저장 대상에서 제외한다.
- 실행 import는 redaction 이후 저장하고 `import_records`로 idempotency/resume을 처리한다.
- imported-only filter가 CLI list/API list에서 동작한다.
- release smoke가 import 실행과 imported-only 결과를 검증한다.

근거:

- `src/importer/dry-run.ts`
- `src/importer/execute.ts`
- `src/cli/commands/import.ts`
- `src/cli/commands/import.test.ts`
- `scripts/release-smoke.mjs`

갭:

- Web import UI/API는 없다.
- import 결과만 dashboard로 drilldown하는 UX는 list 중심으로 제공되고, 별도 dashboard imported-only view는 강하지 않다.
- project policy의 import candidate filtering은 현재 핵심 경로로 완전히 연결됐다고 보기 어렵다.

판정:

- CLI/API 중심 MVP로는 완료.
- public beta 문서에는 "export UI는 있음, import는 CLI 중심"이라고 명확히 적어야 한다.

### 3. Prompt Improvement Workspace

구현된 것:

- `local-rules-v1` 기반으로 goal/context/scope/verification/output format을 보강하는 개선안을 만든다.
- CLI `prompt-memory improve --text|--stdin --json`가 있다.
- detail UI에서 원문/분석 preview/개선안을 구분해서 보여준다.
- 개선안 복사와 저장이 가능하다.
- 저장 draft는 redaction pipeline을 다시 통과한다.
- prompt hard delete 시 관련 draft도 삭제된다.

근거:

- `src/analysis/improve.ts`
- `src/analysis/improve.test.ts`
- `src/cli/commands/improve.ts`
- `src/server/routes/prompts.ts`
- `src/storage/sqlite-storage.test.ts`
- `src/web/src/App.tsx`

갭:

- 개선 품질이 실제 Claude Code/Codex 사용자에게 유용한지 정량 benchmark가 없다.
- `AGENTS.md`/`CLAUDE.md` 후보는 dashboard suggestion으로는 제공되지만, improvement draft에서 직접 변환하는 별도 workflow는 약하다.

판정:

- PRD2 MVP로는 완료.
- 다음 단계는 기능 추가보다 benchmark와 E2E로 품질을 측정해야 한다.

### 4. Anonymized Export

구현된 것:

- browser UI에는 anonymized export만 노출된다.
- CLI도 preview/job 중심의 anonymized export를 제공한다.
- export preview는 included/excluded field, prompt count, sensitive count, residual identifier count, small-set warning을 제공한다.
- `export_jobs`에는 raw prompt id/path/secret 없이 snapshot이 저장된다.
- 실행 API는 `job_id`만 받는다.
- export payload는 anonymous id, tool, coarse date, project alias, masked prompt, tags, quality gaps를 포함한다.
- prompt 삭제 후 preview job 실행은 invalid 처리된다.

근거:

- `src/exporter/anonymized.ts`
- `src/exporter/anonymized.test.ts`
- `src/cli/commands/export.ts`
- `src/server/routes/exports.ts`
- `src/web/src/App.tsx`
- `scripts/release-smoke.mjs`

갭:

- PRD2는 prompt, deletion state, policy, redaction version, preset 변경 시 기존 job invalidation을 요구한다. 현재는 삭제/대상 count mismatch 중심이고, policy/redaction/preset 변경 검증은 약하다.
- raw export advanced CLI는 구현하지 않았다. 현재 공개 surface에서 raw export가 없는 것은 안전하지만, PRD의 hidden raw export 요구와는 다르다.

판정:

- public-safe anonymized export MVP는 완료.
- release hardening에서는 invalidation 조건을 더 강하게 만들거나 PRD를 "raw export 미지원"으로 조정해야 한다.

## 공통 보안/API 기준

충족:

- state-changing browser API는 app access와 CSRF를 요구한다.
- ingest route는 bearer auth를 요구한다.
- hook wrapper는 fail-open이고 stdout/stderr에 prompt body를 쓰지 않는다.
- raw detected secret은 mask mode에서 Markdown/SQLite/FTS/export job/export payload에 남지 않도록 테스트가 있다.
- external network analysis route/client는 core에 없다.

부분 충족:

- browser project API와 prompt list/detail/dashboard API는 raw absolute path를 기본 반환하지 않는다.
- Settings API의 `data_dir`와 `excluded_project_roots`는 아직 raw local path를 반환한다.

## Public Beta 전 필수 하드닝

1. Playwright 자동 E2E
   - archive -> detail -> coach copy/save -> dashboard -> projects toggle -> export preview/execute -> mobile overflow를 자동화한다.

2. Benchmark v1
   - privacy leak rate, retrieval top-k, coach gap fix rate, analytics detection, ingest/search/export p95를 JSON report로 측정한다.

3. Export invalidation hardening
   - preview 이후 project policy version, redaction version, preset, selected prompt hash/count 변경을 모두 invalid 처리한다.

4. Release checklist 업데이트
   - PRD2에서 추가된 project/import/coach/export/browser E2E/benchmark 항목을 `docs/RELEASE_CHECKLIST.md`에 반영한다.

## 최종 판단

PRD2 기능 개발은 "완료"로 보고 다음 단계로 넘어가도 된다. 다만 공개 오픈 기준은 "기능이 존재한다"가 아니라 "local-first privacy와 실제 유용성을 반복 검증할 수 있다"여야 한다.

따라서 다음 작업 순서는 다음이 최적이다.

1. Playwright 자동 E2E
2. benchmark v1
3. export invalidation hardening
4. release checklist/README beta 정리
5. Node 22/24 최종 smoke
