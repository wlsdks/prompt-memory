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
- [ ] 커밋 및 `git push origin main`

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
- [ ] 커밋 및 `git push origin main`

### P12 설계 메모

- `awesome-design-md`의 목적은 특정 사이트 복제가 아니라 AI가 반복해서 따를 수 있는 명확한 디자인 문서다.
- `prompt-memory`는 마케팅 사이트가 아니라 로컬 운영형 developer tool이므로 첫 화면은 계속 실제 archive/list로 둔다.
- 시각 방향은 Linear의 정밀한 정보 밀도와 Cursor의 따뜻한 로컬 도구 톤을 참고하되, 자체 색상/컴포넌트 언어로 유지한다.
