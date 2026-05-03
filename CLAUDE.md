# CLAUDE.md

이 저장소에서 Claude Code는 한국어로 답하고, 아래 규칙을 프로젝트 기본 운영 방식으로 따른다.

## 프로젝트

- 목적: Claude Code, Codex 같은 AI 코딩 도구에 입력한 프롬프트를 로컬에 안전하게 기록하고, 다시 찾고, 분석하고, 다음 요청을 더 잘 쓰도록 돕는 developer tool.
- 포지셔닝: AI coding prompt memory and improvement workspace, local-first.
- 핵심 사용자: Claude Code, Codex 등 AI 도구를 많이 쓰는 개발자.
- 핵심 가치: 로컬 저장, 명확한 동의, 비밀정보 보호, 사람이 읽을 수 있는 Markdown archive, 검증 가능한 동작, 프롬프트 코칭, 좋지 않은 요청 패턴의 회고와 개선.
- 주요 문서: `docs/PRD.md`, `docs/TECH_SPEC.md`, `docs/IMPLEMENTATION_PLAN.md`, `DESIGN.md`, `AGENTS.md`.

## 기본 워크플로

- 사소하지 않은 작업은 먼저 계획한다. 3단계 이상이거나 구조 판단이 있으면 `tasks/todo.md`에 체크리스트를 작성한다.
- 구현 중 이상한 방향으로 흘러가면 멈추고 다시 계획한다.
- TDD를 기본값으로 둔다. 실패 테스트, 구현, 전체 검증 순서로 진행한다.
- 사용자가 정정한 내용은 `tasks/lessons.md`에 재발 방지 규칙으로 남긴다.
- 작업 단위가 끝나면 커밋하고 현재 작업 브랜치에 푸시한 뒤 PR을 열거나 갱신한다. 한 번에 몰아서 커밋하지 않는다.

## 서브에이전트 사용

- 복잡한 조사, 코드베이스 탐색, 보안/디자인/테스트 관점 검토는 서브에이전트에 분리한다.
- 한 서브에이전트에는 한 가지 관점만 맡긴다.
- 메인 작업자는 결과를 맹목적으로 붙이지 말고, 현재 설계와 테스트에 맞는지 통합 검토한다.

## 검증

기능 변경 후 기본 검증:

```bash
pnpm test
pnpm lint
pnpm build
pnpm pack:dry-run
git diff --check
```

웹 UI 또는 서버 동작 변경 후에는 실제 서버를 띄우고 Playwright MCP로 확인한다.

- 주요 화면이 비어 있지 않은지 본다.
- 목록, 검색, 상세, 삭제 같은 핵심 플로우를 직접 누른다.
- desktop/mobile viewport에서 레이아웃 깨짐, 텍스트 겹침, 접근성 snapshot 문제를 확인한다.
- 결과를 최종 보고에 남긴다.

## 설계 원칙

- 단순함 우선: 변경 범위를 작게 유지한다.
- 임시방편 금지: 원인을 찾고 테스트로 고정한다.
- 보안 기본값: 프롬프트 원문, 토큰, 비밀정보를 로그나 에러에 노출하지 않는다.
- Markdown archive는 사람이 읽을 수 있는 원본이며, `rebuild-index`는 이를 기준으로 DB/FTS를 복구한다.
- Claude Code hook은 fail-open을 유지한다. 특히 `UserPromptSubmit`의 stdout은 Claude 컨텍스트가 될 수 있으므로 원문 프롬프트를 쓰지 않는다.
- Agent judge 기능은 현재 사용자가 제어하는 Claude Code/Codex/Gemini CLI 세션이 MCP로 redacted packet을 받아 평가하는 opt-in 흐름만 허용한다. `prompt-memory`는 provider 인증정보를 추출, 저장, proxy하거나 숨은 외부 LLM 호출을 하지 않는다.

## Node/TypeScript 모듈화

- 구조 판단 전 `docs/ARCHITECTURE.md`를 읽는다.
- Spring식 Controller/Service/Repository를 그대로 옮기지 않는다. 이 프로젝트에서는 `cli`, `server`, `hooks`, `mcp`, `web`이 entrypoint이고, 재사용 가능한 규칙은 `analysis`, `redaction`, `storage`, `shared`로 분리한다.
- Node 런타임 코드는 ESM, `module: NodeNext`, 명시적 `.js` import specifier, `import type`을 기본으로 한다.
- CLI command는 명령 등록과 출력 formatting에 집중한다. 도메인 규칙이 커지면 별도 pure module로 뺀다.
- Fastify route는 HTTP boundary이고, SQLite 구현 세부사항을 route 안에 새로 만들지 않는다.
- 큰 파일인 `src/web/src/App.tsx`, `src/storage/sqlite.ts`, `src/mcp/score-tool.ts`에 새 기능을 추가하기 전에 작은 모델/formatter/helper로 분리할 수 있는지 먼저 판단한다.
- SQLite 변경은 query/transaction, row contract, defensive JSON decoding을 한 파일에 섞지 않는다.
- MCP 변경은 tool/schema definition, TypeScript contract, handler orchestration, JSON-RPC routing을 한 파일에 섞지 않는다.
- 새 runtime/public 표면을 추가하면 테스트, 문서, package contents 검증을 함께 갱신한다.

## UI 원칙

- UI 작업 전 `DESIGN.md`를 읽는다.
- 이 앱은 developer tool이다. 조용하고 밀도 높은 작업 화면을 우선한다.
- 실제 제품 화면을 첫 화면으로 만든다. 불필요한 랜딩/hero를 만들지 않는다.
- 장식보다 정보 구조, 검색, 필터, 상태 진단, 삭제 확인, 빈 상태를 우선한다.

## Git

- 사용자의 변경을 되돌리지 않는다.
- Conventional Commits를 사용한다.
- `main`은 보호 브랜치다. 새 브랜치에서 작업하고 PR을 통해서만 머지한다.
- solo-maintainer 단계에서는 PR이 CI `test (22)`, `test (24)`를 통과하고 unresolved conversation이 없으면 머지할 수 있다.
- 외부 collaborator/reviewer가 참여하는 시점에는 승인 리뷰 1개를 다시 필수로 설정한다.
- 커밋 후 `main`에 직접 push하지 말고 현재 작업 브랜치를 push한다.
- 최종 응답에는 커밋 해시, 푸시 여부, 검증 결과를 포함한다.
