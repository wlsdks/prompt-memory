# prompt-memory Phase 2 PRD

작성일: 2026-05-02  
상태: Draft For Development  
관련 문서: [PRD.md](./PRD.md), [EFFICIENCY_REVIEW.md](./EFFICIENCY_REVIEW.md), [TECH_SPEC.md](./TECH_SPEC.md)

## 1. 목적

Phase 2의 목적은 `prompt-memory`를 "안전하게 저장하고 찾는 도구"에서 "프로젝트별로 운영하고, 과거 기록을 가져오고, 좋은 prompt를 개선해 다시 쓰는 도구"로 확장하는 것이다.

이 문서는 비즈니스 KPI가 아니라 개발용 요구사항이다. 완료 판단은 기능 동작, 보안 경계, 복구 가능성, 테스트와 브라우저 검증으로 한다.

## 2. 현재 기준선

다음 기능은 Phase 2 계획의 출발점으로 이미 구현된 것으로 본다.

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

## 4. 포함 범위

### 4.1 Project Control Plane

사용자는 프로젝트별로 수집, 분석, 보존, 외부 전송 가능 여부를 확인하고 조정할 수 있어야 한다.

요구사항:

- Settings 또는 별도 Project 화면에서 project profile 목록을 보여준다.
- 프로젝트별 상태를 표시한다: prompt count, latest ingest, sensitive count, quality gap rate, copied/bookmarked count.
- 프로젝트별 수집 제외를 UI에서 추가/해제할 수 있다.
- 프로젝트별 분석 제외를 UI에서 설정할 수 있다.
- 프로젝트별 retention 후보를 설정할 수 있다. 실제 자동 삭제 실행은 별도 확인을 요구한다.
- 외부 분석 opt-in은 전역 opt-in과 프로젝트 opt-in이 모두 켜진 경우에만 가능하다.
- 모든 policy 변경은 raw prompt 없이 audit event로 저장한다.

수용 기준:

- project policy 변경 API는 app access와 CSRF를 요구한다.
- 브라우저 settings 응답에는 token, raw prompt, raw secret이 포함되지 않는다.
- 수집 제외 프로젝트의 hook ingest는 저장소를 호출하지 않는다.
- analysis/export/import 후보 산정이 project policy를 반영한다.

### 4.2 Transcript Import Dry Run

사용자는 Claude Code/Codex transcript 또는 선택한 JSONL 파일에서 과거 사용자 prompt를 preview한 뒤 가져올 수 있어야 한다.

요구사항:

- import는 기본 비활성화이며 사용자가 파일, 기간, 프로젝트를 명시해야 한다.
- `prompt-memory import --dry-run`을 먼저 제공한다.
- dry-run은 예상 수집 건수, skipped count, parse errors, sensitive summary, source type을 표시한다.
- assistant response, tool output, command output, 파일 내용은 기본 저장 대상에서 제외한다.
- import source는 `official-hook`, `claude-transcript-best-effort`, `codex-transcript-best-effort`, `manual-jsonl`처럼 구분한다.
- 한 record 실패가 전체 import를 중단하지 않는다.
- 재실행 시 idempotency key로 중복 저장을 막는다.
- import 결과는 job 단위로 저장하고 resume 가능해야 한다.

수용 기준:

- dry-run은 Markdown/SQLite를 변경하지 않는다.
- import 실행은 redaction 이후 저장하고 raw secret을 Markdown/SQLite/FTS/analysis에 남기지 않는다.
- malformed JSONL record는 import error로 남고 기존 데이터는 유지된다.
- import된 prompt는 list/search/detail/dashboard에 기존 hook prompt와 동일하게 표시된다.

### 4.3 Prompt Improvement Workspace

사용자는 품질 gap이 있는 prompt를 열고, 개선 초안을 만들고, 좋은 버전을 저장 또는 복사할 수 있어야 한다.

요구사항:

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
- 사용자가 복사하거나 저장한 draft는 usefulness dashboard에 반영된다.
- delete prompt 시 관련 draft와 usage metadata도 정리된다.

