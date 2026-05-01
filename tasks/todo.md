# 작업 계획

## P6 Web UI

- [x] P6 Web UI 계획 세분화
- [x] UI 구현 전 `DESIGN.md` 재검토
- [x] Vite React 앱 골격 추가
- [x] Prompt list/detail/settings 화면 구현
- [x] local session cookie + CSRF 흐름 추가
- [x] Fastify에서 built web asset 서빙
- [x] Dangerous Markdown/link/image sanitization 확인
- [x] 서버 실행 후 Playwright MCP로 실제 브라우저 점검
- [x] 검증 명령 실행
- [x] 커밋 및 푸시

## Review

- 공식 Claude Code memory/hooks 문서, 공식 OpenAI Codex AGENTS.md 문서, 공개 InfoQ 요약, 로컬 MIT `awesome-design-md` 자료를 확인했다.
- 루트 지침은 짧고 운영 중심으로 두고, UI 상세 규칙은 `DESIGN.md`로 분리했다.
- Playwright MCP로 `/api/v1/health`를 확인했고, favicon 404 콘솔 에러를 발견해 서버에서 204를 반환하도록 보강했다.
- 보강 후 Playwright MCP snapshot과 screenshot에서 헬스 응답이 정상 표시되는 것을 재확인했다.

### P6 계획

- UI는 첫 화면을 prompt list로 두고, 랜딩 페이지를 만들지 않는다.
- 브라우저 앱은 `/api/v1/session`에서 same-origin 세션 쿠키와 CSRF 토큰을 받은 뒤 API를 호출한다.
- CLI/자동화는 기존 bearer app token을 계속 사용할 수 있어야 한다.
- DELETE는 bearer token 또는 session cookie + `x-csrf-token` 중 하나를 요구한다.
- 정적 파일은 Vite build 결과물만 Fastify가 서빙하고, CSP를 기본 응답에 적용한다.
- Playwright MCP 점검에서 desktop 목록/상세/설정, delete modal/confirm, mobile list를 확인했다.
- 상세 화면에서 frontmatter가 보이는 문제와 mobile table header/side shell 레이아웃 문제를 발견해 수정했다.

## P6 Web UI 보강

- [x] prompt list/search 필터 API 테스트 작성
- [x] browser-safe settings API 테스트 작성
- [x] SQLite/API 필터 구현
- [x] Settings API 구현
- [x] 웹 UI 필터 컨트롤, date range, debounce, settings API 연결
- [x] 서버 실행 후 Playwright MCP로 필터/settings 재점검
- [x] 검증 명령 실행
- [x] 커밋 및 푸시

### P6 보강 검토

- Playwright MCP로 desktop 필터 조합, date range 빈 결과/복귀, settings 화면을 확인했다.
- Playwright MCP로 mobile 폭에서 필터 컨트롤이 세로로 안정적으로 쌓이고 목록이 깨지지 않는지 확인했다.
- `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `git diff --check`를 통과했다.

## P7 Codex Beta - Adapter/Ingest

- [x] 공식 Codex hooks 문서와 현재 PRD/TECH_SPEC 범위 재확인
- [x] Codex adapter 정규화 테스트 작성
- [x] `/api/v1/ingest/codex` 계약 테스트 작성
- [x] Codex adapter 구현
- [x] Codex ingest route 연결
- [x] targeted/full 검증 실행
- [x] 커밋 및 푸시

### P7 Adapter/Ingest 범위

- 이번 단위는 Codex `UserPromptSubmit` payload 정규화와 서버 ingest route까지만 포함한다.
- `install-hook codex`, `uninstall-hook codex`, Codex doctor는 config merge/feature flag 진단을 포함하므로 다음 커밋에서 별도 처리한다.
- 공식 Codex hooks 문서 기준 `UserPromptSubmit`은 공통 stdin JSON 필드와 `turn_id`, `prompt`를 받으며, matcher는 현재 무시된다.
- `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `git diff --check`를 통과했다.

## P7 Codex Beta - Hook Install/Doctor

- [x] Codex hooks.json/config.toml 설치 테스트 작성
- [x] Codex hook wrapper route 테스트 작성
- [x] Codex doctor feature flag/hook/중복 탐지 테스트 작성
- [x] `install-hook codex` / `uninstall-hook codex` 구현
- [x] `prompt-memory hook codex` 구현
- [x] `doctor codex` 구현
- [x] targeted/full 검증 실행
- [x] 커밋 및 푸시

### P7 Hook Install/Doctor 범위

