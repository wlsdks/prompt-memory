# Lessons

이 파일은 사용자의 정정, 반복 실수, 프로젝트 고유 판단을 기록한다. 새 작업을 시작할 때 관련 항목을 먼저 확인한다.

## 2026-05-01

- 작업은 한 번에 몰아 커밋하지 말고 논리 단위마다 커밋하고 즉시 푸시한다.
- TDD를 기본으로 진행한다. 실패 테스트를 먼저 만들고 구현 후 전체 게이트를 실행한다.
- 웹 UI 작업은 실제 서버를 띄운 뒤 Playwright MCP로 브라우저 점검까지 완료해야 한다.
- 디자인 시스템은 별도 `DESIGN.md`를 기준으로 유지한다. UI 구현 중 임의 스타일을 늘리지 않는다.
- 프로젝트 운영 문서는 한국어로 작성한다.

## 2026-05-02

- Dashboard처럼 제품 인상이 크게 달라지는 UI는 `/Users/jinan/ai/awesome-design-md`의 실제 reference를 먼저 확인하고, `DESIGN.md`에 적용 기준을 남긴 뒤 구현한다.
- `prompt-memory` 대시보드 UI는 `/Users/jinan/side-project/oh-my-ontology`의 dark indigo 운영형 디자인 시스템을 1차 기준으로 삼고, AI-looking gradient/glass/neon 스타일을 피한다.
