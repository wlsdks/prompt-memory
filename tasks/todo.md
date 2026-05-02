# 작업 계획

## 2026-05-03 Practice Projected Score Preview

- [x] quick fix 전체 적용 draft preview 모델을 TDD로 추가
- [x] Practice UI에서 fixes 적용 후 예상 점수와 delta를 표시
- [x] browser E2E와 desktop/mobile screenshot으로 흐름 확인
- [x] release gate 검증, 커밋, 푸시, CI 확인

### 판단 기준

- 사용자는 quick fix를 적용하기 전에 예상 점수 개선 폭을 볼 수 있어야 한다.
- projected preview는 브라우저 메모리에서만 계산하고 prompt draft text, raw path, secret을 저장하지 않는다.
- 새 화면, 새 DB, 새 MCP tool 없이 Practice builder의 확신과 행동성을 강화한다.

## 2026-05-03 Practice Quick Fix Builder

- [x] Practice quick-fix builder 모델을 TDD로 추가
- [x] Practice UI에서 빠진 항목을 one-click section snippet으로 보완
- [x] 브라우저 E2E와 스크린샷으로 desktop/mobile 확인
- [x] release gate 검증, 커밋, 푸시, CI 확인

### 판단 기준

- 사용자는 점수를 읽고 직접 고민하지 않아도 부족한 프롬프트 섹션을 바로 추가할 수 있어야 한다.
- quick fix는 브라우저 draft textarea 안에서만 작동하고 prompt draft text, raw path, secret을 저장하지 않는다.
- 새 탭, 새 DB, 새 MCP tool을 늘리지 않고 Practice 화면의 핵심 행동만 강화한다.

## 2026-05-03 Coach Brief Preview

- [x] raw-free brief preview 모델을 TDD로 추가
- [x] Coach command center에서 생성된 brief 내용을 확인하고 복사할 수 있게 UI 개선
- [x] 브라우저 E2E와 스크린샷으로 desktop/mobile 확인
- [x] release gate 검증, 커밋, 푸시, CI 확인

### 판단 기준

- 사용자는 복사 전에 다음 요청 브리프 내용을 눈으로 확인할 수 있어야 한다.
- preview와 copied text 모두 prompt body, raw absolute path, secret을 포함하지 않는다.
- 새 탭이나 새 저장소 데이터를 늘리지 않고 Coach 화면 안에서 신뢰도와 사용성을 높인다.

## 2026-05-03 Coach Next Request Brief

- [x] Prompt habit coach가 raw-free next request brief를 만들도록 TDD로 추가
- [x] Coach command center에 copy next request brief 액션과 상태 표시
- [x] 브라우저 E2E와 스크린샷으로 실제 사용성/디자인 확인
- [x] release gate 검증, 커밋, 푸시, CI 확인

### 판단 기준

- 사용자는 분석 결과를 읽고 다시 생각하지 않아도 다음 Claude Code/Codex 요청 초안을 바로 복사할 수 있어야 한다.
- brief는 반복 약점, 고칠 습관, 검증 요구만 포함하고 prompt body, raw absolute path, secret을 포함하지 않는다.
- 새 탭이나 새 저장소 데이터를 늘리지 않고 Dashboard/Coach의 핵심 행동만 강화한다.

## 2026-05-03 Practice Outcome Feedback

- [x] Practice copied draft outcome 모델을 TDD로 추가
- [x] Practice UI에 Worked / Needs context / Blocked feedback controls와 outcome summary 표시
- [x] browser E2E, release gate 검증
- [x] 커밋, 푸시, CI 확인

### 판단 기준

- 사용자는 복사한 개선 초안이 실제 작업에 도움이 됐는지 빠르게 표시할 수 있어야 한다.
- outcome은 score, label, outcome metadata만 저장하고 prompt draft text는 저장하지 않는다.
- 기능은 Practice 화면 안에서 작고 명확해야 하며 새 탭이나 새 MCP tool을 늘리지 않는다.

## 2026-05-03 Practice Score History Loop

- [x] Practice copy 이후 원문 없는 score history 모델을 TDD로 추가
- [x] Practice UI에 최근 점수 추이 그래프와 반복 보완 항목을 표시
- [x] MCP archive tool 설명과 웹 카탈로그에 practice plan/next template 반환을 더 명확히 반영
- [x] browser E2E, MCP stdio, release gate 검증
- [x] 커밋, 푸시, CI 확인

### 판단 기준

- 사용자는 다음 요청 초안을 복사할 때마다 자신의 작성 품질이 오르는지 볼 수 있어야 한다.
- practice history는 prompt draft 원문, raw path, secret을 저장하지 않는다.
- 새 MCP tool을 늘리지 않고 기존 tool 선택 부담을 유지한다.

## 2026-05-03 Prompt Practice Workspace

- [x] 점수/연습 계획 다음에 실제 작성 작업면이 필요한지 재평가
- [x] Practice 탭에서 archive template을 불러오고 로컬 점수 preview를 즉시 보여주기
- [x] copy draft, checklist, missing habit 표시를 desktop web 기준으로 정리
- [x] browser E2E, MCP stdio, release gate 검증
- [x] 커밋, 푸시, CI 확인

### 판단 기준

- 사용자는 prompt-memory 안에서 다음 Claude Code/Codex 요청을 작성하고 바로 점수를 확인할 수 있어야 한다.
- 초안 작성/점수 preview는 로컬 deterministic rule만 사용하고 prompt를 저장하지 않는다.
- Practice 화면은 raw prompt archive를 새로 노출하지 않고 사용자가 직접 작성 중인 draft만 다룬다.

## 2026-05-03 Archive Practice Plan UX

- [x] `score_prompt_archive`가 점수뿐 아니라 다음 연습 행동을 줄 수 있는지 재평가
- [x] privacy-safe practice plan과 next prompt template을 TDD로 추가
- [x] Scores UI에서 practice plan, copy template, 그래프 주변 정보 구조 보강
- [x] MCP schema/docs/browser E2E/release gate 검증
- [x] 커밋, 푸시, CI 확인

### 판단 기준

- 사용자는 점수와 그래프를 본 뒤 바로 다음 prompt에 넣을 문장을 얻어야 한다.
- practice plan은 prompt body, raw absolute path, secret을 포함하지 않는다.
- 새 MCP tool을 추가하지 않고 기존 `score_prompt_archive`를 더 actionable하게 만들어 tool 선택 부담을 늘리지 않는다.

## 2026-05-03 MCP Output Schema Contract Polish

- [x] MCP `structuredContent`와 tool definition 사이의 남은 contract gap 확인
- [x] 모든 MCP tool에 `outputSchema`를 추가하고 TDD로 고정
- [x] Web MCP catalog와 문서에 output schema 보장 문구 반영
- [x] MCP stdio, browser E2E, release gate 검증
- [x] 커밋, 푸시, CI 확인

### 판단 기준

- `structuredContent`를 반환하는 tool은 에이전트가 예상 가능한 `outputSchema`를 함께 제공해야 한다.
- schema는 prompt body, raw absolute path, secret 반환을 허용하지 않는 privacy contract와 맞아야 한다.
- UI에는 “기능이 많다”보다 “Claude Code/Codex가 안전하게 호출할 수 있다”는 판단 근거가 보여야 한다.

## 2026-05-03 MCP Improve Prompt Tool

- [x] MCP 기능 gap 재평가: score 이후 승인 가능한 개선안 생성 흐름 필요성 판단
- [x] `improve_prompt` MCP tool을 TDD로 추가하고 local-only/privacy contract 검증
- [x] MCP 서버, 웹 MCP 카탈로그, README/docs/plugin skill에 새 tool 설명 반영
- [x] browser E2E, MCP stdio 실제 호출, release gate 검증
- [x] 커밋, 푸시, CI 확인

### 판단 기준

- `improve_prompt`는 직접 prompt, 저장된 `prompt_id`, 최신 prompt 중 하나만 입력받는다.
- 직접 입력은 저장하지 않고, 저장 prompt도 원문 body/raw path/secret을 반환하지 않는다.
- 개선안은 자동 제출하지 않으며 `requires_user_approval: true`와 safety notes를 반환한다.
- tool 수가 늘어도 각 tool의 사용 시점이 겹치지 않아야 한다.

## 2026-05-03 MCP Structured Tool Contract Polish