- Codex 설치는 공식 hooks 문서 기준 user-level `~/.codex/hooks.json`과 `~/.codex/config.toml`을 기본 대상으로 한다.
- `config.toml`에는 `[features].codex_hooks = true`를 구조적으로 보강하고, uninstall 시에는 feature flag를 제거하지 않는다.
- doctor는 user/project hook source 중복 설치를 경고 상태로 본다.
- `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `git diff --check`를 통과했다.

## P8 Release Docs

- [x] README 설치/초기화/서버/CLI 사용법 작성
- [x] Claude Code와 Codex beta hook 연결/해제 문서화
- [x] 저장 위치, 삭제, 로컬 우선, 외부 전송 없음 문서화
- [x] OpenAI/Anthropic 비제휴 고지 작성
- [x] 보안 정책 문서 작성
- [x] 어댑터 기여 가이드 작성
- [x] 릴리스 체크리스트 작성
- [x] GitHub issue template 추가
- [x] npm package files 목록에 공개 문서 포함
- [x] 검증 명령 실행
- [x] 커밋 및 푸시

### P8 Release Docs 검토

- `pnpm format`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `git diff --check`를 통과했다.
- `pnpm pack:dry-run`에서 `README.md`, `SECURITY.md`, `docs/ADAPTERS.md`, `docs/RELEASE_CHECKLIST.md` 포함을 확인했다.

## P8 Security Regression

- [x] upstream OAuth/session token 미보존 테스트
- [x] hook fail-open raw prompt 비노출 테스트
- [x] `Sec-Fetch-Site: cross-site` 차단 테스트
- [x] raw secret Markdown/SQLite/redaction_events/FTS 미저장 테스트
- [x] delete 후 prompt/FTS/redaction_events 제거 테스트
- [x] 전체 검증 명령 실행
- [x] 커밋 및 푸시

### P8 Security Regression 검토

- 보안 회귀 범위는 새 기능 추가가 아니라 P0-P8에서 이미 설계한 로컬 우선/비밀정보 최소 저장/브라우저 경계 정책을 고정하는 테스트로 한정한다.
- `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `git diff --check`를 통과했다.

## P9 Rule-Based Analysis Preview

- [x] 현재 storage/API/UI 계약 파악
- [x] 로컬 규칙 기반 analyzer 테스트 작성
- [x] 저장/조회 시 analysis preview 저장 및 반환 테스트 작성
- [x] raw secret이 analysis 결과에 남지 않는 회귀 테스트 작성
- [x] analyzer 구현
- [x] SQLite `prompt_analyses` 연결
- [x] prompt detail API/UI에 analysis preview 표시
- [x] Playwright로 실제 상세 화면 확인
- [x] 전체 검증 명령 실행
- [x] 커밋 및 푸시

### P9 범위

- PRD의 MVP 분석 범위인 단일 프롬프트 요약/주의점 preview만 구현한다.
- 점수, 트렌드, 자동 태그, instruction 파일 후보 제안, 외부 LLM 분석은 Phase 2 이후 범위로 유지한다.
- 분석 입력은 저장 정책이 적용된 본문만 사용해서 `redactionMode=mask`에서 raw secret이 분석 결과에 남지 않도록 한다.
- Playwright CLI로 로컬 서버 상세 화면에서 `분석 preview`와 `local-rules-v1` 요약 표시를 확인했다.
- `pnpm format`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `git diff --check`를 통과했다.

## P10 Release Smoke Harness

- [x] CI 제외 범위로 릴리스 전 로컬 검증 항목 재정의
- [x] 기존 CLI/server 계약 확인
- [x] 임시 data dir/HOME 기반 release smoke 스크립트 추가
- [x] `init/server/ingest/list/search/show/delete/rebuild-index` 흐름 검증
- [x] Claude/Codex fixture-like ingest 검증
- [x] Markdown/SQLite/FTS/delete 정리 검증
- [x] README와 release checklist에 smoke 사용법 반영
- [x] smoke 및 전체 검증 명령 실행
- [x] 커밋 및 푸시

### P10 범위

- CI matrix는 이번 작업에서 제외한다.
- 스모크는 배포 산출물인 `dist/cli/index.js`를 직접 실행해서 사용자가 받을 CLI 흐름을 검증한다.
- 실제 사용자 `~/.claude`, `~/.codex`, `~/.prompt-memory`를 건드리지 않도록 임시 HOME과 임시 data dir만 사용한다.
- 샌드박스에서는 로컬 포트 listen이 `EPERM`으로 막혀 `pnpm smoke:release`를 권한 상승으로 실행했고 통과했다.
- `pnpm format`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `pnpm smoke:release`, `git diff --check`를 통과했다.

## P11 Prompt Quality Dashboard / Advanced Analysis

- [x] 현재 `local-rules-v1` 분석 결과와 SQLite/API/UI 계약 재확인
- [x] 분석 상세 스키마 설계
  - [x] `goal_clarity`, `background_context`, `scope_limits`, `output_format`, `verification_criteria` 항목 정의
  - [x] 각 항목 상태를 `good` / `weak` / `missing`으로 제한
  - [x] 항목별 reason과 rule-based suggestion 문구 정의
  - [x] raw prompt나 redacted placeholder가 분석 결과에 그대로 남지 않는 보안 기준 고정
