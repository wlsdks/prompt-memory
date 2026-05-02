# prompt-memory Efficiency Review

작성일: 2026-05-02  
상태: Phase 2 Planning Input  
대상: 1차 개발 완료 이후 제품/개발 효율성 평가

## 1. 결론

현재 `prompt-memory`는 1차 MVP를 넘어서 이미 상당한 Phase 2 기능을 포함한다. 자동 수집, 로컬 저장, 검색, 삭제, hook 설치/진단, 웹 UI뿐 아니라 규칙 기반 분석, 자동 태그, 품질 대시보드, drilldown, 재사용 신호, 중복 후보, 프로젝트 품질 프로필까지 구현되어 있다.

따라서 다음 개발은 "분석 기능을 더 많이 붙이기"보다 다음 네 가지 효율 병목을 줄이는 방향이 맞다.

1. 과거 기록을 가져오지 못해 새로 쌓이는 prompt에만 가치가 제한된다.
2. 프로젝트별 수집/분석 정책을 UI에서 조정하지 못해 운영 비용이 남아 있다.
3. 좋은 prompt를 실제 다음 prompt로 바꾸는 개선 작업대가 아직 약하다.
4. 외부 LLM 분석, export, import 같은 고위험 기능의 동의/감사/복구 경계가 아직 구현 전이다.

## 2. 현재 효율성 평가

| 영역 | 현재 상태 | 효율성 판단 | 근거 |
| --- | --- | --- | --- |
| 설치/수집 | `setup`, service, Claude Code/Codex hook, doctor, statusline이 있음 | 높음 | 사용자가 여러 수동 단계를 외울 필요가 줄었다. 서버 미실행 시 fail-open도 유지된다. |
| 저장/복구 | Markdown source of truth, SQLite/FTS, `rebuild-index`, delete 정합성이 있음 | 높음 | 로컬 우선 MVP의 핵심 운영 리스크를 줄였다. |
| 검색/탐색 | list/search/detail, URL 필터, active filter, pagination, snippet, queue navigation이 있음 | 높음 | 저장된 prompt를 찾고 연속 검토하는 비용이 낮아졌다. |
| 분석 | `local-rules-v1`, checklist, tag, dashboard, trend, project profile이 있음 | 중상 | 원문 외부 전송 없이 품질 신호를 제공한다. 다만 deterministic rule 한계 때문에 개선안의 깊이는 제한된다. |
| 재사용 | copy event, bookmark, reused focus, useful prompts가 있음 | 중상 | 좋은 prompt를 다시 찾는 루프는 시작됐다. 하지만 prompt rewrite/version/compare는 없다. |
| 중복 관리 | redacted content hash 기반 exact duplicate group이 있음 | 중간 | 안전하고 저비용이다. semantic duplicate나 "더 나은 버전 남기기" 흐름은 없다. |
| 프로젝트 제어 | settings 화면에서 상태와 excluded roots를 볼 수 있음 | 중간 이하 | 읽기 중심이다. 프로젝트별 수집 제외, 분석 제외, retention, 외부 분석 허용을 UI에서 다루지 못한다. |
| 과거 데이터 활용 | transcript import가 PRD에만 있음 | 낮음 | 제품을 설치하기 전의 고가치 prompt 기록을 가져오지 못한다. |
| 외부 분석 | 명시적으로 미구현 | 보류 | 현재 privacy 기본값은 좋다. 단, Phase 2에서 opt-in 경계 없이 바로 붙이면 위험하다. |
| 배포 검증 | `pnpm smoke:release`, pack dry-run, release checklist가 있음 | 높음 | 로컬 beta 검증 루프가 명확하다. |

## 3. 사용자 작업 효율

현재 강점은 "쌓인 prompt를 찾고 상태를 이해하는 속도"다.

- Archive/list가 첫 화면이라 사용자가 목적지 없이 landing을 통과하지 않는다.
- 검색, tool/tag/sensitivity/focus/gap/date/cwd 필터가 URL에 남아 재점검과 공유가 쉽다.
- dashboard metric, distribution, trend, project profile에서 바로 목록으로 drilldown할 수 있다.
- detail queue navigation으로 품질 보강 큐를 연속 검토할 수 있다.
- copy/bookmark/usefulness 신호가 "다시 쓸 prompt"를 대시보드로 올린다.