- [x] MCP tool contract가 에이전트가 안정적으로 쓰기에 충분한지 재평가
- [x] MCP `tools/call` 응답에 `structuredContent`를 추가하고 테스트로 고정
- [x] MCP tool definition에 read-only/local-only risk hints를 추가하고 웹 카탈로그에 표시
- [x] 한국어/영어 UI 문구, browser E2E, release gate 검증
- [x] 커밋, 푸시, CI 확인

### 판단 기준

- MCP tool은 raw prompt body, raw absolute path, secret을 반환하지 않는다.
- 에이전트가 tool 선택 시 read-only/local-only/structured JSON 여부를 바로 알 수 있어야 한다.
- 웹 MCP 화면은 설명용 문서가 아니라 실제 Claude Code/Codex 호출 전 참고하는 작업 화면이어야 한다.

## 2026-05-03 MCP Live Readiness UI

- [x] MCP 화면이 실제 사용 준비 상태를 판단하는 데 충분한지 재평가
- [x] MCP 화면에 prompt count, scored count, redaction, next call을 보여주는 live readiness 패널 추가
- [x] 한국어/영어 UI 문구와 browser E2E 검증 보강
- [x] 전체 검증, 커밋, 푸시, CI 확인

### 판단 기준

- MCP 화면은 도구 목록만 보여주는 설명 페이지가 아니라 Claude Code/Codex 사용 전에 확인하는 운영 화면이어야 한다.
- 표시 데이터는 dashboard/settings/health의 안전한 aggregate만 사용하고 prompt body, raw path, secret은 노출하지 않는다.
- next call은 캡처된 데이터가 없으면 setup/status, 데이터가 있으면 archive score로 자연스럽게 이어져야 한다.

## 2026-05-03 MCP Tool Catalog UI Polish

- [x] 추가 탭/화면이 실제로 필요한지 IA 기준으로 판단
- [x] MCP tool catalog 화면을 추가해 tool 선택 기준과 예시 prompt를 웹에서 확인 가능하게 만들기
- [x] 한국어/영어 UI 문구와 browser E2E 검증 보강
- [x] 전체 검증, 커밋, 푸시, CI 확인

### 판단 기준

- MCP 화면은 마케팅 설명이 아니라 Claude Code/Codex 사용자가 바로 호출할 tool을 고르는 작업 화면이어야 한다.
- tool 설명은 what/when/returns/privacy가 분리되어 있어야 한다.
- prompt body, raw path, secret을 화면에 새로 노출하지 않는다.

## 2026-05-03 MCP Status Preflight And Final Polish

- [x] UI/UX 추가 탭 필요성 재평가
- [x] MCP에서 prompt-memory 준비 상태를 확인하는 preflight tool 추가
- [x] README/Plugin/Tech spec에 새 MCP tool 사용 맥락 반영
- [x] MCP 테스트와 release/browser 검증 재실행
- [x] 커밋, 푸시, CI 확인

### 판단 기준

- 탭은 정보를 숨기기보다 탐색을 더 쉽게 만들 때만 추가한다.
- MCP status tool은 score tool과 겹치지 않고, 에이전트가 캡처/저장/측정 준비 상태를 판단하는 데만 쓴다.
- status tool도 prompt body, raw path, secret을 반환하지 않는다.

## 2026-05-03 Product Polish: Charts, MCP Tools, UX Review

- [x] 현재 기능 표면이 실제 사용 가치와 맞는지 재점검
- [x] 오픈소스 React chart library를 검토하고 Dashboard/Scores/Insights에 적용
- [x] MCP tool 목록과 설명을 Claude Code/Codex 사용 맥락에 맞게 보강
- [x] Project instruction review를 MCP에서도 호출 가능한지 검토하고 필요한 경우 추가
- [x] UI/UX를 desktop web 기준으로 더 보기 좋고 분석 도구답게 개선
- [x] 테스트, build, browser E2E, pack dry-run 검증 후 커밋/푸시

### 판단 기준

- 그래프는 장식이 아니라 품질 추세, 점수 분포, 반복 약점처럼 사용자가 다음 행동을 결정하는 데이터에만 쓴다.
- 외부 라이브러리는 유명하고 유지보수되는 오픈소스이며 현재 React/Vite 구조와 충돌하지 않아야 한다.
- MCP tool 설명은 에이전트가 언제 어떤 도구를 써야 하는지, 어떤 개인정보를 반환하지 않는지 분명해야 한다.
- Project instruction 분석은 파일 원문, raw absolute path, secret을 반환하지 않는다.

## 2026-05-03 Project Instruction Analysis And Sidebar Polish

- [x] `AGENTS.md` / `CLAUDE.md` 분석 기준과 저장 범위 확정
- [x] 로컬 파일 원문/경로를 노출하지 않는 project instruction snapshot 저장소 구현
- [x] Projects API와 Web UI에서 분석 실행/결과 표시 추가
- [x] 좌측 navigation rail 크기, 타이포그래피, 터치 영역 개선
- [x] 테스트, browser E2E, 빌드 검증 후 커밋/푸시

### 판단 기준

- 프로젝트 규칙 파일 원문과 raw absolute path는 API/UI에 반환하지 않는다.
- 점수는 deterministic local rubric으로 계산하고 외부 LLM을 호출하지 않는다.
- 사용자는 Projects 화면에서 프로젝트별 규칙 파일 상태, 점수, 부족 항목, 다음 수정 힌트를 바로 볼 수 있어야 한다.
- Sidebar는 desktop web 기준으로 현재보다 넓고 큰 글자/아이콘/클릭 영역을 제공해야 한다.

## 2026-05-02 Agent Measurement Verification And Live Refresh

- [x] MCP `score_prompt` / `score_prompt_archive`가 Claude Code/Codex에서 쓸 수 있는지 실제 호출로 점검
- [x] 현재 입력 prompt가 hook capture 후 archive score와 web measurement에 반영되는지 검증
- [x] 웹 Benchmark/Dashboard에서 새 prompt 측정이 자동 또는 명확한 refresh로 보강
- [x] Claude Code/Codex 사용 문서와 E2E/테스트 보강
- [x] 전체 검증, 커밋, 푸시, PR 상태 확인

### 판단 기준

- Agent는 raw prompt body 없이 현재 prompt 또는 archive를 점수화할 수 있어야 한다.
- Hook으로 들어온 Claude Code/Codex prompt가 score archive와 web measurement에 반영되어야 한다.
- 사용자가 화면을 보고 있을 때 새 prompt capture가 감지되면 측정 재실행 행동이 분명해야 한다.
- 외부 LLM 호출이나 자동 재입력은 이번 범위에 포함하지 않는다.

## 2026-05-02 Live Archive Measurement UX

- [x] 현재 benchmark/score 기능이 웹에서 바로 보이는지 점검
- [x] 실사용 archive measurement 모델과 우선 표시 데이터 확정
- [x] Dashboard/Scores 또는 별도 화면에 `Measure now` 흐름 구현
- [x] 한국어/영어 문구, 테스트, browser E2E 보강
- [x] 에이전트 병렬 점검 결과 반영 후 검증, 커밋 및 푸시

### 판단 기준

- Benchmark v1은 개발 회귀 측정이고, 사용자의 실제 archive 측정과 혼동되지 않아야 한다.
- 사용자는 버튼 하나로 현재 프롬프트 습관 점수, review backlog, biggest gap, privacy 상태, next action을 볼 수 있어야 한다.
- 측정 결과는 raw prompt body, raw path, secret을 표시하지 않는다.
- 측정 화면은 정보를 늘리기보다 다음 행동을 분명하게 해야 한다.

## 2026-05-02 Display Data Usefulness And Query Audit

- [x] Dashboard/Coach/Scores/Insights에 표시되는 데이터 목록과 필요성 평가
- [x] API/SQLite 집계 경로가 실제 표시 데이터와 일치하는지 검증
- [x] 불필요하거나 오해를 부르는 표시 항목 제거/조정
- [x] 반복 호출 쿼리와 dashboard 집계 쿼리 최적화 필요 여부 확인
- [x] 테스트, 브라우저 웹 점검, 커밋 및 푸시

### 판단 기준

- 사용자가 다음 행동을 결정하는 데 직접 도움이 되는 데이터만 우선 표시한다.
- privacy-safe project label, masked path, redaction 상태를 유지한다.
- 단순히 “있어서 보여주는” 데이터는 숨기거나 더 적절한 화면으로 이동한다.
- 쿼리 최적화는 실제 WHERE/ORDER/GROUP BY 경로를 보고 판단한다.