- [x] 자동 태그 규칙 설계
  - [x] `bugfix`, `refactor`, `docs`, `test`, `ui`, `backend`, `security`, `db`, `release`, `ops` 1차 태그 세트 정의
  - [x] 태그는 검색/필터용 메타데이터로 저장하고, Markdown 원문은 사람이 읽는 archive로 유지
  - [x] 오탐 가능성이 큰 태그는 보수적으로 붙이고 UI에서 근거를 함께 노출
- [x] 실패 테스트 먼저 작성
  - [x] analyzer 체크리스트 상태/제안/태그 단위 테스트
  - [x] 민감정보가 analysis/tag/suggestion/API 응답에 노출되지 않는 회귀 테스트
  - [x] SQLite 저장, 삭제, rebuild-index 시 analysis/tag 정합성 테스트
  - [x] dashboard/pattern API 계약 테스트
- [x] 분석 저장 구조 확장
  - [x] `prompt_analyses`에 checklist/tags JSON을 추가하거나 새 테이블로 분리할지 결정
  - [x] 기존 DB와 호환되는 migration 적용
  - [x] `rebuild-index`가 Markdown archive를 기준으로 분석과 태그를 재생성하도록 연결
  - [x] 삭제 시 Markdown, DB row, FTS, redaction_events, prompt_analyses, prompt_tags 정리 유지
- [x] Prompt Quality Dashboard API 추가
  - [x] 전체 프롬프트 수
  - [x] 민감정보 포함 비율
  - [x] 도구별 분포
  - [x] 프로젝트/cwd별 분포
  - [x] 최근 7일/30일 입력량
  - [x] 부족 항목 상위 목록: 검증 기준 없음, 출력 형식 없음, 맥락 부족 등
- [x] 반복 패턴 분석 API 추가
  - [x] 프로젝트/cwd별 자주 빠지는 체크리스트 항목 집계
  - [x] "테스트 명령을 자주 빼먹음", "파일 범위를 명시하지 않음" 같은 copyable 문장 생성
  - [x] 최소 표본 수를 두어 데이터가 적을 때 과도한 결론을 내지 않도록 처리
- [x] AGENTS.md / CLAUDE.md 후보 제안 API 추가
  - [x] 반복 패턴을 instruction 후보로 변환
  - [x] 자동 파일 수정은 하지 않고 UI에서 copyable suggestion만 제공
  - [x] 프로젝트별 후보와 전체 후보를 구분
- [x] 기존 prompts API 확장
  - [x] prompt detail에 checklist, suggestions, tags 반환
  - [x] prompt list에 tags와 주요 부족 항목 summary 반환
  - [x] tag 필터 쿼리 추가
  - [x] FTS `tags` 컬럼과 `prompt_tags` 정합성 유지
- [x] 웹 UI 구현 전 `DESIGN.md` 재검토
- [x] 웹 UI 정보 구조 변경
  - [x] 좌측 nav에 Dashboard 추가
  - [x] Dashboard에 수치, 분포, 최근 입력량, 부족 항목, 반복 패턴을 조용한 운영형 레이아웃으로 배치
  - [x] Prompt Detail의 분석 preview를 항목별 체크리스트로 확장
  - [x] 개선 프롬프트 제안과 instruction 후보를 copyable block으로 표시
  - [x] Prompt List에 태그 badge와 tag 필터 추가
  - [x] 빈 데이터/표본 부족/분석 없음 상태 처리
- [x] Playwright MCP 실제 브라우저 점검
  - [x] desktop 1440x900 dashboard/list/detail/settings screenshot
  - [x] mobile 390x844 dashboard/list/detail screenshot
  - [x] accessibility snapshot에서 주요 버튼, 필터, copy action 이름 확인
  - [x] 콘솔/네트워크 오류, 텍스트 overflow, 중첩 카드 여부 확인
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P11 설계 메모

- 이번 범위는 외부 LLM 없이 deterministic local rules만 사용한다.
- 분석 항목은 저장된 redacted prompt만 입력으로 사용한다.
- dashboard 집계는 원문을 반환하지 않고 count/rate/top bucket만 반환한다.
- 프로젝트 분포는 우선 `project_root`가 있으면 사용하고, 없으면 `cwd` prefix/name 기반으로 표시한다.
- 태그와 체크리스트는 이후 규칙 개선을 위해 analyzer version을 함께 저장한다.
- `AGENTS.md` / `CLAUDE.md` 후보는 자동 반영하지 않는다. 사용자가 직접 복사할 수 있는 제안으로 시작한다.
- UI는 기존 developer tool 톤을 유지하고, landing/hero/장식형 그래픽은 만들지 않는다.

## P12 Design System Refresh / Regression QA

- [x] P11 이후 전체 회귀 검증
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `git diff --check`
- [x] `/Users/jinan/ai/awesome-design-md` 구조와 관련 예시 확인
- [x] `prompt-memory` 전용 `DESIGN.md` 재작성
  - [x] Visual Theme & Atmosphere
  - [x] Color Palette & Roles
  - [x] Typography Rules
  - [x] Component Stylings
  - [x] Layout Principles
  - [x] Depth & Elevation
  - [x] Do's and Don'ts
  - [x] Responsive Behavior
  - [x] Agent Prompt Guide
