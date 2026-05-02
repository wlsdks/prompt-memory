# prompt-memory Phase 2 PRD

작성일: 2026-05-02  
상태: Draft For Development  
관련 문서: [PRD.md](./PRD.md), [EFFICIENCY_REVIEW.md](./EFFICIENCY_REVIEW.md), [TECH_SPEC.md](./TECH_SPEC.md)

## 1. 목적

Phase 2의 목적은 `prompt-memory`를 "안전하게 저장하고 찾는 도구"에서 "프로젝트별로 운영하고, 과거 기록을 가져오고, 좋은 prompt를 개선해 다시 쓰는 도구"로 확장하는 것이다.

이 문서는 비즈니스 KPI가 아니라 개발용 요구사항이다. 완료 판단은 기능 동작, 보안 경계, 복구 가능성, 테스트와 브라우저 검증으로 한다.

## 2. 현재 기준선

다음 기능은 Phase 2 계획의 출발점으로 현재 브랜치에 이미 구현된 것으로 본다. `PRD.md`는 초기 MVP 경계를 설명하는 기준 문서이므로, 이 목록이 `PRD.md`의 MVP 제외 범위보다 넓을 수 있다. Phase 2 구현 판단은 이 현재 기준선을 우선한다.

- Claude Code/Codex hook 수집, fail-open wrapper, hook install/uninstall/doctor
- guided `setup`, macOS service, Claude statusline
- Markdown 저장, SQLite/FTS index, hard delete, `rebuild-index`
- CLI list/search/show/delete/open
- 웹 UI list/detail/dashboard/settings
- local session cookie와 CSRF 보호
- `local-rules-v1` 분석 preview
- checklist, 자동 태그, quality gap, instruction suggestion
- 품질 대시보드, trend, project profile, metric/distribution/gap/day drilldown
- prompt copy event, bookmark, reused/saved/duplicated/quality-gap focus
- exact duplicate detection
- active filter bar, snippet, detail queue navigation
- release smoke와 package dry-run 검증

## 3. Phase 2 제품 원칙

- 로컬 우선 원칙을 유지한다. 외부 전송은 기본 비활성화다.
- Project policy가 import, capture, analysis, export에 공통 적용되어야 한다.
- 고위험 작업은 먼저 preview/dry-run을 제공한다.
- import와 export는 기존 Markdown/SQLite 데이터를 손상시키지 않아야 한다.
- 분석 결과와 개선 prompt도 redaction pipeline을 다시 통과해야 한다.
- 자동으로 `AGENTS.md`, `CLAUDE.md`, project settings를 수정하지 않는다. 사용자가 복사하거나 승인한 경우에만 쓴다.

## 4. Phase 2 Core와 Gated Beta

Phase 2 완료 조건은 다음 core 기능으로 제한한다.

- Project identity와 project policy
- Transcript import dry-run과 imported-only queue
- Prompt improvement workspace MVP
- Import execution/resume hardening
- Anonymized export preset

External LLM Analysis는 Phase 2 core 완료 조건이 아니다. Project Control Plane, import, local improvement workspace, anonymized export가 안정화된 뒤 gated beta로만 제공한다. Phase 2 core 구현 중에는 external analysis route stub이나 network code path를 만들지 않는다. 단, project policy와 audit schema에는 향후 external analysis opt-in을 수용할 필드를 미리 정의할 수 있다.

이 문서의 External LLM Analysis 요구사항은 gated beta appendix로 취급한다. Phase 2 core migration, API, UI, smoke gate에는 external analysis 실행 테이블, route, provider 설정, network client를 포함하지 않는다.

## 5. 공통 보안 및 API 요구사항