## 2026-05-02 Dashboard Information Architecture Split

- [x] Dashboard를 overview 전용 화면으로 축소
- [x] Prompt Coach, Scores, Insights를 좌측 메뉴의 독립 화면으로 분리
- [x] 기존 Dashboard 섹션을 새 화면에 재배치하고 중복/과밀 표시 제거
- [x] English/Korean UI 문구와 라우팅/E2E 기대값 갱신
- [x] 웹 기준 Playwright 점검, 자동 검증, 커밋 및 푸시

### 분리 기준

- Dashboard는 첫 판단에 필요한 요약과 다음 이동만 보여준다.
- Coach는 사용자가 다음 프롬프트를 더 잘 쓰도록 돕는 화면이다.
- Scores는 누적 프롬프트 점수, 점수 분포, 낮은 점수 목록을 검토하는 화면이다.
- Insights는 프로젝트/도구/재사용/중복/반복 패턴을 운영 분석처럼 보는 화면이다.
- 모바일은 이번 우선순위에서 제외하고, desktop web 가독성과 정보 밀도를 먼저 다듬는다.

## 2026-05-02 Dashboard Design Rebuild And Functionality Recheck

- [x] `/Users/jinan/ai/awesome-design-md` 참고 기준을 프로젝트 디자인 문서와 작업 규칙에 반영
- [x] `/Users/jinan/side-project/oh-my-ontology` 디자인 시스템을 확인하고 prompt-memory 기준으로 이식
- [x] warm teal/dashboard command center 스타일을 oh-my-ontology 단일 인디고 다크 시스템으로 재구축
- [x] 낮은 점수 review queue가 실제 개선 대상만 보여주는지 실패 테스트 작성
- [x] Prompt Habit Coach dashboard를 command center 형태로 재구축
- [x] 한국어/영어 UI 문구와 responsive layout 보강
- [x] 자동 테스트, 전체 게이트, pack dry-run 재실행
- [x] DevTools MCP로 desktop/mobile 렌더링, 콘솔/네트워크, 핵심 클릭 흐름 확인
- [x] 커밋, 푸시, PR 상태 확인

### 디자인 기준

- awesome-design-md는 그대로 복제하지 않고 `prompt-memory`의 로컬 우선 developer tool 정체성에 맞게 적용한다.
- 사용자가 명시한 기준은 `/Users/jinan/side-project/oh-my-ontology`의 Linear-base dark indigo design system이다.
- Dashboard 첫 영역은 score, biggest weakness, next fix, low-score review queue가 한눈에 들어오는 작업 화면이어야 한다.
- 낮은 점수 큐는 높은 점수 prompt를 섞어 보여주면 안 된다.
- Dashboard는 raw prompt body, raw path, secret을 표시하지 않는다.

## 2026-05-02 Prompt Habit Coach Dashboard v1

- [x] Dashboard를 단순 지표판에서 습관 코치 화면으로 재구성
- [x] 최근 점수 추세, 가장 큰 약점, 다음 개선 규칙, 낮은 점수 review queue 도출 로직 추가
- [x] 낮은 점수 프롬프트에서 바로 상세/개선 흐름으로 이동 가능한 UI 추가
- [x] English/Korean UI 문구와 responsive 스타일 보강
- [x] 자동 테스트와 browser E2E 업데이트
- [x] DevTools MCP로 실제 Dashboard 렌더링, 콘솔/네트워크, mobile overflow 점검
- [x] 전체 검증, 커밋, 브랜치 푸시, PR CI 확인

### 디자인 기준

- 대시보드 첫 영역은 "내 프롬프트 습관이 지금 어떤 상태인지"를 바로 말해줘야 한다.
- 점수만 나열하지 않고, 가장 자주 빠뜨리는 항목과 다음 요청에서 넣을 문장을 제안한다.
- 낮은 점수 prompt는 review queue로 보여주고, 클릭하면 기존 상세 화면의 Prompt Coach로 이어진다.
- 원문 prompt body, raw path, secret은 Dashboard에 표시하지 않는다.

## 2026-05-02 Archive Score Review / MCP Batch Scoring

- [x] 누적 프롬프트 archive score 공통 엔진과 privacy-safe report 구현
- [x] CLI `prompt-memory score` 추가 및 JSON/text 출력 검증
- [x] MCP `score_prompt_archive` 도구 추가 및 Claude/Codex 호출 문서화
- [x] Web API와 Dashboard에서 archive score review 제공
- [x] Claude Code slash command와 Codex plugin skill에 archive score 흐름 추가
- [x] README/기술 문서/플러그인 문서 갱신
- [x] 자동 테스트, browser E2E, release smoke, pack dry-run 검증
- [x] 커밋 및 브랜치 푸시

### 첫 구현 범위

- 원문 프롬프트 전체를 MCP 응답으로 반환하지 않는다.
- 기본 점수는 로컬 deterministic Prompt Quality Score를 사용한다.
- Claude Code/Codex는 `/prompt-memory:score` 또는 MCP 요청 시 report를 해석하고 개선 방향을 제안한다.
- CLI와 Web도 같은 archive score report를 사용한다.
- 외부 LLM judge나 자동 원문 재입력은 이번 단위에서 제외한다.

## 2026-05-02 Full Open Source Readiness And Agent Rules Audit

- [x] 저장소 공개 문서/라이선스/커뮤니티 파일 완비 여부 점검
- [x] npm package allowlist와 개인정보/로컬 데이터 제외 여부 점검
- [x] GitHub Issues/Discussions/PR 보호/CI 상태 점검
- [x] GitHub secret scanning, push protection, Dependabot security update 상태 점검
- [x] Claude Code/Codex용 규칙 파일과 plugin/skill 지침 점검
- [x] 누락된 agent 규칙 보강
- [x] 검증, 커밋, PR 업데이트

## 2026-05-02 Open Source Bilingual Readme Review

- [x] 오픈소스 준비 상태 재검토
- [x] README 영어/한국어 선택 링크 추가
- [x] 한국어 README 추가 및 package 포함
- [x] 배포 문서와 npm dry-run 범위 갱신
- [x] 검증, 커밋, PR 생성

## 2026-05-02 Pre-Publish Open Source Governance And I18n

- [x] npm tarball에 포함될 파일과 코드 범위 확인
- [x] 개인 PC 경로/토큰/민감정보 포함 여부 점검
- [x] `.gitignore`와 npm package allowlist 보강
- [x] LICENSE, contributing, code of conduct, support, issue/discussion templates 정리
- [x] GitHub issues/discussions 활성화와 main branch PR approval rule 적용
- [x] 웹 UI English/Korean 언어 전환 구현
- [x] 검증 게이트와 pack/install smoke 재실행
- [x] 커밋 및 origin/main 푸시

## 2026-05-02 Open Source English/NPM Readiness

- [x] npm에 포함되는 공개 문서의 한국어 잔존 범위 확인
- [x] README와 npm package에 포함되는 docs를 영어 기준으로 정리
- [x] npm publish 준비 상태와 로그인 상태 확인
- [x] 문서/패키징 검증 게이트 실행
- [x] 커밋 및 origin/main 푸시

## 2026-05-02 Full Feature Audit Plan

- [x] CLI command surface 점검: setup/init/hook/doctor/server/service/statusline/list/search/show/delete/rebuild/import/export/improve
- [x] API surface 점검: ingest, prompts, quality, projects, exports, settings, session, health
- [x] Web UI 흐름 점검: archive/detail/coach/projects/export/mobile
- [x] Storage/privacy 점검: Markdown source of truth, SQLite/FTS, delete cleanup, privacy regression
- [x] Benchmark/release smoke 재실행: 기능 동작과 usefulness regression 확인
- [x] 기능별 완료/제외/남은 리스크 정리

## 2026-05-02 Post-PRD2 Public Beta Hardening Plan

