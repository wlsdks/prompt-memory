# AGENTS.md

이 문서는 Codex와 다른 코딩 에이전트가 이 저장소에서 작업할 때 따를 프로젝트 규칙이다. 모든 응답과 작업 메모는 기본적으로 한국어로 작성한다.

## 프로젝트 요약

- `prompt-memory`는 Claude Code, Codex 같은 AI 코딩 도구에 입력한 프롬프트를 로컬에 안전하게 기록하고, 다시 찾고, 분석하고, 다음 요청을 더 잘 쓰도록 돕는 developer tool이다.
- 제품 포지셔닝은 "AI coding prompt memory and improvement workspace, local-first"다.
- 이 도구는 프롬프트 코치이자, 사용자가 반복해서 넣는 좋지 않은 프롬프트 패턴을 회고하고 개선하도록 돕는 로컬 작업대다.
- MVP의 핵심 원칙은 로컬 저장, 명시적 설치, 비밀정보 보호, Markdown을 사람이 읽을 수 있는 원본으로 유지하는 것이다.
- 현재 스택은 TypeScript, Node.js, Commander CLI, Fastify, SQLite, Vitest, pnpm이다.

## 작업 방식

- 3단계 이상이거나 아키텍처 판단이 필요한 작업은 먼저 계획을 세운다.
- 계획은 `tasks/todo.md`에 체크 가능한 항목으로 남기고, 진행하면서 상태를 갱신한다.
- 사용자가 정정하거나 반복 실수를 지적하면 `tasks/lessons.md`에 재발 방지 규칙을 추가한다.
- 구현은 TDD를 기본으로 한다. 실패 테스트를 먼저 만들고, 최소 구현으로 통과시킨 뒤 리팩터링한다.
- 작업 단위가 끝나면 반드시 커밋하고 현재 작업 브랜치에 푸시한 뒤 PR을 열거나 갱신한다. 큰 작업은 한 번에 몰아 커밋하지 않는다.
- 변경 전후 동작이 달라질 수 있으면 테스트, 로그, CLI 출력, Playwright MCP 점검 중 적절한 증거를 남긴다.

## 검증 명령

기능 변경 후 기본 게이트:

```bash
pnpm test
pnpm lint
pnpm build
pnpm pack:dry-run
git diff --check
```

로컬 Node가 `package.json`의 `engines.node`와 다르면 경고가 날 수 있다. 경고와 실패를 구분해서 보고한다.

웹 UI 또는 브라우저 동작 변경 후 추가 게이트:

```bash
pnpm build
pnpm prompt-memory server -- --data-dir <temp-data-dir>
```

그 다음 Playwright MCP로 실제 브라우저에서 목록, 상세, 삭제, 반응형 레이아웃, 빈 화면 여부, 콘솔/네트워크 오류를 점검한다.

## 코드 규칙

- 기존 패턴을 우선한다. 새 추상화는 실제 중복이나 복잡도를 줄일 때만 만든다.
- 데이터는 문자열 파싱보다 스키마, 타입, SQLite 쿼리, Markdown/YAML 파서를 우선 사용한다.
- 사용자 프롬프트, 토큰, 원문 비밀정보를 stdout, stderr, 서버 에러, 로그에 노출하지 않는다.
- Hook은 fail-open을 기본으로 하며, Claude Code `UserPromptSubmit` stdout은 컨텍스트로 들어갈 수 있으므로 특별히 조심한다.
- 삭제는 Markdown, DB row, FTS, 관련 이벤트/태그/분석 데이터를 함께 정리해야 한다.
- `rebuild-index`는 Markdown archive를 source of truth로 보고 DB/FTS를 복구해야 한다.

## Node/TypeScript 아키텍처 규칙

- 구조 판단이 필요하면 `docs/ARCHITECTURE.md`를 먼저 읽고 그 경계를 따른다.
- 이 저장소의 모듈화는 Spring 계층을 그대로 복제하지 않는다. `cli`, `server`, `hooks`, `mcp`, `web`은 entrypoint이고, 재사용되는 규칙은 `analysis`, `redaction`, `storage`, `shared` 쪽으로 옮긴다.
- Node 런타임 코드는 ESM과 `module: NodeNext` 기준을 따른다. 타입만 쓰는 import는 `import type`을 사용한다.
- CLI command 파일은 Commander 등록, orchestration, terminal formatting을 담당한다. 점수 계산, redaction, archive 분석 같은 도메인 규칙을 새로 만들지 않는다.
- Fastify route는 HTTP/auth/validation/response shaping에 집중한다. 저장소 접근은 storage port나 명확한 storage 함수로 제한한다.
- `src/web/src/App.tsx`, `src/storage/sqlite.ts`, `src/mcp/score-tool.ts`는 이미 큰 경계 모듈이다. 새 기능은 가능한 한 작은 모델/formatter/helper 파일로 분리하고, 이 파일들을 더 키우는 변경은 이유를 설명한다.
- MCP 변경은 `score-tool-definitions.ts`의 tool/schema, `score-tool-types.ts`의 argument/result contract, `score-tool.ts`의 handler/result shaping, `server.ts`의 JSON-RPC routing 경계를 유지한다.
- 새 public runtime entrypoint를 만들면 `package.json` `files`, packaging tests, README/PLUGINS 문서까지 같이 갱신한다.

## UI와 디자인

- UI 작업 전 반드시 `DESIGN.md`를 읽는다.
- 이 제품은 운영형 developer tool이다. 마케팅 랜딩 페이지보다 실제 목록, 검색, 상세, 설정, 상태 진단 화면을 우선한다.
- 화면은 조용하고 밀도 있게 설계한다. 큰 hero, 장식용 그라데이션, 중첩 카드, 과도한 둥근 모서리를 피한다.
- 구현 후 Playwright MCP 스크린샷과 접근성 snapshot으로 실제 렌더링을 확인한다.

## Git 규칙

- 사용자가 만들었을 수 있는 변경은 되돌리지 않는다.
- 커밋 메시지는 Conventional Commits를 따른다. 예: `feat: add prompt list UI`, `docs: add agent instructions`.
- `main`은 보호 브랜치다. 변경은 새 브랜치에서 커밋하고 PR로 올린다.
- solo-maintainer 단계에서는 PR이 CI `test (22)`, `test (24)`를 통과하고 unresolved conversation이 없으면 머지할 수 있다.
- 외부 collaborator/reviewer가 참여하는 시점에는 승인 리뷰 1개를 다시 필수로 설정한다.
- 커밋 후 `main`에 직접 push하지 말고 현재 작업 브랜치를 push한다.
- 최종 보고에는 커밋 해시, 푸시 여부, 검증 명령 결과, 남은 리스크를 짧게 포함한다.
