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

## 2026-05-04

- 자동 개선 루프에서는 PR을 만들고 미루지 말고, 로컬 게이트가 통과되면 바로 main에 squash merge하고 로컬 branch까지 정리한다. PR 누적은 사용자에게 머지 결정 부담을 주고, base 변경으로 다른 PR이 outdated가 되어 update-branch 비용이 늘어난다.
- 한국어 사용자 가시 surface(analyzer/improve/archive/MCP/hook/web 첫 진입)는 trio가 아니라 5단계 chain으로 wiring한다. detection을 한 layer만 추가하고 wiring을 빠뜨리면 사용자 가시 결과는 안 변한다.
- redaction detector를 추가할 때는 단위 테스트뿐 아니라 cross-surface privacy regression fixture와 PRE_PUBLISH_PRIVACY_AUDIT의 grep pattern까지 같이 갱신한다. 셋이 어긋나면 publish 직전 grep이 leak를 못 잡는다.
- 사용자 가시 에러 메시지(CLI, MCP, web API, hook)는 단순 label로 끝내지 말고 working example 또는 다음 명령을 한 줄 안내한다. 사용자가 README를 다시 열지 않게 한다.
- privacy 회귀가 의심되는 server route 변경은 web UI/CLI/hook/MCP 4개 surface에서 모두 raw path/secret 미노출 검증한다.