- 모든 Phase 2 read API는 app access를 요구한다.
- 모든 import/export/external-analysis/project-policy mutation과 preview job 생성 API는 app access와 CSRF를 요구한다.
- ingest token은 Phase 2 관리 API에서 절대 허용하지 않는다.
- problem detail, audit event, browser response에는 raw prompt, raw secret, provider API key, token, import payload 원문을 포함하지 않는다.
- browser API는 raw path를 기본 반환하지 않는다. raw path가 필요한 경우 CLI 또는 explicit debug/detail action으로 분리한다. 브라우저 preview에는 source label, basename, home-relative masked path, path hash만 노출한다.
- provider response, rewrite draft, instruction candidate, imported transcript text는 모두 untrusted user content로 취급한다.
- UI 렌더링은 기존 Markdown sanitizer와 CSP 경계를 재사용하고 raw HTML, external image, `file:`, `data:`, custom scheme, `javascript:` URL을 차단한다.
- `AGENTS.md`와 `CLAUDE.md` 후보는 copy-only를 기본으로 하며, 파일 쓰기는 별도 명시 확인이 있을 때만 허용한다.

## 6. 포함 범위

### 6.1 Project Control Plane

사용자는 프로젝트별로 수집, 분석, 보존, 외부 전송 가능 여부를 확인하고 조정할 수 있어야 한다.

Project identity:

- Project identity는 우선 normalized `project_root`를 기준으로 한다.
- `project_root`가 없으면 normalized `cwd` bucket을 read-only inferred project로 표시한다.
- `project_key`는 normalized project root 또는 cwd bucket에 설치별 salt를 더해 만든 stable hash다. browser API는 기본적으로 `project_key`와 alias/label만 노출하고 raw path는 노출하지 않는다.
- normalized path는 symlink resolution, case normalization이 가능한 플랫폼에서는 동일 규칙을 적용한다. resolution 실패 시 inferred read-only project로 분류하고 policy mutation을 거부한다.
- 사용자가 alias를 지정해도 기존 Markdown frontmatter와 원본 path 값은 변경하지 않는다.
- alias는 같은 install 안에서 unique해야 한다. 충돌 시 기존 alias를 유지하고 validation error를 raw path 없이 반환한다.
- Projects API는 기본적으로 `project_id`, `label`, `alias`, `path_kind`, count/rate만 반환한다.
- raw `cwd`, `project_root`, `transcript_path`는 browser project list에 기본 노출하지 않는다.
- Settings API는 global defaults와 secret-free diagnostics만 담당한다. Project policy 변경은 Projects API로 분리한다.

요구사항:

- Settings 또는 별도 Project 화면에서 project profile 목록을 보여준다.
- 프로젝트별 상태를 표시한다: prompt count, latest ingest, sensitive count, quality gap rate, copied/bookmarked count.
- 프로젝트별 수집 제외를 UI에서 추가/해제할 수 있다.
- 프로젝트별 분석 제외를 UI에서 설정할 수 있다.
- 프로젝트별 retention 후보를 설정할 수 있다. 실제 자동 삭제 실행은 별도 확인을 요구한다.
- 외부 분석 opt-in은 전역 opt-in과 프로젝트 opt-in이 모두 켜진 경우에만 가능하다.
- 모든 policy 변경은 raw prompt 없이 audit event로 저장한다.
- policy에는 version을 둔다. preview/import/export/external-analysis job은 생성 시점의 policy version을 기록한다.
- policy lookup은 별도 read port로 허용한다. capture-disabled 프로젝트는 policy lookup 이후 prompt persistence storage를 호출하지 않아야 한다.
- policy lookup 실패 시 hook ingest는 fail-open 원칙에 따라 AI 도구 실행은 막지 않되, prompt persistence storage를 호출하지 않고 raw prompt 없는 diagnostic/audit code만 남긴다.

수용 기준:

- project policy 변경 API는 app access와 CSRF를 요구한다.
- 브라우저 settings 응답에는 token, raw prompt, raw secret이 포함되지 않는다.
- Projects API 응답에는 token, raw prompt, raw secret, raw transcript path가 포함되지 않는다.
- 수집 제외 프로젝트의 hook ingest는 prompt persistence storage를 호출하지 않는다.
- analysis/export/import 후보 산정이 project policy를 반영한다.
- `rebuild-index` 후 project profile index는 Markdown frontmatter에서 복구되지만, 사용자 설정인 `project_policies`와 `policy_audit_events`는 보존된다.

### 6.2 Transcript Import Dry Run