- [x] PRD2 core 완료 판정 audit: PRD_PHASE2 수용 기준과 실제 구현 차이 목록화
- [x] Browser raw-path boundary 결정: archive/detail/dashboard/projects에서 path를 그대로 보여줄지, masked display 옵션을 둘지 확정
- [x] Playwright 자동 E2E 추가: archive -> detail -> coach copy/save -> projects -> export -> mobile overflow
- [x] Benchmark v1 설계 및 구현: privacy, retrieval, coach quality, analytics, latency를 JSON report로 측정
- [x] Privacy regression fixture 확장: Markdown/SQLite/FTS/API/export/log/stdout raw secret/path 누출 검사
- [x] Release checklist 갱신: PRD2에서 추가된 import/export/project/coach 검증 항목 반영
- [x] README/문서 public beta 정리: 설치, hook, local-first, external analysis 미구현, Codex beta, uninstall/delete 경계 확인
- [x] Node 22/24와 package smoke 재검증: 현재 Node 20 warning을 실제 지원 버전에서 제거
- [x] Beta release candidate 태그 전 최종 live smoke: 새 설치 기준으로 Claude Code/Codex 수집과 웹 UI 확인

### 최적 순서

1. 기능을 더 추가하지 말고 PRD2 완료 audit부터 한다.
2. 공개 신뢰에 직결되는 privacy/display 경계를 먼저 닫는다.
3. 수동 검증을 Playwright E2E와 benchmark로 자동화한다.
4. 문서와 release checklist를 실제 구현 기준으로 맞춘다.
5. Node 22/24, package, 새 설치 smoke를 통과한 뒤 beta release candidate로 본다.

### 이번 단계에서 제외

- Claude Code/Codex에 prompt를 자동으로 바꿔 재입력하는 hook interception은 제외한다.
- External LLM/tool-assisted analysis는 Phase 2 core 이후 gated beta로만 검토한다.
- GitHub 연동은 제품 핵심 가치 검증 후 별도 단계로 둔다.

## 2026-05-02 Runtime Verification And Benchmark Plan

- [x] 현재 브랜치/작업트리 상태 확인
- [x] 기본 자동 검증 게이트 실행
- [x] 릴리즈 스모크 실행
- [x] 실제 서버 실행 후 핵심 UI 흐름 확인
- [x] 테스트 보강 필요 영역 판단
- [x] Claude Code/Codex 유저 관점 기능 가치 평가
- [x] 벤치마크 도구 설계 방향 정리

### 점검 기준

- 테스트 통과 여부와 Node engine 경고를 구분해서 본다.
- 서버는 임시 data dir에서 띄우고 실제 ingest 데이터로 확인한다.
- UI는 archive/detail/dashboard/projects/export의 핵심 흐름을 확인한다.
- 벤치마크는 속도뿐 아니라 privacy, retrieval, prompt improvement 품질을 함께 측정해야 한다.

## 2026-05-02 Anonymized Export Web UI

- [x] Export UI 범위와 raw-free 브라우저 경계 확정
- [x] 웹 API client 실패 테스트 작성
- [x] `/exports` 화면, preset 선택, preview, 실행, JSON 복사/다운로드 구현
- [x] desktop/mobile 렌더링과 raw-free 동작 검증
- [x] 전체 검증, 커밋 및 푸시

### 첫 구현 범위

- 기존 anonymized export API만 브라우저에서 사용한다.
- raw export, GitHub 연계, 외부 전송은 제외한다.
- export preview는 included/excluded field, prompt count, sensitive count, residual identifier count, small-set warning을 보여준다.
- 실행 결과는 브라우저에서 JSON preview, copy, download만 제공한다.
- export 화면과 API 응답에는 raw prompt id, raw cwd, raw path, raw secret을 표시하지 않는다.

## 2026-05-02 Anonymized Export Preview Job

- [x] 익명화 export 범위와 raw-free 저장 조건 확정
- [x] storage/API/CLI 실패 테스트 작성
- [x] `export_jobs` SQLite migration과 storage port 추가
- [x] 익명화 preview job 생성과 `job_id` 실행 구현
- [x] CLI `export --anonymized --preview|--job` 추가
- [x] release smoke 보강, 전체 검증, 커밋 및 푸시

### 첫 구현 범위

- browser/API/CLI 기본 경로는 anonymized export만 지원한다.
- export preview는 raw prompt id, raw cwd, raw path, raw secret 없이 `export_jobs`에 snapshot을 저장한다.
- export 실행은 `job_id`만 받아 preview와 같은 prompt count를 검증한다.
- raw export와 파일 저장 UI는 이번 단위에서 제외한다.
- export payload는 masked prompt, tags, quality gap summary, tool, coarse date, project alias만 포함한다.

## 2026-05-02 Import Execution And Imported-Only Filter

- [x] import 실행/resume 실패 테스트 작성
- [x] dry-run parser를 실행 import에서도 재사용 가능하게 분리
- [x] import job 실행, import_records 저장, idempotency/resume 처리 구현
- [x] CLI `import --execute`와 `import --resume <job-id>` 추가
- [x] list/search/API에 imported-only job filter 추가
- [x] targeted/full 검증, 커밋 및 푸시

### 첫 구현 범위

- 단일 JSONL 파일 import 실행만 지원한다.
- assistant/tool/command/file content는 계속 저장하지 않는다.
- import 대상 prompt는 저장 전 redaction pipeline을 다시 통과한다.
- raw source path, raw prompt, raw secret은 import job/record 출력에 저장하지 않는다.
- import 실행은 기존 Markdown/SQLite 데이터를 손상시키지 않고, 같은 record 재실행은 중복 저장하지 않는다.

## 2026-05-02 Prompt Improvement Draft Storage

- [x] 저장소/API 실패 테스트 작성
- [x] `prompt_improvement_drafts` SQLite migration과 storage port 추가
- [x] `POST /api/v1/prompts/:id/improvements` 구현
- [x] prompt detail 응답에 최신 개선 draft 포함
- [x] UI에서 개선안 저장 버튼과 저장 상태 표시
- [x] targeted/full 검증, 커밋 및 푸시

### 첫 구현 범위

- 개선 draft는 원문 prompt를 덮어쓰지 않는다.
- 저장 전 `mask` redaction을 다시 적용한다.
- 자동으로 `AGENTS.md`, `CLAUDE.md` 또는 프로젝트 파일을 수정하지 않는다.
- 저장 이벤트는 `prompt_copied` 재사용 지표와 분리한다.

## 2026-05-02 Product Identity Documentation

- [x] README 첫머리에 local-first prompt memory and improvement workspace 포지셔닝 반영
- [x] PRD/Phase 2 PRD/Technical Spec/Implementation Plan의 목적 문장을 같은 정체성으로 정렬
- [x] CLAUDE.md/AGENTS.md 프로젝트 요약에 prompt coach와 패턴 분석 가치 반영
- [x] 문서 변경 검증, 커밋 및 푸시

### 정체성 기준

- `prompt-memory`는 단순 프롬프트 저장소가 아니다.
- 핵심 정체성은 "Claude Code, Codex 같은 AI 코딩 도구에 입력한 프롬프트를 로컬에 안전하게 기록하고, 다시 찾고, 분석하고, 다음 요청을 더 잘 쓰도록 돕는 developer tool"이다.
- 제품 포지셔닝은 "AI coding prompt memory and improvement workspace, local-first"로 통일한다.

## 2026-05-02 Prompt Coach 승인형 개선 흐름

- [x] local prompt improver 실패 테스트 작성
- [x] `improvePrompt` rule 기반 개선안 생성 구현
- [x] `prompt-memory improve --stdin|--text --json` CLI 추가
- [x] prompt detail UI에 개선안 preview와 복사 버튼 추가
- [x] hook 자동 대체/자동 재제출은 제외하고 사용자 승인형 copy flow로 제한
- [x] CLI/UI 실제 사용성 검증
- [x] 전체 검증, 커밋 및 브랜치 푸시

### 첫 구현 범위

- 원문 prompt를 Claude Code/Codex에 자동으로 대체 제출하지 않는다.
- raw prompt는 서버 로그나 hook stdout에 노출하지 않는다.
- 개선안은 목표, 맥락, 범위, 검증, 출력 형식을 보강한 Markdown prompt로 만든다.
- 저장된 redacted prompt 기준으로 UI 개선안을 생성하고, 사용자가 복사해서 직접 재입력한다.

### 점검 결과

- `prompt-memory improve --text "이거 좀 고쳐줘" --json`이 승인형 copy 개선안을 생성하는 것을 확인했다.
- 상세 화면에 "승인 후 재입력할 개선안" preview와 "개선안 복사" 버튼을 추가했다.
- Playwright로 desktop/mobile 상세 화면을 확인했고, 개선안 복사 후 copy count가 증가했다.
- mobile 390px에서 document horizontal overflow는 없었다.

