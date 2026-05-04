# Screenshots

이 디렉토리는 README와 docs에 임베드되는 스크린샷을 보관합니다.

## 캡처 방법 (수동)

1. 깨끗한 임시 데이터 디렉토리로 서버 시작:

   ```sh
   pnpm build
   PROMPT_MEMORY_DATA_DIR="$(mktemp -d)" pnpm prompt-memory init --data-dir "$PROMPT_MEMORY_DATA_DIR"
   pnpm prompt-memory server --data-dir "$PROMPT_MEMORY_DATA_DIR"
   ```

2. 다른 터미널에서 fixture prompt 몇 개를 ingest (real prompt로 sensitive
   값을 노출하지 마세요. `scripts/browser-e2e.mjs`의 fixture 패턴을
   참고하면 됩니다 — `Fix /path/with/[REDACTED:path]` 같은 redaction 결과가
   그대로 보이는 prompt가 좋습니다).

3. 브라우저로 `http://127.0.0.1:17373`에 접속해서 다음 세 화면을 캡처:

   | 파일명 | 화면 | viewport |
   | --- | --- | --- |
   | `archive.png` | "Prompt archive" 첫 화면 (filter bar + 한 row 보일 정도) | 1280×900 |
   | `coach.png` | 한 prompt detail 안에서 "Improvement draft for manual resubmission" 패널까지 보이게 | 1280×900 |
   | `practice.png` | "Practice workspace" 화면 (one-click builder + score preview) | 1280×900 |

4. 결과 png를 이 디렉토리에 저장하고 `git add docs/screenshots/*.png`.

## 캡처 시 주의

- **prompt body, 토큰, 절대 경로가 화면에 보이지 않게 합니다.** fixture만
  사용하고, `[REDACTED:...]` 마스크 결과로 충분히 가시화됩니다.
- 다크 테마(default) 그대로 캡처합니다.
- 1× DPI로 저장 (Retina 2× 캡처는 README 임베드 시 너무 큽니다).
- gif/mp4가 아니라 정적 png. README는 첫 인상이고 빠른 로딩이 우선.

## 자동화 후보

`scripts/browser-e2e.mjs`가 이미 fixture 주입과 페이지 네비게이션을 합니다.
같은 흐름에 `SCREENSHOT_DIR` 환경 변수를 추가해서 `page.screenshot()`을
호출하는 옵션을 다음 iteration에서 추가할 수 있습니다. 지금은 capture
정확성을 사람이 검수하는 단계라 수동 캡처를 우선합니다.