### 4.4 Anonymized Export

사용자는 저장된 prompt와 분석 결과를 익명화된 형태로 내보낼 수 있어야 한다.

요구사항:

- export는 기본적으로 anonymized export만 UI에 노출한다.
- raw export는 CLI 전용 또는 강한 경고와 추가 확인 뒤에만 허용한다.
- export preview는 포함될 field, 제외될 field, prompt count, sensitive count를 보여준다.
- 기본 export는 masked prompt, tags, checklist summary, tool, coarse date, project alias만 포함한다.
- `cwd`, `project_root`, `transcript_path`, raw metadata는 기본 제외한다.
- export file에는 app token, ingest token, web session secret, upstream session token이 포함되지 않는다.

수용 기준:

- anonymized export fixture에서 raw path, raw secret, token 값이 검출되지 않는다.
- export preview와 실제 export count가 일치한다.
- delete된 prompt는 export 대상에 포함되지 않는다.

### 4.5 External LLM Analysis Opt-in

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

수용 기준:

- opt-in이 꺼진 상태에서는 외부 network call code path가 실행되지 않는다.
- preview payload는 raw secret과 금지된 path field를 포함하지 않는다.
- 외부 분석 결과 저장 전 redaction 회귀 테스트가 있다.
- provider API key는 Markdown, SQLite, logs, export에 포함되지 않는다.

## 5. 제외 범위

Phase 2에서 제외한다.

- 팀 계정과 권한 관리
- 클라우드 동기화
- 브라우저 확장
- 모든 AI 도구 adapter 지원
- 외부 LLM 분석 자동 실행 기본값
- upstream AI 도구의 OAuth/session token 사용
- assistant response와 tool output의 기본 저장
- semantic clustering을 위한 외부 embedding 기본 사용

## 6. 데이터 모델 후보

Phase 2에서 추가 또는 상세화할 테이블:

- `project_policies`
- `policy_audit_events`
- `import_jobs`
- `import_errors`
- `import_records`
- `prompt_improvement_drafts`
- `export_jobs`
- `external_analysis_jobs`
- `external_analysis_audit_events`

모든 새 테이블은 prompt hard delete와 source-of-truth rebuild 정책을 정의해야 한다.

## 7. API/CLI 후보

CLI:

- `prompt-memory projects list`
- `prompt-memory projects set-policy <project>`
- `prompt-memory import --dry-run`
- `prompt-memory import --resume <job-id>`
- `prompt-memory export --anonymized`
- `prompt-memory analyze external --preview <prompt-id>`

API:

- `GET /api/v1/projects`
- `PATCH /api/v1/projects/:id/policy`
- `POST /api/v1/imports/dry-run`
- `POST /api/v1/imports`
- `GET /api/v1/imports/:id`
- `POST /api/v1/prompts/:id/improvements`
- `POST /api/v1/exports/preview`
- `POST /api/v1/exports`
- `POST /api/v1/prompts/:id/external-analysis/preview`

## 8. 개발 순서

1. Project Control Plane
2. Import job schema와 dry-run CLI
3. Import execution과 resume
4. Prompt Improvement Workspace local draft
5. Anonymized export preview/export
6. External LLM analysis opt-in preview
7. External LLM analysis execution

## 9. 검증 게이트

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

## 10. 첫 구현 후보

첫 구현 단위는 Project Control Plane이 가장 적절하다.

이유:

- 외부 분석, import, export가 모두 project policy를 필요로 한다.
- 현재 settings 화면은 read 중심이라 실제 운영 제어가 약하다.
- 저장 구조와 API 확장 범위가 import보다 작아 회귀 위험이 낮다.
- 이후 고위험 기능의 안전장치로 재사용할 수 있다.

첫 커밋 범위:

- `project_policies` migration
- storage/API 테스트
- `GET /api/v1/projects`, `PATCH /api/v1/projects/:id/policy`
- settings 또는 project panel UI
- capture exclusion과 analysis exclusion이 policy를 반영하는 최소 경로