## 2026-05-02 Phase 2 실제 사용 흐름 검증

- [x] 임시 data dir에서 실제 빌드 CLI import dry-run/save-job 검증
- [x] import job DB row와 CLI 출력의 raw-free 여부 확인
- [x] hook ingest와 project capture-disabled 회귀 검증
- [x] 서버 실행 후 웹 archive/projects/dashboard 사용성 점검
- [x] desktop/mobile 브라우저 렌더링, 콘솔/네트워크 오류 확인
- [x] CLI help 설명 누락 수정
- [x] 검증 결과 정리, 필요한 수정 여부 판단
- [x] 결과 기록 커밋 및 푸시

### 점검 기준

- raw prompt, raw source path, raw secret은 CLI/DB/UI 출력에 나오면 안 된다.
- import dry-run은 prompt archive를 변경하지 않아야 한다.
- project capture-disabled는 실제 ingest를 막아야 한다.
- UI는 운영형 developer tool로서 archive, project policy, dashboard 경로가 찾기 쉬워야 한다.

### 점검 결과

- 실제 빌드 CLI로 `import --dry-run --save-job --json`을 실행했고 prompt 후보 2건, malformed JSONL 1건, assistant/tool skip 2건으로 집계됐다.
- 저장된 import job과 CLI 조회 결과에는 raw source path와 raw API key가 없었고, dry-run 후 prompt row는 0건이었다.
- 서버 ingest는 첫 prompt를 저장했고, project `capture_disabled` 설정 후 같은 프로젝트의 다음 ingest는 `reason=project_policy`로 차단됐다.
- archive/detail/projects/dashboard를 Playwright로 확인했다. desktop/mobile 모두 콘솔 메시지 0건, 확인 범위 네트워크 200, mobile `scrollWidth=390`으로 page horizontal overflow는 없었다.
- 사용성 문제로 최상위 CLI help에서 `import`, `import-job` 설명이 비어 있는 점을 발견해 설명과 회귀 테스트를 추가했다.

## 2026-05-02 Import Job Storage

- [x] 현재 import/storage 구조 재확인
- [x] import job storage 실패 테스트 작성
- [x] `import_jobs`, `import_records`, `import_errors` SQLite migration 추가
- [x] raw-free import job 저장/조회/list 구현
- [x] `prompt-memory import --dry-run --save-job` CLI 추가
- [x] `prompt-memory import-job <id>` 조회 CLI 추가
- [x] targeted 검증 실행
- [x] full 검증, 커밋 및 푸시

### 첫 구현 범위

- 실제 prompt import 실행은 추가하지 않는다.
- dry-run 결과만 job으로 저장하고, 저장 payload는 source hash와 redacted summary만 포함한다.
- raw source path, raw prompt, raw secret은 import job row와 CLI 조회 결과에 저장/출력하지 않는다.
- `import_records`, `import_errors`는 다음 실행 import 단계에서 idempotency/resume/error aggregation에 쓰기 위한 스키마만 먼저 둔다.

## 2026-05-02 Phase 2 PRD 정리 및 Project Control Plane

- [x] Phase 2 PRD의 MVP/현재 기준선 충돌 정리
- [x] import dry-run 저장 범위와 export preview/job 일관성 보정
- [x] project identity, raw path 노출, policy lookup 실패 정책 명시
- [x] external analysis를 core 범위에서 분리
- [x] 문서 변경 검증
- [x] 문서 커밋 및 푸시
- [x] Project Control Plane 최소 구현 실패 테스트 작성
- [x] project policy storage/API/ingest capture-disabled 구현
- [x] UI project list와 capture-disabled toggle 구현
- [x] 서버/UI 브라우저 검증
- [x] 전체 검증, 커밋 및 푸시

### 첫 구현 범위

- `project_policies`, `policy_audit_events`를 추가한다.
- `GET /api/v1/projects`, `PATCH /api/v1/projects/:id/policy`를 추가한다.
- 첫 policy 적용은 ingest의 `capture_disabled`만 포함한다.
- UI는 project list와 capture-disabled toggle만 제공한다.
- import/export/external analysis 후보 산정, retention 실행, external network path는 제외한다.

### 구현 범위 재검토

- Project Control Plane은 의미 있는 선행 작업이다. import, export, 외부/도구 보조 분석이 모두 프로젝트별 opt-in/out과 audit를 필요로 하므로 공통 안전장치로 재사용된다.
- 이번 구현에서 의미가 약한 부분은 없다. 다만 현재 UI는 `capture_disabled`만 다루는 최소판이므로 `analysis_disabled`, retention, export 정책은 다음 기능이 실제로 붙을 때 노출하는 것이 맞다.
- Claude Code/Codex CLI를 분석 실행기로 쓰는 것은 기술적으로 가능하지만 local-only 내부 분석이 아니다. 별도 API key 저장을 피할 수 있을 뿐, payload가 사용자의 Claude Code/Codex 계정과 upstream provider로 나갈 수 있으므로 gated beta의 `tool-assisted-analysis`로 분리한다.
- tool-assisted-analysis는 Phase 2 core가 아니다. preview, explicit opt-in, project policy, redaction, timeout, no auto-write, audit가 갖춰진 뒤에만 다룬다.

## 2026-05-02 Transcript Import Dry Run

- [x] import dry-run 범위 확정
- [x] source별 allowlist parser 실패 테스트 작성
- [x] `prompt-memory import --dry-run --file <path>` CLI 추가
- [x] raw-free dry-run summary 출력 구현
- [x] assistant/tool/command/file content 제외 회귀 테스트
- [x] malformed JSONL이 전체 dry-run을 깨지 않는지 검증
- [x] dry-run이 Markdown, prompt index, FTS를 변경하지 않는지 검증
- [x] targeted/full 검증, 커밋 및 푸시

### 첫 구현 범위

- 단일 파일 dry-run만 지원한다.
- Claude Code/Codex transcript best-effort parser는 사용자 prompt 후보만 카운트한다.
- 실행 import, resume, imported-only filter, UI import 화면은 제외한다.
- dry-run 결과는 stdout JSON/텍스트 summary로만 반환하고 prompt 저장소는 변경하지 않는다.

## 2026-05-02 README Marketplace Install Flow

- [x] Claude Code/Codex 외부 사용자 설치 순서 정리
- [x] README Quick Start와 Plugin Packaging 섹션 갱신
- [x] 문서 패키징 검증
- [x] 커밋 및 푸시

### 점검 결과

- README 상단에 Quick Start를 추가해 `prompt-memory` CLI 설치와 Claude Code/Codex marketplace 추가를 분리했다.
- marketplace plugin은 CLI binary를 설치하지 않으므로, 권장 순서를 CLI 설치 후 marketplace 추가로 명시했다.
- Claude Code는 `/plugin marketplace add wlsdks/prompt-memory`, `/plugin install prompt-memory`, `/reload-plugins`, `/prompt-memory:setup` 순서로 정리했다.
- Codex는 `codex plugin marketplace add wlsdks/prompt-memory` 후 `prompt-memory setup`으로 hook을 설치하고 Codex hooks를 활성화한다고 정리했다.
- 검증 명령: `git diff --check`, `pnpm pack:dry-run` 통과. Node 20.20.0에서 실행되어 `engines.node >=22 <25` 경고는 계속 발생한다.

## 2026-05-02 Claude HUD-style Plugin

- [x] Claude Code plugin 구조 설계: marketplace, manifest, slash commands, statusLine
- [x] 실패 테스트 작성: Claude plugin 파일, command 문서, statusLine 출력
- [x] `.claude-plugin` marketplace/manifest와 `/prompt-memory:*` commands 추가
- [x] `prompt-memory statusline claude-code` CLI 추가
- [x] README/docs/package 포함 파일 갱신
- [x] 검증 명령 실행
- [x] 커밋 및 푸시

### 점검 결과