- [x] UI 토큰과 레이아웃 리프레시
  - [x] sidebar/topbar 상태와 정보 위계 정리
  - [x] list/dashboard/detail/settings 화면의 panel/table 밀도 개선
  - [x] quality checklist/tag/copy 영역 overflow 방지
  - [x] empty/loading 상태가 새 디자인 톤과 맞는지 확인
- [x] Playwright MCP 실제 브라우저 재점검
  - [x] desktop 1440x900 list/dashboard/detail/settings screenshot
  - [x] mobile 390x844 list/dashboard/detail screenshot
  - [x] accessibility snapshot에서 nav/filter/copy/delete 이름 확인
  - [x] 콘솔/네트워크 오류, 텍스트 overflow, 직접 URL 진입 확인
- [x] 커밋 및 `git push origin main`

### P12 설계 메모

- `awesome-design-md`의 목적은 특정 사이트 복제가 아니라 AI가 반복해서 따를 수 있는 명확한 디자인 문서다.
- `prompt-memory`는 마케팅 사이트가 아니라 로컬 운영형 developer tool이므로 첫 화면은 계속 실제 archive/list로 둔다.
- 시각 방향은 Linear의 정밀한 정보 밀도와 Cursor의 따뜻한 로컬 도구 톤을 참고하되, 자체 색상/컴포넌트 언어로 유지한다.

## P13 Feature Discovery / Usability Review

- [x] PRD/TECH_SPEC 대비 완료 범위 재점검
- [x] 현재 UI를 Web Interface Guidelines 기준으로 1차 점검
- [x] 기능 후보 우선순위 정리
  - [x] PRD Phase 2 잔여 기능: transcript import, 프로젝트 설정 UI, 중복 감지, git/PR 연결, import/reconciliation 이벤트
  - [x] PRD 이후 제품 기능: prompt reuse/copy, usefulness feedback, saved prompts, anonymized export, onboarding checklist
  - [x] 비용/위험/효용 기준으로 다음 구현 단위 선정
- [x] 사용성 개선 구현
  - [x] detail에서 prompt body copy action 추가
  - [x] list pagination의 `next_cursor`를 UI에서 사용할 수 있게 연결
  - [x] 검색/필터 상태를 URL query와 동기화해 공유/새로고침 시 유지
  - [x] loading 문구와 empty state 문구를 DESIGN.md 톤에 맞게 정리
- [x] 유용성 측정 설계
  - [x] 사용자가 prompt를 재사용했는지 추적할 로컬 이벤트 정의
  - [x] copied/reused/bookmarked 같은 저위험 신호부터 시작
  - [x] 외부 전송 없이 dashboard에서 useful prompt 후보를 볼 수 있게 설계
- [x] Playwright MCP 사용성 점검
  - [x] 검색/필터/URL 새로고침
  - [x] load more
  - [x] detail copy action
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P13 발견 사항

- MVP core는 자동 수집, 저장, 검색, 상세, 삭제, hook/doctor/rebuild, 보안 회귀 기준까지 대부분 완료된 상태다.
- Phase 2 중 규칙 기반 분석 정식화, 자동 태그, instruction 후보 제안은 이미 구현됐다.
- 아직 구현되지 않은 큰 기능은 과거 transcript import, 프로젝트별 설정 UI, 중복 프롬프트 감지, git branch/commit/PR 연결, import/reconciliation 이벤트 상세화다.
- 현재 사용성 결함은 UI가 API pagination의 `next_cursor`를 쓰지 않고, 검색/필터 상태가 URL에 남지 않으며, 상세 화면에서 좋은 프롬프트를 바로 복사해 재사용할 수 없다는 점이다.
- 이번 작업에서는 "찾기 -> 열기 -> 재사용" 루프를 줄이는 기능을 우선 구현했다. 상세 프롬프트 복사, list load more, URL query 기반 필터 유지가 해당한다.
- 다음 기능 후보 우선순위는 중복 프롬프트 감지, 프로젝트 설정 UI, usefulness feedback/bookmark, git branch/commit/PR 연결, transcript import 순서가 적절하다.
- usefulness 측정은 외부 전송 없이 로컬 이벤트로 시작한다. 1차 이벤트는 `prompt_copied`, `prompt_bookmarked`, `prompt_reused_hint` 정도가 적합하고, dashboard에서는 "재사용 후보"로만 보여준다.
- Playwright MCP로 `/`, `/?tag=docs`, `/?q=P13`, prompt detail, mobile list/detail을 확인했다. 첫 페이지 50개에서 `더 보기` 후 62개로 확장됐고, 상세 복사 버튼은 실제 클릭 후 `복사됨` 상태를 표시했다.

## P14 Local Usefulness Signals

