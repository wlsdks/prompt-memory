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