- Claude Code repo-local marketplace 파일을 `.claude-plugin/marketplace.json`에 추가했다. 사용 흐름은 `/plugin marketplace add wlsdks/prompt-memory`, `/plugin install prompt-memory`, `/reload-plugins`다.
- Claude Code plugin manifest `.claude-plugin/plugin.json`에 `/prompt-memory:setup`, `/prompt-memory:status`, `/prompt-memory:open` command 문서를 연결했다.
- `/prompt-memory:setup`은 CLI 존재 여부를 먼저 확인하고, `prompt-memory setup --dry-run`을 보여준 뒤 승인 시 실제 setup을 실행하도록 작성했다. statusLine은 기존 Claude `statusLine`을 대체할 수 있어서 별도 승인 후 `install-statusline`을 실행하게 했다.
- `prompt-memory statusline claude-code`, `install-statusline claude-code`, `uninstall-statusline claude-code`를 추가했다. statusLine은 capture on/paused/setup needed, server 상태, last ingest 상태를 한 줄로 출력한다.
- 검증 명령: `pnpm format`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `pnpm smoke:release`, `git diff --check` 통과. `pnpm prompt-memory install-statusline claude-code --dry-run`과 `pnpm prompt-memory statusline claude-code`도 실제 빌드된 CLI로 실행했다.
- 현재 로컬에서는 서버가 내려가 있어 statusLine 출력은 `PM capture paused | server down | last ingest failed`였다. Node 20.20.0에서 실행되어 `engines.node >=22 <25` 경고는 계속 발생한다.

## 2026-05-02 Claude/Codex Plugin Packaging

- [x] 공식 확장 방식과 로컬 plugin manifest 스펙 확인
- [x] Codex repo-local plugin manifest/hook 패키지 추가
- [x] Claude Code 호환 방식과 plugin 한계 문서화
- [x] npm package 포함 파일과 검증 보강
- [x] 검증 명령 실행
- [x] 커밋 및 푸시

### 점검 결과

- Codex용 repo-local plugin 패키지를 `plugins/prompt-memory`에 추가했다. 구성은 `.codex-plugin/plugin.json`, `hooks.json`, `skills/prompt-memory/SKILL.md`다.
- Codex plugin hook은 `UserPromptSubmit`에서 `prompt-memory hook codex`를 실행하며, CLI가 `PATH`에 없거나 실패하면 `|| true`로 fail-open한다. hook command에는 ingest token을 넣지 않았다.
- Claude Code는 공식 확장 지점이 settings hook이라 `integrations/claude-code/settings.example.json`과 설명 문서를 추가했다. 일반 사용자는 `prompt-memory setup` 또는 `install-hook claude-code`가 더 안전하다.
- README와 `docs/PLUGINS.md`에 plugin 패키징과 명시적 setup이 여전히 필요한 이유를 문서화했다.
- `package.json` `files`에 `docs/PLUGINS.md`, `plugins`, `integrations`를 추가했고, `pnpm pack:dry-run`에서 tarball 포함을 확인했다.
- 검증 명령: `pnpm format`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `pnpm smoke:release`, `git diff --check` 통과. Node 20.20.0에서 실행되어 `engines.node >=22 <25` 경고는 계속 발생한다.

## 2026-05-02 One-command Setup UX

- [x] `setup`/service 설계 범위 확정
- [x] 실패 테스트 작성: setup dry-run, hook install, macOS service plist
- [x] `prompt-memory setup` 구현
- [x] `prompt-memory service install/start/status/stop` 구현
- [x] README에 명시적 setup 필요 이유와 간단 사용법 추가
- [x] 검증 명령 실행
- [x] 커밋 및 푸시

### 점검 결과

- `prompt-memory setup`은 data dir 초기화, Claude Code/Codex hook 자동 감지 설치, macOS LaunchAgent 서버 등록을 한 번에 수행한다.
- package install만으로 사용자 설정 파일이나 로그인 서비스를 바꾸지 않는 이유를 README에 명시했다. `setup`은 사용자가 로컬 설정 변경을 승인하는 명시적 단계다.
- `prompt-memory setup --dry-run`으로 어떤 설정이 바뀔지 먼저 확인할 수 있고, `--no-service`로 hook만 설치한 뒤 서버는 수동 실행할 수 있다.
- `prompt-memory service install/status/start/stop`을 추가했다. 현재 자동 서비스 등록은 macOS LaunchAgent만 지원하고, 다른 OS에서는 unsupported 결과를 돌려준다.
- 검증 명령: `pnpm format`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `pnpm smoke:release`, `git diff --check` 통과. Node 20.20.0에서 실행되어 `engines.node >=22 <25` 경고는 계속 발생한다.

## 2026-05-02 Hook 재점검 및 동작 설명

- [x] 현재 서버/doctor 상태 재확인
- [x] 설치된 Claude Code/Codex hook command 재확인
- [x] 설치된 command 그대로 stdin payload 저장 재검증
- [x] hook 동작 방식과 사용자 등록 필요 여부 정리
- [x] 결과 기록, 커밋 및 푸시

### 점검 결과

- hook 등록은 유지되어 있었다. Claude Code는 `~/.claude/settings.json`, Codex는 `~/.codex/hooks.json`에 `UserPromptSubmit` hook command가 있고, Codex는 `~/.codex/config.toml`의 `codex_hooks = true`도 켜져 있다.
- 처음 재점검에서 서버가 내려가 있어 `doctor`의 `server.ok=false`였다. hook은 fail-open이라 도구 사용은 막지 않지만, 서버가 내려가 있으면 저장되지 않는다.
- 서버를 foreground로 실행한 상태에서 설치된 hook command 문자열을 그대로 읽어 stdin payload를 넣었고, Claude Code/Codex 모두 새 prompt가 저장됐다.
- 저장 확인: 최신 2건이 각각 `claude-code-v1`, `codex-v1` adapter로 `indexed` 상태였고, `password/access_token`과 API key 계열 값은 마스킹됐다.
- 결론: hook 등록은 한 번 설치하면 유지된다. 다만 저장을 하려면 `prompt-memory server`가 떠 있어야 한다. 현재 MVP에는 OS 로그인 시 서버 자동 시작 등록 기능은 없다.

## 2026-05-02 Claude Code/Codex 실제 Hook 연동 점검

- [x] 실제 `claude`/`codex` CLI 존재 여부 확인
- [x] 현재 doctor 상태 확인
- [x] hook 설치 명령의 변경 범위 확인
- [x] 기본 data dir 초기화 및 로컬 서버 실행
- [x] Claude Code/Codex hook 설치 후 doctor 재확인
- [x] 실제 hook wrapper stdin payload 전송으로 저장 검증
- [x] CLI/UI에서 저장 결과 확인
- [x] 검증 결과 기록, 커밋 및 푸시

### 점검 결과