- [x] PRD 잔여 기능과 P13 사용성 결과 기준으로 다음 구현 단위 확정
- [x] 실패 테스트 먼저 작성
  - [x] copy 이벤트와 bookmark toggle API 계약 테스트
  - [x] SQLite 저장/조회/삭제 정합성 테스트
  - [x] dashboard 재사용 후보 집계 테스트
- [x] 로컬 usefulness 저장 구조 추가
  - [x] `prompt_usage_events`에 `prompt_copied` 같은 저위험 이벤트 기록
  - [x] `prompt_bookmarks`로 사용자가 다시 보고 싶은 프롬프트 표시
  - [x] 삭제 시 prompt 관련 usefulness 데이터 정리
- [x] API 확장
  - [x] prompt summary/detail에 `usefulness` 반환
  - [x] `POST /api/v1/prompts/:id/events` 추가
  - [x] `PUT /api/v1/prompts/:id/bookmark` 추가
  - [x] quality dashboard에 `useful_prompts` 반환
- [x] 웹 UI 구현 전 `DESIGN.md` 재검토
- [x] 웹 UI 연결
  - [x] detail copy 성공 시 로컬 copy 이벤트 기록
  - [x] detail bookmark toggle 추가
  - [x] list에 saved/reuse count 신호를 낮은 대비로 표시
  - [x] dashboard에 "재사용 후보" 패널 추가
- [x] Playwright MCP 사용성 점검
  - [x] detail copy event
  - [x] bookmark toggle
  - [x] dashboard useful prompts
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P14 설계 메모

- usefulness는 외부 분석이나 원문 전송이 아니라 로컬 메타 이벤트만 저장한다.
- `prompt_copied`는 "이 프롬프트를 다시 쓸 가능성이 있다"는 약한 신호로 본다.
- bookmark는 사용자가 명시적으로 저장한 강한 신호로 본다.
- dashboard의 "재사용 후보"는 자동 판단이 아니라 copy count/bookmark 기반 정렬 목록으로 표시한다.
- Playwright MCP로 detail bookmark, copy event, dashboard useful prompts, mobile dashboard를 확인했다. 콘솔 오류는 0개였고 관련 API는 200으로 응답했다.

## P15 Duplicate Prompt Detection

- [x] PRD 잔여 기능과 P14 이후 제품 가치 기준으로 다음 구현 단위 확정
- [x] 실패 테스트 먼저 작성
  - [x] SQLite exact duplicate group 집계 테스트
  - [x] prompt summary/detail duplicate count 반환 테스트
  - [x] quality dashboard duplicate prompt group API 계약 테스트
- [x] 로컬 중복 탐지 구현
  - [x] redaction 이후 저장 본문 HMAC인 `stored_content_hash` 기준으로 exact duplicate group 탐지
  - [x] 원문 prompt body를 dashboard/API에 반환하지 않음
  - [x] 삭제 후 duplicate group count가 자동으로 줄어드는지 확인
- [x] 웹 UI 구현 전 `DESIGN.md` 재검토
- [x] 웹 UI 연결
  - [x] list/detail에 중복 그룹 크기 badge 표시
  - [x] dashboard에 "중복 후보" 패널 추가
  - [x] 중복 후보에서 상세로 이동 가능하게 연결
- [x] Playwright MCP 사용성 점검
  - [x] duplicate badge
  - [x] dashboard duplicate prompts
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P15 설계 메모

- 이번 단위는 semantic similarity가 아니라 exact duplicate detection만 다룬다.
- 기준은 raw prompt가 아니라 redaction 이후 저장 본문 HMAC이다. 민감정보 원문이나 prompt body는 집계 API에 노출하지 않는다.
- 중복 탐지는 "이 프롬프트를 정리하거나 더 좋은 버전을 남길 수 있다"는 운영 신호로 대시보드에 표시한다.
- Playwright MCP로 list duplicate badge, detail duplicate signal, dashboard duplicate prompts, mobile dashboard를 확인했다. 콘솔 오류는 0개였고 관련 API는 200으로 응답했다.

## P16 Focus Filters

- [x] PRD 완료 범위와 P14/P15 사용성 결과 기준으로 다음 구현 단위 확정
- [x] 실패 테스트 먼저 작성
  - [x] SQLite focus filter: saved / duplicated / quality-gap
  - [x] API query `focus` 계약 테스트
  - [x] URL query와 UI 필터 동기화 기준 고정
- [x] 저장소/API 구현
  - [x] `ListPromptsOptions.focus` 추가
  - [x] saved는 `prompt_bookmarks`, duplicated는 `stored_content_hash` group count 기준
  - [x] quality-gap은 `prompt_analyses.checklist_json`의 weak/missing 존재 기준
  - [x] search에서도 동일 focus 필터 적용
- [x] 웹 UI 구현 전 `DESIGN.md` 재검토
- [x] 웹 UI 연결
  - [x] topbar에 Focus select 추가
  - [x] URL query `focus`로 새로고침/공유 시 유지
  - [x] empty state 문구가 선택한 focus에 맞게 표시