아직 비효율적인 부분은 "좋은 prompt를 어떻게 다음 입력으로 개선할지"다.

- instruction 후보는 copyable suggestion 수준이다.
- prompt rewrite는 없다.
- 같은 prompt의 개선 버전, 채택 여부, 이전 버전과의 비교가 없다.
- 재사용 신호는 copy/bookmark만 있고, 실제 downstream 결과 품질은 판단하지 않는다.

## 4. 개발 효율

현재 구현 구조는 작은 단일 패키지 안에서 CLI, server, storage, web이 분리되어 있어 Phase 2 확장에 유리하다.

- SQLite repository가 dashboard와 list 필터를 소화하고 있어 새로운 read model 추가가 빠르다.
- `PromptReadStoragePort`에 dashboard/read/usefulness 계약이 모여 있어 API 확장이 명확하다.
- analyzer가 deterministic local rules로 독립되어 있어 외부 LLM을 붙이기 전에도 테스트 가능한 baseline이 있다.
- release smoke가 실제 built CLI/server를 실행하므로 회귀 검출 비용이 낮다.

개발 효율을 떨어뜨릴 수 있는 지점은 다음이다.

- `src/storage/sqlite.ts`가 dashboard, migration, repository, rebuild-index를 많이 품고 있어 import/reconciliation까지 넣으면 파일 응집도가 과도해질 수 있다.
- project policy, import job, export job은 현재 prompt read/write와 생명주기가 다르므로 무리하게 같은 함수군에 넣으면 복구가 어려워진다.
- 외부 LLM 분석은 보안/동의/감사/비용 UI까지 같이 필요하므로 analyzer 함수만 바꾸는 방식으로 접근하면 안 된다.

## 5. 다음 개발 우선순위

| 우선순위 | 후보 | 효용 | 위험/비용 | 판단 |
| --- | --- | --- | --- | --- |
| 1 | Project Control Plane | 높음 | 중간 | 프로젝트별 수집/분석/보존 정책을 UI에서 제어해 운영 비용을 줄인다. |
| 2 | Transcript Import Dry Run | 매우 높음 | 높음 | 설치 전 과거 prompt를 가져와 초기 가치를 키운다. best-effort 경계가 필수다. |
| 3 | Prompt Improvement Workspace | 높음 | 중간 | 좋은 prompt를 찾는 데서 끝내지 않고 개선/재사용까지 연결한다. |
| 4 | Anonymized Export | 중간 | 중간 | 오픈소스 사용자와 팀 공유에 유용하지만 privacy 경계가 중요하다. |
| 5 | External LLM Analysis Gated Beta | 높음 | 높음 | 분석 품질은 좋아지지만 동의, redaction, audit, provider 설정 없이는 위험하다. Phase 2 core 완료 조건에서 제외한다. |
| 6 | Semantic Duplicate/Cluster | 중간 | 높음 | 정확도와 privacy 비용이 크다. local-only embedding 또는 opt-in 이후로 미룬다. |

## 6. 권장 2차 개발 순서

1. Project Control Plane
2. Transcript Import Dry Run과 imported-only queue
3. Prompt Improvement Workspace MVP
4. Import execution/resume hardening
5. Anonymized Export preset
6. External LLM Analysis gated beta

이 순서가 좋은 이유는 privacy와 운영 제어를 먼저 만든 뒤, 과거 데이터와 고급 분석을 얹기 때문이다. 외부 LLM 분석을 먼저 붙이면 제품은 더 화려해 보이지만, 로컬 우선 원칙과 사용자 신뢰 경계가 약해진다.

## 7. 2차 개발 착수 기준

- 새 기능은 raw prompt를 stdout, server error, browser URL, dashboard aggregate에 노출하지 않는다.
- 프로젝트별 opt-in/out과 prompt 단위 exclusion이 외부 분석, import, export에 공통 적용된다.
- import/export/analysis job은 dry-run 또는 preview를 먼저 제공한다.
- Markdown archive는 계속 source of truth이며, DB는 재생성 가능한 index로 유지한다.
- TDD로 storage/API 계약을 먼저 고정하고, UI는 `DESIGN.md` 기준으로 구현 후 브라우저에서 확인한다.