- 실제 CLI 존재: `claude --version`은 `2.1.126 (Claude Code)`, `codex --version`은 `codex-cli 0.128.0`.
- 최초 상태: 기본 data dir 기준 `doctor claude-code`, `doctor codex` 모두 server/token/hook 미설정이었다.
- 실제 설치: `prompt-memory init`으로 기본 prompt-memory data dir을 초기화했고, `install-hook claude-code`, `install-hook codex`를 실행했다. Claude 설정은 `~/.claude/settings.json`, Codex 설정은 `~/.codex/hooks.json`, `~/.codex/config.toml`에 설치됐다.
- 발견/수정: 설치된 hook command가 `prompt-memory hook ...` 전역 명령을 가정해 실제 셸에서 `command not found`가 났다. installer를 수정해 `PROMPT_MEMORY_HOOK="..." "<node>" "<repo>/dist/cli/index.js" hook ...` 형태의 절대 실행 명령을 기록하고 기존 hook도 갱신하게 했다.
- 실제 저장 검증: 설치된 설정 파일의 command 문자열을 그대로 읽어 `sh -c`로 실행했고, Claude Code payload와 Codex payload가 각각 `claude-code-v1`, `codex-v1`로 저장됐다.
- 보안 확인: 실제 저장된 두 prompt 모두 `password/access_token` 계열은 `[REDACTED:secret_assignment]`, API key 계열은 `[REDACTED:api_key]`로 마스킹됐다.
- doctor 결과: Claude Code와 Codex 모두 server/token/settings ok. Codex는 `codexHooksEnabled=true`, `duplicateHooks=false`, `hookSources=["user"]`. 마지막 ingest status는 `ok=true`, `status=200`.
- UI 확인: `http://127.0.0.1:17373` 목록에서 Claude Code/Codex 두 건이 최신 행으로 표시되고 원문 비밀값은 노출되지 않았다.
- 검증 명령: `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `pnpm smoke:release`, `git diff --check` 통과. Node 20.20.0에서 실행되어 engine 경고는 계속 발생한다.

## 2026-05-02 전체 기능 점검 및 사용성 평가

- [x] 최신 Web Interface Guidelines와 `DESIGN.md` 기준 확인
- [x] 기능/API/스토리지/CLI 테스트 게이트 실행
- [x] 임시 data dir로 서버 실행 및 샘플 데이터 ingest
- [x] Chrome DevTools MCP로 dashboard/list/detail/settings 주요 흐름 재점검
- [x] desktop/mobile 렌더링, 접근성 이름, overflow, 콘솔/네트워크 상태 확인
- [x] 사용성 평가와 개선 후보 정리
- [x] 결과 기록, 커밋 및 푸시

### 점검 결과

- 자동 검증: `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `pnpm smoke:release`, `git diff --check` 통과.
- 기능 흐름: init/server/ingest/list/search/show/delete/rebuild-index CLI smoke 통과. 웹 UI에서 list 검색, 품질 gap 필터 이동, detail 분석 preview, copy event, bookmark, delete modal/confirm, dashboard, settings를 확인했다.
- 발견/수정: `password=super-secret-value` 같은 명시적 secret assignment가 마스킹되지 않고 목록에 노출되는 문제를 발견했다. `secret_assignment` detector와 회귀 테스트를 추가했고, 새 빌드 서버에서 `[REDACTED:secret_assignment]`로 표시되는 것을 확인했다.
- 브라우저 검증: desktop 1440x900, mobile 390x844 screenshot을 저장했고, mobile에서 document 단위 horizontal overflow는 없었다. 긴 경로는 truncation 내부 overflow만 있었고 페이지 폭은 깨지지 않았다.
- 콘솔/네트워크: Chrome DevTools MCP 기준 콘솔 메시지 없음. 확인 범위 네트워크 요청은 API/asset `200`, favicon `204`.
- 사용성 평가: 현재 구조는 첫 화면 archive 중심, dashboard drill-down, detail action이 이어져 운영형 developer tool로 적합하다. 다만 browser navigation은 `<button>` + `history.pushState` 기반이라 Cmd/Ctrl-click deep link 같은 링크 네이티브 동작은 아직 없다.
- 남은 리스크: 현재 로컬 셸은 Node 20.20.0이라 모든 pnpm 명령에서 `engines.node >=22 <25` 경고가 난다. Node 22 환경에서는 `better-sqlite3` 네이티브 모듈을 Node 22 ABI로 재빌드해야 한다.

## 2026-05-02 Chrome DevTools MCP 기능 점검

- [x] 실행 중인 서버/포트 확인
- [x] Chrome DevTools MCP로 앱 접속
- [x] Dashboard/List/Detail/Settings 주요 화면 점검
- [x] 검색/필터/복사/삭제 등 핵심 상호작용 점검
- [x] desktop/mobile 렌더링, 콘솔/네트워크 오류 확인
- [x] 점검 결과 정리

### 점검 결과

- `localhost:3100`은 `excalidraw-mcp-server`였고, `prompt-memory`는 임시 data dir `/tmp/prompt-memory-devtools.5BogJo`로 `http://127.0.0.1:17373`에서 별도 실행했다.
- 샘플 prompt 3건을 ingest했고, 1건은 삭제 흐름 확인 후 정상 삭제되어 최종 UI에는 2건이 남았다.
- 목록, 검색, 태그 필터, 민감정보 필터, 상세 분석 preview, prompt 복사 이벤트, bookmark, 삭제 modal/confirm, dashboard, settings를 Chrome DevTools MCP로 확인했다.
- desktop 1440x900, mobile 390x844에서 screenshot과 accessibility snapshot을 확인했고, mobile horizontal overflow는 없었다.
- 콘솔 메시지는 없었고, 네트워크 요청은 확인 범위에서 모두 `200` 또는 favicon `204`였다.
- Node 22 실행은 기존 `better-sqlite3` 네이티브 모듈이 Node 20 ABI로 빌드되어 실패했다. 이번 브라우저 점검은 현재 설치 상태에 맞춰 Node 20으로 진행했다.

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
- [x] 로컬 디자인 가이드 구조와 관련 예시 확인
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

## P26 Detail Queue Navigation

- [x] P25 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] 현재 목록 queue 기준 이전/다음 프롬프트 계산
  - [x] 상세 화면에 `이전` / `다음` action 추가
  - [x] queue 밖 direct detail 진입 시 버튼 disabled 처리
  - [x] desktop/mobile에서 action layout overflow 방지
- [x] Playwright MCP 사용성 점검
  - [x] 필터 큐에서 상세 진입 후 다음/이전 이동
  - [x] queue 위치에 맞는 disabled 상태
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

### P26 설계 메모

- 새 API 없이 현재 로드된 list `prompts` 상태를 queue로 사용한다.
- 제품 효용은 품질 보강 큐, 날짜 drilldown, 민감정보 큐를 상세 화면에서 연속 검토하는 데 있다.
- direct URL로 상세에 진입해 queue가 없으면 이전/다음은 비활성화한다.
- Playwright MCP로 `?focus=quality-gap` 큐에서 상세 다음/이전 이동, `1 / 2`와 `2 / 2` 표시, direct detail `큐 없음` disabled, 모바일 overflow 없음, 콘솔 경고/오류 0개를 확인했다.

## P27 Detail Gap Drilldown

- [x] P26 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 웹 UI 연결
  - [x] 상세 분석 체크리스트의 `weak` / `missing` 항목에 같은 부족 항목 보기 action 추가
  - [x] 기존 `focus=quality-gap&gap=<key>` 목록 필터로 이동
  - [x] URL에는 raw prompt나 민감정보가 아니라 체크리스트 enum key만 유지
  - [x] desktop/mobile에서 checklist action overflow 방지
- [x] Playwright MCP 사용성 점검
  - [x] 상세 checklist action에서 부족 항목 목록 이동
  - [x] active filter bar와 목록 결과 확인
  - [x] desktop/mobile overflow와 console/network 오류 확인
- [x] 기본 검증 명령 실행
  - [x] `pnpm test`
  - [x] `pnpm lint`
  - [x] `pnpm format`
  - [x] `pnpm build`
  - [x] `pnpm pack:dry-run`
  - [x] `pnpm smoke:release`
  - [x] `git diff --check`
- [x] 커밋 및 `git push origin main`

### P27 설계 메모

- 새 분석기나 저장 구조 없이 기존 detail checklist와 `qualityGap` 목록 필터를 연결한다.
- 제품 효용은 개별 프롬프트 상세에서 발견한 부족 항목을 같은 문제를 가진 전체 큐로 바로 확장하는 데 있다.
- URL과 API에는 안전한 checklist key만 사용하고, raw prompt나 snippet을 경로/쿼리에 넣지 않는다.
- Playwright MCP로 상세 `배경 맥락` action 클릭 후 `?focus=quality-gap&gap=background_context` 이동, active filter 2개, 목록 2개, 모바일 390px 수평 overflow 없음, 콘솔 경고/오류 0개를 확인했다.

## P28 Project Quality Profiles

- [x] PRD Phase 2 잔여 범위와 현재 제품 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 실패 테스트 먼저 작성
  - [x] dashboard가 프로젝트별 입력량, 품질 보강률, 민감정보 수, 재사용 신호를 반환
  - [x] project profile 응답에 raw prompt/snippet이 포함되지 않음
- [x] 저장소/API 구현
  - [x] `PromptQualityDashboard.project_profiles` 타입 추가
  - [x] SQLite dashboard 집계에 프로젝트별 품질 프로필 추가
  - [x] 프로젝트별 top gap을 checklist enum/label/count로 제한
- [x] 웹 UI 연결
  - [x] 대시보드에 프로젝트 품질 프로필 패널 추가
  - [x] 프로젝트 전체/품질 보강/민감정보 drilldown action 제공
  - [x] desktop/mobile에서 긴 경로와 badge overflow 방지
- [x] Playwright MCP 사용성 점검
  - [x] project profile rendering
  - [x] project 전체/품질 보강/민감정보 drilldown
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

### P28 설계 메모