- [x] Playwright MCP 사용성 점검
  - [x] saved focus
  - [x] duplicated focus
  - [x] quality-gap focus
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P16 설계 메모

- Focus filter는 새 분석이 아니라 이미 저장된 local signal을 목록 탐색에 연결하는 기능이다.
- 제품 효용은 "저장한 프롬프트만 다시 보기", "중복 정리 후보만 보기", "품질 보강이 필요한 프롬프트만 보기"를 빠르게 하는 데 있다.
- URL state를 유지해 dashboard에서 발견한 운영 신호를 목록 필터로 이어서 볼 수 있게 한다.
- Playwright MCP로 `?focus=saved`, `?focus=duplicated`, `?focus=quality-gap`, mobile quality-gap list를 확인했다. 콘솔 오류는 0개였고 관련 API는 200으로 응답했다.

## P17 Quality Gap Drilldown

- [x] PRD 완료 범위와 P16 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 실패 테스트 먼저 작성
  - [x] SQLite `qualityGap` 필터가 특정 체크리스트 항목의 weak/missing만 반환
  - [x] search에서도 `qualityGap` 필터가 동일하게 적용
  - [x] API query `quality_gap` 계약과 invalid value 검증
- [x] 저장소/API 구현
  - [x] `ListPromptsOptions.qualityGap` 추가
  - [x] `prompt_analyses.checklist_json` 기준 항목별 weak/missing 필터 적용
  - [x] `focus=quality-gap`과 함께 조합 가능하게 유지
- [x] 웹 UI 구현 전 `DESIGN.md` 재검토
- [x] 웹 UI 연결
  - [x] topbar에 부족 항목 select 추가
  - [x] URL query `gap`으로 새로고침/공유 시 유지
  - [x] dashboard의 "자주 부족한 항목" row에서 해당 큐로 이동
  - [x] empty state 문구가 선택한 부족 항목에 맞게 표시
- [x] Playwright MCP 사용성 점검
  - [x] dashboard gap row drilldown
  - [x] list quality gap item filter
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P17 설계 메모

- PRD의 주요 기능은 구현되어 있으므로 이번 단위는 새 분석이 아니라 기존 분석 결과를 더 행동 가능한 큐로 바꾸는 작업이다.
- `quality_gap`은 원문 prompt를 노출하지 않고 체크리스트 key만 받는다.
- 대시보드에서 발견한 반복 문제를 목록의 실제 프롬프트 집합으로 바로 좁혀, "무엇을 고쳐야 하는지"에서 "어떤 프롬프트를 고칠지"까지 연결한다.
- Playwright MCP로 dashboard `검증 기준` row drilldown, `?focus=quality-gap&gap=verification_criteria` URL 유지, desktop/mobile list 렌더링을 확인했다. 현재 페이지 콘솔 오류는 0개였고 관련 API는 200으로 응답했다.

## P18 Dashboard Distribution Drilldown

- [x] PRD 완료 범위와 P17 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] 도구별 분포 bucket 클릭 시 `tool` 필터 목록으로 이동
  - [x] 프로젝트별 분포 bucket 클릭 시 `cwdPrefix` 필터 목록으로 이동
  - [x] URL query가 필터 상태를 유지하는지 확인
  - [x] distribution row가 버튼처럼 접근 가능한 이름과 hover/focus 상태를 갖도록 정리
- [x] Playwright MCP 사용성 점검
  - [x] tool distribution drilldown
  - [x] project distribution drilldown
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P18 설계 메모

- 새 저장 구조나 분석 규칙을 만들지 않고, 이미 있는 `tool`/`cwdPrefix` 필터를 대시보드 분포와 연결한다.
- 제품 효용은 "어느 프로젝트/도구가 많은가"를 본 뒤 바로 해당 프롬프트 목록을 확인하는 데 있다.
- 분포 row는 통계 표시이면서 동작 가능한 탐색 항목이므로 button으로 구현하고 접근 가능한 이름을 유지한다.
- Playwright MCP로 `claude-code` 분포 drilldown이 `?tool=claude-code`에서 2행만 표시하고, `project-a` 분포 drilldown이 `?cwd=/Users/example/project-a`에서 2행만 표시하는 것을 확인했다. 모바일 목록 렌더링과 현재 페이지 콘솔 오류 0개도 확인했다.

## P19 Dashboard Metric Drilldown

- [x] PRD 완료 범위와 P18 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] 전체 프롬프트 metric 클릭 시 전체 목록으로 이동
  - [x] 민감정보 포함 metric 클릭 시 `isSensitive=true` 목록으로 이동
  - [x] 최근 7일/30일 metric 클릭 시 `receivedFrom` 필터 목록으로 이동
  - [x] metric이 버튼처럼 접근 가능한 이름과 hover/focus 상태를 갖도록 정리