사용자는 Claude Code/Codex transcript 또는 선택한 JSONL 파일에서 과거 사용자 prompt를 preview한 뒤 가져올 수 있어야 한다.

요구사항:

- import는 기본 비활성화이며 사용자가 파일, 기간, 프로젝트를 명시해야 한다.
- `prompt-memory import --dry-run`을 먼저 제공한다.
- dry-run은 예상 수집 건수, skipped count, parse errors, sensitive summary, source type, 가져온 뒤 생길 dashboard 변화 preview를 표시한다.
- dry-run은 prompt Markdown, prompt index, FTS를 변경하지 않는다. 단, resume과 감사 목적의 raw-free `import_jobs` summary는 저장할 수 있다.
- assistant response, tool output, command output, 파일 내용은 기본 저장 대상에서 제외한다.
- import source는 `official-hook`, `claude-transcript-best-effort`, `codex-transcript-best-effort`, `manual-jsonl`처럼 구분한다.
- 한 record 실패가 전체 import를 중단하지 않는다.
- 재실행 시 idempotency key로 중복 저장을 막는다.
- import 결과는 job 단위로 저장하고 resume 가능해야 한다.
- import 입력 파일은 canonical path로 검증하고 symlink traversal을 거부하거나 resolved path를 preview에 표시해야 한다.
- 기본 허용 위치는 사용자 홈 하위의 Claude/Codex transcript 디렉터리와 사용자가 명시 선택한 단일 파일로 제한한다.
- 디렉터리 전체 재귀 import와 glob import는 별도 preview와 확인 없이는 금지한다.
- file size, line size, total records, parse timeout 제한을 둔다.
- parser는 source별 allowlist parser만 사용한다.
- 알 수 없는 event type, assistant/tool role, command output, file content, diff blob, attachment/content array는 저장하지 않고 `import_errors`에 raw content 없이 code/count만 기록한다.
- import job 상태는 `pending`, `dry_run_completed`, `running`, `completed`, `failed`, `canceled` 중 하나로 기록한다.
- import idempotency key는 source별 stable event id가 있으면 이를 우선 사용한다. 없으면 `source_type + source_path_hash + parser_version + record_offset/session_id/turn_id + stored_prompt_hash` 기반으로 정의한다.
- import 완료 후 사용자는 job detail에서 imported/skipped/error/sensitive summary를 확인하고, "이번 import 결과만 보기"로 list와 dashboard를 필터링할 수 있어야 한다.
- imported prompt는 source badge와 best-effort 신뢰도 표시를 가져야 한다.

수용 기준:

- dry-run은 prompt Markdown, prompt index, FTS를 변경하지 않는다. raw-free job summary 저장은 허용한다.
- import 실행은 redaction 이후 저장하고 raw secret을 Markdown/SQLite/FTS/analysis에 남기지 않는다.
- malformed JSONL record는 import error로 남고 기존 데이터는 유지된다.
- import된 prompt는 list/search/detail/dashboard에 기존 hook prompt와 동일하게 표시된다.
- assistant response, tool output, command output, file content가 포함된 transcript fixture는 사용자 prompt 외 내용을 저장하지 않는 회귀 테스트를 가진다.
- import 완료 후 imported-only filter가 list와 dashboard drilldown에 적용된다.

### 6.3 Prompt Improvement Workspace

사용자는 품질 gap이 있는 prompt를 열고, 개선 초안을 만들고, 좋은 버전을 저장 또는 복사할 수 있어야 한다.

요구사항:

- 사용자는 Dashboard 또는 `focus=quality-gap` 큐에서 개선 대상 prompt를 열고, 원문/분석 gap/local rewrite draft를 나란히 비교한 뒤, 개선본을 복사하거나 저장하고 다음 큐 항목으로 이동할 수 있어야 한다.
- detail 화면에 "개선 작업대" 영역을 추가한다.
- local rules 기반 rewrite draft를 먼저 제공한다.
- rewrite draft는 사용자가 복사할 수 있지만 자동으로 원문 Markdown을 바꾸지 않는다.
- 개선 draft는 원문 prompt와 별도 local artifact로 저장할 수 있다.
- 저장된 개선 draft는 redaction pipeline을 통과한다.
- draft에는 source prompt id, analyzer version, created_at, accepted/copied 여부를 기록한다.
- 좋은 draft를 `AGENTS.md` 또는 `CLAUDE.md` 후보 문장으로 변환할 수 있다.