- 새 원문 저장이나 외부 분석 없이 기존 `prompts`, `prompt_analyses`, usefulness 메타 이벤트만 집계한다.
- 제품 효용은 어느 프로젝트에서 프롬프트 품질 보강/민감정보/재사용 신호가 집중되는지 한눈에 보고 바로 목록으로 이동하는 데 있다.
- 프로젝트 프로필 API에는 count/rate/checklist key만 반환하고 prompt body, snippet, raw secret은 반환하지 않는다.
- Playwright MCP로 프로젝트 프로필 렌더링, project-a 품질 보강 drilldown, project-a 민감정보 drilldown, mobile 390px 렌더링, 콘솔 경고/오류 0개를 확인했다.

## P29 Reused Focus Filter

- [x] P28 이후 사용성 빈틈 기준으로 다음 구현 단위 확정
- [x] 웹 UI 구현 전 `DESIGN.md`와 Web Interface Guidelines 재검토
- [x] 실패 테스트 먼저 작성
  - [x] `focus=reused`가 복사 또는 저장된 프롬프트만 반환
  - [x] search에서도 `focus=reused`가 동일하게 적용
  - [x] API query `focus=reused` 계약 검증
- [x] 저장소/API 구현
  - [x] `PromptFocusFilter`에 `reused` 추가
  - [x] copied event 또는 bookmark가 있는 prompt를 reused로 분류
  - [x] 기존 saved/duplicated/quality-gap 동작 유지
- [x] 웹 UI 연결
  - [x] Focus select에 `재사용됨` 추가
  - [x] Dashboard 재사용 후보와 Project profile reuse에서 reused 목록으로 이동
  - [x] empty state와 active filter label 정리
- [x] Playwright MCP 사용성 점검
  - [x] reused focus rendering
  - [x] project profile reuse drilldown
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

### P29 설계 메모

- `reused`는 외부 판단이 아니라 로컬에서 사용자가 복사했거나 저장한 명시적/약한 사용 신호만 본다.
- 제품 효용은 “좋았던 프롬프트를 다시 찾기”를 dashboard뿐 아니라 목록 필터와 프로젝트별 큐에서도 일관되게 지원하는 데 있다.
- URL에는 `focus=reused`와 선택적 `cwd`만 들어가며 raw prompt, snippet, secret은 포함하지 않는다.
- Playwright MCP로 `?focus=reused` 목록, 프로젝트 프로필 `재사용됨` drilldown, `?focus=reused&cwd=/Users/example/project-a` active filter, mobile 390px 렌더링, 콘솔 경고/오류 0개를 확인했다.

## P30 Efficiency Review / Phase 2 PRD

- [x] 현재 구현과 기존 PRD의 Phase 2 항목 대조
- [x] 효율성 평가 문서 작성
  - [x] 사용 흐름 효율성
  - [x] 분석/재사용 루프 효율성
  - [x] 운영/복구 효율성
  - [x] 구현 복잡도와 위험 대비 효용
- [x] 2차 PRD 작성
  - [x] 이미 구현된 Phase 2성 기능을 기준선으로 명시
  - [x] 다음 개발 후보를 문제/범위/수용 기준으로 분해
  - [x] 외부 LLM 분석, transcript import, project control, export 경계를 명확히 구분
- [x] 문서 링크와 package 포함 범위 검토
- [x] 검증 명령 실행
- [x] 커밋 및 `git push origin main`

### P30 설계 메모

- 효율성 평가는 이미 구현된 Phase 2성 기능을 기준선으로 보고, 다음 병목을 project control, transcript import, prompt improvement, anonymized export, external LLM opt-in 순서로 정리했다.
- 2차 PRD는 비즈니스 KPI가 아니라 개발용 요구사항으로 유지했다.
- 첫 구현 후보는 Project Control Plane으로 잡았다. import/export/external analysis가 모두 프로젝트별 policy를 필요로 하므로, 이 기반을 먼저 만드는 것이 후속 기능의 위험을 줄인다.
- README 문서 링크와 `package.json` package files에 `docs/PRD_PHASE2.md`, `docs/EFFICIENCY_REVIEW.md`를 추가했다.
- 검증 명령: `pnpm format`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `git diff --check` 통과. Node 20.20.0에서 실행되어 `engines.node >=22 <25` 경고는 계속 발생한다.

## P31 Phase 2 PRD Deep Review

- [x] 서브 에이전트 리뷰 착수
  - [x] 보안/프라이버시 경계 리뷰
  - [x] 제품/UX/가치 리뷰
  - [x] 구현/테스트/아키텍처 리뷰
- [x] 로컬 코드/문서 기준 추가 검토
- [x] 리뷰 결과 통합
- [x] PRD/효율성 문서 보강
- [x] 검증 명령 실행
- [x] 커밋 및 `git push origin main`

### P31 설계 메모

- 보안 리뷰에서 지적한 Phase 2 mutation/preview job CSRF 요구, import 파일 경계, allowlist parser, anonymized export 재식별 방지, external LLM preview snapshot 동일성, provider response untrusted content 경계를 PRD에 반영했다.
- 제품 리뷰에서 지적한 import 이후 imported-only queue, quality-gap 큐 중심 improvement workflow, Phase 2 core와 external LLM gated beta 분리를 반영했다.
- 구현 리뷰에서 지적한 project identity, Projects API와 Settings API 경계, `ProjectPolicyStoragePort`, policy audit, rebuild/delete lifecycle, 첫 구현 slice 축소와 필수 테스트 목록을 반영했다.
- 효율성 평가 문서도 external LLM을 Phase 2 core가 아닌 gated beta로 낮추고, import dry-run + imported-only queue를 앞당기는 순서로 갱신했다.
- 검증 명령: `pnpm format`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:dry-run`, `git diff --check` 통과. Node 20.20.0에서 실행되어 `engines.node >=22 <25` 경고는 계속 발생한다.

## 2026-05-02 Full Runtime Feature Check

- [x] CLI command surface 확인
- [x] 임시 data dir에서 init/server/ingest/list/search/show/delete/rebuild 동작 확인
- [x] Prompt Coach improve, import, anonymized export 동작 확인
- [x] Benchmark, release smoke, browser E2E 실행
- [x] 실제 기능 목록과 한계 정리

## 2026-05-02 Prompt Quality Score v1

- [x] 점수 기준 설계: 기존 5개 checklist를 0-100 rubric으로 변환
- [x] 분석 단위 테스트: strong/vague/partial prompt 점수와 breakdown 검증
- [x] storage/API/dashboard에 quality score와 평균/추세 노출
- [x] 웹 UI에 per-prompt score, dashboard 평균, 프로젝트 평균 표시
- [x] benchmark에 score calibration 지표 추가
- [x] 문서/검증/커밋/PR 브랜치 푸시

### 설계 메모

- Prompt Quality Score v1은 외부 LLM judge가 아니라 기존 로컬 checklist의 deterministic 점수다.
- 가중치: goal clarity 25, background context 20, scope limits 20, output format 15, verification criteria 20.
- 상태 점수: good은 full weight, weak은 half weight, missing은 0점이다.
- band는 excellent >= 85, good >= 60, needs_work >= 40, weak < 40으로 계산한다.
- benchmark는 `prompt_quality_score_calibration`으로 list/detail score 일치, vague prompt 저점, fixture 간 점수 spread를 확인한다.

## 2026-05-02 MCP Prompt Scoring

- [x] MCP tool 계약 설계: 사용자 요청에 따라 current prompt text 또는 저장 prompt id를 점수화
- [x] MCP tool handler 단위 테스트 추가
- [x] `prompt-memory mcp` stdio JSON-RPC 서버 구현
- [x] Claude Code/Codex 연결 문서화
- [x] 직접 JSON-RPC smoke, test/lint/build/pack 검증
- [x] 커밋 및 PR 브랜치 푸시

### 설계 메모

- MCP 서버는 `prompt-memory mcp`로 실행되는 stdio JSON-RPC 서버다.
- 노출 tool은 `score_prompt` 하나만 둔다. 입력은 `prompt`, `prompt_id`, `latest: true` 중 정확히 하나다.
- 직접 전달된 prompt text는 저장하지 않고, 결과에도 prompt body를 반환하지 않는다.
- 저장 prompt scoring은 기존 SQLite analysis를 읽고 score/checklist metadata만 반환한다.
- Claude Code는 `claude mcp add --transport stdio prompt-memory -- prompt-memory mcp`, Codex는 `codex mcp add prompt-memory -- prompt-memory mcp`로 연결하도록 문서화했다.