- [x] Playwright MCP 사용성 점검
  - [x] sensitive metric drilldown
  - [x] recent 7/30 metric drilldown
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P19 설계 메모

- 새 API 없이 기존 `isSensitive`, `receivedFrom` 필터를 대시보드 metric과 연결한다.
- 제품 효용은 "민감정보 비율이 높다" 또는 "최근 입력량이 늘었다"를 본 뒤 바로 해당 프롬프트 목록을 확인하는 데 있다.
- metric은 통계 카드이면서 동작 가능한 탐색 항목이므로 `button`으로 구현하고 URL query 상태를 유지한다.
- Playwright MCP로 민감정보 metric drilldown이 `?sensitive=true`에서 1행만 표시하고, 최근 7일 metric drilldown이 `?from=2026-04-24`에서 3행, 최근 30일 metric drilldown이 `?from=2026-04-01`에서 3행을 표시하는 것을 확인했다. 모바일 목록 렌더링과 현재 페이지 콘솔 오류 0개도 확인했다.

## P20 Active Filter Bar

- [x] PRD 완료 범위와 P19 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] 현재 적용된 query/tool/tag/sensitivity/focus/gap/cwd/date 필터를 칩으로 표시
  - [x] 각 칩에서 해당 필터만 해제
  - [x] 전체 필터 초기화 버튼 추가
  - [x] 필터 없음 상태에서는 불필요한 UI를 렌더링하지 않음
- [x] Playwright MCP 사용성 점검
  - [x] dashboard drilldown 이후 활성 필터 표시
  - [x] 단일 필터 제거
  - [x] 전체 필터 초기화
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P20 설계 메모

- 새 저장 구조나 API 없이 기존 URL 필터 상태를 더 명확하게 보여주는 UI 개선이다.
- 제품 효용은 drilldown과 복합 필터 사용 후 현재 조건을 이해하고 빠르게 해제하는 데 있다.
- 칩은 좁은 화면에서도 줄바꿈되는 낮은 대비 컨트롤로 두고, 필터 값이 raw prompt나 민감정보를 포함하지 않도록 기존 query param 값만 표시한다.
- Playwright MCP로 복합 필터 URL에서 활성 필터 칩 표시, `도구` 칩 단일 제거, 전체 필터 초기화, 모바일 줄바꿈 렌더링을 확인했다. 현재 페이지 콘솔 오류는 0개였다.

## P21 Prompt List Snippets

- [x] PRD 완료 범위와 P20 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 실패 테스트 먼저 작성
  - [x] list/search summary가 redacted snippet을 반환
  - [x] raw secret이 snippet/API 응답에 노출되지 않는 회귀 테스트
- [x] 저장소/API 구현
  - [x] `PromptSummary.snippet` 추가
  - [x] `prompt_fts.snippet`을 summary에 연결
  - [x] snippet 누락 시 빈 문자열로 안전하게 fallback
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] 목록 경로 아래에 한 줄 snippet 표시
  - [x] desktop/mobile에서 긴 snippet overflow 방지
  - [x] redacted placeholder만 표시되고 raw secret은 표시하지 않음
- [x] Playwright MCP 사용성 점검
  - [x] list snippet rendering
  - [x] sensitive prompt redacted snippet
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P21 설계 메모

- 새 분석을 만들지 않고 저장 시 이미 생성한 FTS snippet을 목록 summary로 노출한다.
- 제품 효용은 날짜/경로만으로 구분하기 어려운 프롬프트를 상세 화면 진입 전 목록에서 식별하는 데 있다.
- snippet은 저장 정책이 적용된 redacted text에서 생성된 값만 사용하며, raw prompt나 raw secret을 새로 읽거나 노출하지 않는다.
- Playwright MCP로 일반 snippet과 `[REDACTED:api_key]` snippet이 목록에 표시되고 raw token은 표시되지 않는 것을 확인했다. 모바일에서는 snippet이 카드 안에서 줄바꿈됐고 현재 페이지 콘솔 오류는 0개였다.

## P22 Setup & Safety Checklist

- [x] PRD 완료 범위와 현재 제품 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 실패 테스트 먼저 작성
  - [x] settings API가 브라우저 안전한 제외 프로젝트 목록을 반환
  - [x] settings API가 인증 토큰과 raw prompt를 노출하지 않음
- [x] 설정 API 구현
  - [x] `excluded_project_roots`를 settings 응답에 추가
  - [x] 기존 secret 비노출 계약 유지
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] 설정 화면에 온보딩/안전 체크리스트 추가
  - [x] 서버, 로컬 저장소, redaction, hook 수집, 첫 프롬프트 저장 상태 표시
  - [x] 수집 제외 프로젝트 목록 표시
  - [x] desktop/mobile에서 긴 경로 overflow 방지
- [x] Playwright MCP 사용성 점검
  - [x] settings checklist rendering
  - [x] excluded project roots rendering
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P22 설계 메모

