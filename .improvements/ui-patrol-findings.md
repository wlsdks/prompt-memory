# UI Patrol Findings

Playwright 기반 자동 UI 순회에서 발견한 개선점을 누적 기록합니다. 한 항목당
한 가지 이슈만 다루고, 같은 이슈를 두 번 fix하지 않도록 새로운 patrol 실행은
반드시 이 파일을 먼저 읽습니다.

---

## 기록

### [2026-05-08 20:34] /  — patrol skipped (Playwright in use by parallel usability audit)
- **Status**: skipped
- **Category**: —
- **Page**: —
- **Viewport**: —
- **Problem**: 사용자가 시작한 사용성 audit subagent가 Playwright MCP를 단독 점유 중. 같은 브라우저에 두 개 세션이 동시 접근하면 race가 생기므로 patrol 보류.
- **Fix**: —
- **Files**: —
- **Reference**: cron 안전 규칙 — 충돌이 의심되면 fight 하지 말고 다음 사이클로 미룬다.