수용 기준:

- raw secret이 draft, suggestion, SQLite, API response에 남지 않는다.
- prompt detail에서 원문, 분석 checklist, 개선 draft, instruction candidate가 구분된다.
- 저장/복사된 개선본은 reused focus와 usefulness dashboard에 반영된다.
- delete prompt 시 관련 draft와 usage metadata도 정리된다.
- quality-gap 큐에서 prompt를 열고 draft를 저장/복사한 뒤 다음 항목으로 이동할 수 있다.

### 6.4 Anonymized Export

사용자는 저장된 prompt와 분석 결과를 익명화된 형태로 내보낼 수 있어야 한다.

요구사항:

- export는 기본적으로 anonymized export만 UI에 노출한다.
- raw export는 browser API/UI에서 제공하지 않는다.
- raw export는 hidden/advanced CLI에서만 제공하고 `--raw --i-understand-local-secrets-may-be-exported --output <path>` 같은 명시 플래그를 요구한다.
- export preview는 포함될 field, 제외될 field, prompt count, sensitive count를 보여준다.
- export preview는 `export_jobs`에 raw-free snapshot을 저장하고 `job_id`, 대상 prompt id hash 목록, policy version, redaction version, preset, count, expires_at을 기록한다.
- export 실행 API는 `job_id`만 받는다. preview 이후 prompt, deletion state, policy, redaction version, preset이 바뀌면 기존 job은 invalid 처리하고 다시 preview를 요구한다.
- 기본 export는 masked prompt, tags, checklist summary, tool, coarse date, project alias만 포함한다.
- `cwd`, `project_root`, `transcript_path`, raw metadata는 기본 제외한다.
- export file에는 app token, ingest token, web session secret, upstream session token이 포함되지 않는다.
- export preview에는 목적 preset을 둔다: `personal_backup`, `anonymized_review`, `issue_report_attachment`.
- 각 preset은 포함 field와 제외 field를 고정한다.
- anonymized export는 secret masking과 별개로 project alias, date bucketing, URL/domain/path/person/email/repo slug redaction, session/turn/id remapping을 적용한다.
- export preview는 residual identifiers sample을 raw 값 없이 category/count로 보여준다.
- 작은 집합 export는 재식별 위험 경고를 표시한다.
- 기본 export는 exact timestamp와 stable prompt id를 포함하지 않는다.

수용 기준:

- anonymized export fixture에서 raw path, raw secret, token 값이 검출되지 않는다.
- 유효한 export job에서는 preview와 실제 export count가 일치한다.
- delete된 prompt는 export 대상에 포함되지 않는다.
- raw export는 project/prompt policy, deleted prompts, excluded-from-export 플래그를 적용하고 raw content 없는 audit event를 남긴다.

### 6.5 External LLM Analysis Gated Beta Appendix

외부 LLM 분석은 project policy, prompt policy, redaction preview, 감사 로그가 준비된 뒤에만 구현한다.

요구사항:

- 기본값은 비활성화다.
- provider API key는 OS keychain 또는 owner-only 권한 파일에 저장한다.
- 전역 opt-in, 프로젝트 opt-in, prompt 단위 preview를 모두 통과해야 한다.
- 외부 전송 전 payload preview를 보여준다.
- 민감정보가 감지된 prompt는 기본 제외한다.
- override는 1회성으로만 허용하고 audit event를 남긴다.
- provider response도 저장 전 redaction pipeline을 통과한다.
- 외부 분석 실패는 기존 local analysis를 깨지 않는다.
- `external-analysis/preview`는 `external_analysis_jobs`에 `payload_snapshot`, `payload_hash`, `prompt_id`, `prompt_updated_at` 또는 prompt hash, `project_policy_version`, `prompt_policy_version`, `redaction_version`, `provider`, `model`, `allowed_fields`, `expires_at`을 저장한다.
- 실행 API는 `job_id`만 받고 preview snapshot과 byte-for-byte 동일한 payload를 전송한다.
- prompt, policy, redaction version, provider, model이 preview 이후 변경되면 job은 invalid 처리한다.
- provider response는 untrusted content로 취급하며 Markdown sanitizer와 CSP 경계를 통과해야 UI에 표시할 수 있다.