- 새 저장 구조를 만들지 않고 기존 health/settings/dashboard 신호를 설정 화면에서 행동 가능한 체크리스트로 묶는다.
- 제품 효용은 첫 설치 사용자가 "서버가 살아 있는지, hook 수집이 성공했는지, redaction이 안전한지, 실제 프롬프트가 들어왔는지"를 한 화면에서 판단하게 하는 데 있다.
- 수집 제외 프로젝트는 브라우저에 보여줘도 되는 설정 값만 반환하고, 인증 토큰과 raw prompt는 계속 응답에 포함하지 않는다.
- Playwright MCP로 설정 화면 desktop/mobile 렌더링, 체크리스트 텍스트, 수평 overflow 없음, 콘솔 경고/오류 0개를 확인했다.

## P23 Quality Trend Timeline

- [x] PRD 이후 제품 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 실패 테스트 먼저 작성
  - [x] dashboard가 최근 7일 일별 입력량/품질 보강/민감정보 trend를 반환
  - [x] trend 응답에 raw prompt가 포함되지 않음
- [x] 저장소/API 구현
  - [x] `PromptQualityDashboard.trend.daily` 타입 추가
  - [x] SQLite dashboard 집계에 최근 7일 날짜 버킷 추가
  - [x] 빈 날짜도 0으로 채워 UI가 안정적으로 렌더링되게 처리
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] 대시보드에 Quality trend 패널 추가
  - [x] 일별 입력량, 품질 보강 비율, 민감정보 건수를 compact row/bar로 표시
  - [x] desktop/mobile overflow 방지
- [x] Playwright MCP 사용성 점검
  - [x] trend panel rendering
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P23 설계 메모

- 새 분석기를 만들지 않고 기존 `prompt_analyses.checklist_json`과 `prompts.received_at`을 집계한다.
- 제품 효용은 "프롬프트 입력량이 늘고 있는지"와 "품질 보강이 필요한 프롬프트 비율이 줄고 있는지"를 대시보드에서 빠르게 확인하는 데 있다.
- trend는 날짜, count, rate만 반환하고 저장 본문이나 snippet은 반환하지 않는다.
- Playwright MCP로 desktop/mobile 대시보드에서 trend 7개 row, 민감정보 count, 수평 overflow 없음, 콘솔 경고/오류 0개를 확인했다.

## P24 Trend Day Drilldown / Date Filter Semantics

- [x] P23 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 실패 테스트 먼저 작성
  - [x] date-only `receivedFrom`/`receivedTo`가 해당 날짜 전체를 포함
  - [x] ISO timestamp 범위 필터 기존 동작 유지
- [x] 저장소/API 구현
  - [x] date-only lower bound를 day start로 정규화
  - [x] date-only upper bound를 day end로 정규화
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] trend day row 클릭 시 `from=<date>&to=<date>` 목록으로 이동
  - [x] row가 button 의미, aria-label, hover/focus 상태를 갖도록 정리
  - [x] desktop/mobile overflow 방지
- [x] Playwright MCP 사용성 점검
  - [x] trend day drilldown URL과 목록 결과
  - [x] active filter bar의 시작일/종료일 표시
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P24 설계 메모

- 새 집계를 만들지 않고 P23 trend와 기존 날짜 필터를 연결한다.
- 제품 효용은 "품질 보강 비율이 높았던 날"을 본 뒤 바로 해당 날짜의 실제 프롬프트 목록으로 내려가 점검하는 데 있다.
- date input 사용자는 `2026-05-01`을 하루 전체로 기대하므로 저장소 레벨에서 date-only bound를 명확히 보정한다.
- Playwright MCP로 trend day row 클릭 후 `?from=2026-05-01&to=2026-05-01` 목록 이동, 3개 결과, active filter 표시, 모바일 overflow 없음, 콘솔 경고/오류 0개를 확인했다.

## P25 Detail Return to Current Queue

- [x] P24 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] 상세 화면에 명시적인 `목록으로` action 추가
  - [x] 기존 필터/드릴다운 queue 상태를 유지해 목록으로 복귀
  - [x] detail action layout을 desktop/mobile에서 안정적으로 정리
- [x] Playwright MCP 사용성 점검
  - [x] 필터 목록에서 상세 진입 후 `목록으로` 복귀
  - [x] URL query와 active filter 유지
  - [x] desktop/mobile overflow와 console/network 오류
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P25 설계 메모

- 새 API 없이 기존 list filter state와 navigation을 활용한다.
- 제품 효용은 대시보드 drilldown이나 품질 보강 큐에서 상세를 연 뒤 다시 같은 작업 큐로 돌아가 여러 프롬프트를 빠르게 훑는 데 있다.
- 브라우저 back을 몰라도 보이는 action으로 흐름을 제공한다.
- Playwright MCP로 `?focus=quality-gap` 목록에서 상세 진입 후 `목록으로` 클릭 시 같은 URL, 2개 결과, active filter 유지, 모바일 overflow 없음, 콘솔 경고/오류 0개를 확인했다.
