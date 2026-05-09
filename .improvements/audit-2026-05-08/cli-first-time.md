# CLI First-Time Setup Audit (2026-05-08)

검증 환경: 임시 data dir `/tmp/pm-audit-cli-$$/data`. 사용자 production data, port 17373, plist 미접촉. 검증 시작 시 `dist/`가 PR #237/#238 머지 전 빌드(20:18) 상태였기에 `pnpm build` 후 재검증함.

## README onboarding

- 한국어/영문 첫 화면 quickstart는 거의 1:1 미러. 핵심 흐름 `setup → 한 프롬프트 → coach`가 양쪽 다 명확.
- 갭 1: 영문 README는 "Quick Start > 1.Install / 2.Marketplace / 3.Codex / 4.Check"에 `prompt-coach coach`가 들어있는데, 한국어 "4. Capture 확인"에는 `coach`가 빠져있음 (line 146-151). 한국어 사용자는 첫 성공 명령을 한 단계 늦게 발견.
- 갭 2: README가 "publish된 npm 명령" 기준이지만 실제 publish 안 됨. 한국어 라인 95-96은 명시하나 영문은 더 흐릿함. 새 사용자는 `npm install -g prompt-coach`를 시도하다 좌절할 수 있음.
- 갭 3: `prompt-coach start`(인자 없음)가 사실상 가장 좋은 onboarding 명령(번호 step 출력)인데 README quickstart에는 `setup`이 먼저 나옴. `start` → 학습 → `setup`이 더 부드러울 수 있음.

## init/setup 흐름 friction

| 심각도 | 명령 | 출력 문제 | 사용자가 막힐 지점 |
|---|---|---|---|
| 낮음 | `init --data-dir <tmp>` | `Initialized prompt-coach at <path>` 한 줄. 다음 step 안내 없음. token/secret 노출 없음(OK). | "그래서 다음에 뭘 하지?" - `setup`이나 `doctor` 추천 필요 |
| 중 | `install-hook claude-code --dry-run` | JSON-only 출력 (`{ changed, dry_run, settings_path }`). plain text fallback 없음. | service install --dry-run은 plain text("dry-run: would write...")인데 install-hook은 JSON. 일관성 깨짐 |
| 중 | `prompt-coach start`(no args) | 마지막 troubleshooting step에 사용자의 absolute node path와 dist/cli/index.js 경로가 stdout 노출 | privacy 가이드는 raw path 노출 금지. README 버전(`-- prompt-coach mcp`)과도 불일치 |
| 낮음 | `doctor claude-code` | "Status: ready" 깔끔. Next 섹션이 capability 설명만 — 사용자가 정상 ready인 경우 다음 행동(`prompt-coach coach`) 안내 없음 |

## 이번 PR 검증 결과

PR #237 (UserError, no stack trace):

- `start --tool madeup` → ✓ `Error: Unsupported tool: madeup. Use claude-code or codex.` 한 줄 + exit 1, 스택 없음
- `show no_such_id --data-dir <tmp>` → ✓ `Error: Prompt not found: no_such_id. Try: prompt-coach list` 한 줄
- `setup --profile bogus --data-dir <tmp> --dry-run` → ✓ `Error: Unsupported setup profile: bogus. Valid profiles: capture, coach.`
- `install-hook bogus --dry-run` → ✓ `Error: Unsupported hook target: bogus. Use claude-code or codex.`
- `pc-claude --pc-mode bogus` → ✓ `Error: Unsupported --pc-mode: bogus. Use ask, auto, or off.`
- 모든 케이스 ELIFECYCLE 라인은 pnpm의 자체 출력(노이즈는 아님). 다섯 케이스 모두 통과.

PR #238 (service plain text + launchctl 매핑):

- `service install --dry-run --plist-path <tmp>` → ✓ plain text `dry-run: would write LaunchAgent to <path>`
- `service install --dry-run --plist-path <tmp> --json` → ✓ JSON 출력 정상 (`supported, changed, dry_run, plist_path, started`)
- `service install --plist-path <tmp> --dry-run --no-start --json` → ✓ 동일한 JSON, started=false
- `service status` → ✓ plain text `service running`
- `service status --json` → ✓ `{ ok: true, supported: true }`
- launchctl 실제 호출은 사용자 production service 보호를 위해 미시도(친절 매핑 텍스트는 코드 검토 영역).

옵션 누락 발견: `service status`는 `--plist-path` 미지원. `service start/stop`은 `--dry-run` 미지원 → 안전하게 dry-run 검증할 방법이 없음. install만 dry-run 가능.

## 한국어 사용자 입장 갭

- 모든 UserError 메시지는 영어. `Error: Unsupported tool: madeup. Use claude-code or codex.` 같은 메시지를 한국어 사용자가 받으면 의미는 통하지만 위화감 있음.
- `start`(no args), `doctor`, `install-hook` 출력 전체가 영어. README는 한국어 쌍둥이 있지만 CLI는 단일 언어.
- pnpm의 `WARN Unsupported engine` (Node 20 환경) 경고가 모든 명령 위에 한 번씩 따라붙음 — 첫 사용자가 "에러인가?" 헷갈릴 수 있으나 PR 범위 밖.
- 한국어 README 라인 145-151의 capture 확인 단계에서 `coach`가 빠진 점이 가장 실질적 갭.

## 종합

Top 3 fix 후보:

1. `prompt-coach start`(인자 없음)의 troubleshooting 출력에서 사용자 absolute path 제거 — 짧은 `prompt-coach mcp` 형태 권장 또는 path를 별도 `--show-paths` flag 뒤로. privacy 가이드(raw absolute paths 금지)와도 직접 충돌.
2. `install-hook --dry-run`을 plain text 우선 + `--json` opt-in으로 통일. service install이 이미 그 패턴이므로 일관성 회복.
3. UserError 메시지 한국어/영어 i18n 또는 적어도 자주 쓰는 invalid-input 5개(start --tool, setup --profile, install-hook target, show id, pc-claude --pc-mode)에 한국어 보조 줄 추가. README가 한국어 first-class니까 CLI도 따라가는 게 자연스러움.

README 보강 후보:

- 한국어 README "4. Capture 확인"에 `prompt-coach coach`를 영문 README와 동일하게 추가.
- Quick Start 상단에 "publish 전이라 `pnpm prompt-coach ...`로 사용" 박스를 양쪽 README 모두 더 눈에 띄게.
- `prompt-coach init` 출력에 "다음: `prompt-coach setup --profile coach --register-mcp` 또는 `prompt-coach start`" 한 줄 추가 — onboarding 첫 분기점.