수용 기준:

- opt-in이 꺼진 상태에서는 외부 network call code path가 실행되지 않는다.
- preview payload는 raw secret과 금지된 path field를 포함하지 않는다.
- 외부 분석 결과 저장 전 redaction 회귀 테스트가 있다.
- provider API key는 Markdown, SQLite, logs, export에 포함되지 않는다.
- preview payload와 실제 전송 payload의 hash가 일치하지 않으면 전송하지 않는다.

## 7. 제외 범위

Phase 2 core에서 제외한다.

- 팀 계정과 권한 관리
- 클라우드 동기화
- 브라우저 확장
- 모든 AI 도구 adapter 지원
- 외부 LLM 분석 자동 실행 기본값
- upstream AI 도구의 OAuth/session token 사용
- assistant response와 tool output의 기본 저장
- semantic clustering을 위한 외부 embedding 기본 사용
- external LLM analysis의 core release 포함

## 8. 데이터 모델 후보

Phase 2 core에서 추가 또는 상세화할 테이블:

- `project_policies`
- `policy_audit_events`
- `import_jobs`
- `import_errors`
- `import_records`
- `prompt_improvement_drafts`
- `export_jobs`

Gated beta에서만 추가할 테이블:

- `external_analysis_jobs`
- `external_analysis_audit_events`

모든 새 테이블은 prompt hard delete와 source-of-truth rebuild 정책을 정의해야 한다.

`project_policies` 최소 필드:

- `project_key`
- `display_alias`
- `capture_disabled`
- `analysis_disabled`
- `retention_candidate_days`
- `external_analysis_opt_in`
- `export_disabled`
- `version`
- `updated_at`

`policy_audit_events` 최소 필드:

- `id`
- `project_key`
- `changed_fields`
- `previous_policy_hash`
- `next_policy_hash`
- `created_at`
- `actor`: `cli`, `web`, `system`

`import_jobs` 최소 필드:

- `id`
- `source_type`
- `source_path_hash`
- `status`
- `dry_run`
- `started_at`
- `completed_at`
- `project_policy_version`
- `summary_json`

`export_jobs` 최소 필드:

- `id`
- `preset`
- `status`
- `prompt_id_hashes_json`
- `project_policy_versions_json`
- `redaction_version`
- `counts_json`
- `expires_at`
- `created_at`

`import_records` 최소 필드:

- `job_id`
- `record_key`
- `record_offset`
- `status`
- `prompt_id`
- `error_code`

## 9. Phase 2 Artifact Lifecycle

| Artifact | Prompt hard delete | `rebuild-index` 관계 | Raw content 저장 |
| --- | --- | --- | --- |
| `project_policies` | 유지 | Markdown에서 재생성 불가. 보존한다. | 없음 |
| `policy_audit_events` | 유지하되 raw 없는 tombstone만 허용 | 재생성 불가. 보존한다. | 없음 |
| `import_jobs` | 유지 가능. 삭제 prompt count만 업데이트 | 재생성 불가. 보존한다. | 없음 |
| `import_records` | prompt hard delete 시 `prompt_id`를 null 처리하거나 row 삭제. 정책을 migration에서 고정한다. | 재생성 불가. 보존한다. | 없음 |
| `prompt_improvement_drafts` | 삭제 | 재생성 불가. 삭제된 prompt의 draft는 유지하지 않는다. | redacted draft만 |
| `export_jobs` | 유지 가능하나 export file content/path는 저장하지 않는다. | 재생성 불가. 보존한다. | 없음 |
| `external_analysis_jobs` | `payload_snapshot`과 provider response를 삭제한다. raw 없는 audit tombstone만 허용한다. | 재생성 불가. 보존한다. | redacted snapshot만 gated beta에서 허용 |

## 10. API/CLI 후보

CLI:

- `prompt-memory projects list`
- `prompt-memory projects set-policy <project>`
- `prompt-memory import --dry-run`
- `prompt-memory import --resume <job-id>`
- `prompt-memory export --anonymized`

API:

- `GET /api/v1/projects`
- `PATCH /api/v1/projects/:id/policy`
- `POST /api/v1/imports/dry-run`
- `POST /api/v1/imports`
- `GET /api/v1/imports/:id`
- `POST /api/v1/prompts/:id/improvements`
- `POST /api/v1/exports/preview`
- `POST /api/v1/exports`

Gated beta API 후보:

- `POST /api/v1/prompts/:id/external-analysis/preview`
- `POST /api/v1/external-analysis-jobs/:id/run`

## 11. 개발 순서

1. Project Control Plane
2. Import dry-run과 imported-only preview/filter
3. Prompt Improvement Workspace MVP
4. Import execution/resume hardening
5. Anonymized export preset
6. External LLM analysis gated beta preview
7. External LLM analysis gated beta execution

1-5번이 Phase 2 core 완료 범위다. 6-7번은 별도 gated beta 착수 조건을 통과한 뒤 진행한다.

## 12. 검증 게이트

기능 변경 후 기본 게이트:

```sh
pnpm test
pnpm lint
pnpm build
pnpm pack:dry-run
git diff --check
```

서버 또는 UI 변경 후 추가 게이트:

```sh
pnpm smoke:release
pnpm prompt-memory server -- --data-dir <temp-data-dir>
```

그 다음 실제 브라우저에서 desktop/mobile 렌더링, console/network 오류, 주요 흐름을 확인한다.

## 13. Phase 2 UX Acceptance

- 새 사용자는 transcript import dry-run 후 가져올 가치와 위험을 한 화면에서 판단할 수 있다.
- import 완료 후 이번 import 결과만 필터링하고 quality-gap/reused/duplicated 큐로 바로 이동할 수 있다.
- 사용자는 quality-gap 큐에서 prompt를 열고 개선 draft를 저장/복사한 뒤 다음 항목으로 이동할 수 있다.
- Project policy 변경 후 capture/analysis/import/export 후보가 어떻게 달라졌는지 preview로 확인할 수 있다.
- 프로젝트별 수집 제외를 켠 뒤 같은 프로젝트 prompt가 새로 저장되지 않는 것을 doctor 또는 UI 상태로 확인할 수 있다.

## 14. 첫 구현 후보

첫 구현 단위는 Project Control Plane 최소판이 가장 적절하다.

이유:

- 외부 분석, import, export가 모두 project policy를 필요로 한다.
- 현재 settings 화면은 read 중심이라 실제 운영 제어가 약하다.
- 저장 구조와 API 확장 범위가 import보다 작아 회귀 위험이 낮다.
- 이후 고위험 기능의 안전장치로 재사용할 수 있다.

첫 커밋 범위:

- `project_policies` migration
- `policy_audit_events` migration
- `ProjectPolicyStoragePort`: list/get/update/audit
- storage/API 테스트
- `GET /api/v1/projects`, `PATCH /api/v1/projects/:id/policy`
- ingest에서 capture-disabled만 반영
- UI는 read-only project list와 capture-disabled toggle 하나만 제공

첫 커밋에서 제외:

- analysis exclusion 적용
- retention 실행
- external opt-in 실행
- import/export candidate filtering
- external-analysis route stub 또는 network code path
- external analysis migration/table

필수 테스트:

- `GET /api/v1/projects`가 token, raw prompt, raw secret, raw transcript path를 반환하지 않는다.
- `PATCH /api/v1/projects/:id/policy`는 app access와 CSRF를 요구한다.
- capture-disabled project ingest는 prompt persistence storage를 호출하지 않는다.
- policy audit event는 raw prompt/path/secret 없이 변경 field와 policy hash만 기록한다.
- `rebuild-index` 후 project profile은 복구되지만 project policies/audit은 보존된다.
- policy lookup 실패 시 hook ingest는 fail-open 하되 prompt persistence storage를 호출하지 않는다.
