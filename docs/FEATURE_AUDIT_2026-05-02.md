# Full Feature Audit

작성일: 2026-05-02

## 결론

현재 구현은 PRD2 기준의 핵심 기능을 모두 제공한다. 로컬 검증 기준에서는 public beta release candidate로 볼 수 있다.

이 제품의 현재 정체성은 다음 문장으로 정리된다.

> AI coding prompt memory and improvement workspace, local-first.

한국어로는 Claude Code, Codex 같은 AI 코딩 도구에 입력한 prompt를 로컬에서 기억하고, 다시 찾고, 안 좋은 요청 패턴을 분석하고, 다음 요청을 더 낫게 고쳐 쓰도록 돕는 developer tool이다.

## 이번 점검에서 통과한 게이트

| 게이트 | 결과 | 확인 내용 |
| --- | --- | --- |
| CLI help surface | 통과 | 주요 명령과 하위 명령 help가 build 산출물에서 실행됨 |
| `pnpm test` | 통과 | 31개 test file, 140개 test 통과 |
| `pnpm benchmark -- --json` | 통과 | privacy, retrieval, coach, analytics, latency 기준 통과 |
| `pnpm e2e:browser` | 통과 | archive, detail, coach, projects, export, mobile overflow 자동 브라우저 점검 |
| `pnpm smoke:release` | 통과 | isolated temp 환경에서 build CLI/server/storage/web/rebuild/delete/import/export smoke 통과 |

Benchmark v1 점수:

| 지표 | 결과 |
| --- | ---: |
| `privacy_leak_count` | 0 |
| `retrieval_top3` | 1 |
| `coach_gap_fix_rate` | 1 |
| `analytics_score` | 1 |
| `ingest_p95_ms` | 11 |
| `search_p95_ms` | 2 |
| `dashboard_ms` | 9 |
| `export_ms` | 14 |

## 제공 기능 목록

### 1. 설치와 연결

제공:

- `prompt-memory setup`
- `prompt-memory init`
- `prompt-memory doctor`
- `prompt-memory hook`
- `prompt-memory install-hook`
- `prompt-memory uninstall-hook`
- `prompt-memory statusline`
- `prompt-memory install-statusline`
- `prompt-memory uninstall-statusline`
- `prompt-memory service`
- Claude Code hook 연결
- Codex beta hook 연결
- fail-open hook wrapper

저장 방식:

- 설정과 hook은 로컬 파일에만 기록한다.
- hook stdout/stderr에 prompt 원문을 노출하지 않는다.

판정:

- public beta에 필요한 로컬 설치와 연결 흐름은 완료다.

### 2. Prompt 수집과 저장

제공:

- Claude Code/Codex에서 들어오는 prompt ingest API
- bearer token 기반 ingest 인증
- redaction 적용 후 저장
- Markdown archive 저장
- SQLite index 저장
- SQLite FTS 검색 인덱스 저장
- 삭제 시 Markdown, DB row, FTS, 이벤트, draft 정리
- `prompt-memory rebuild-index`

저장 방식:

- Markdown이 사람이 읽을 수 있는 source of truth다.
- SQLite는 검색과 집계를 위한 index다.

판정:

- MVP 핵심 저장 구조는 완료다.

### 3. 다시 찾기와 archive 탐색

제공:

- `prompt-memory list`
- `prompt-memory search`
- `prompt-memory show`
- `prompt-memory open`
- 웹 UI archive list
- 웹 UI detail view
- tool, project, tag, quality gap, imported-only 필터
- bookmark와 prompt event 기록
- local quality dashboard

저장 방식:

- 검색은 SQLite/FTS 기반이다.
- 웹 API는 raw absolute path 대신 project label 또는 masked path를 기본 표시한다.

판정:

- "예전에 잘 썼던 prompt를 다시 찾기 쉽다"는 PRD2 수준으로 구현되어 있다.

### 4. Prompt Coach와 개선 draft

제공:

- `prompt-memory improve`
- 로컬 rule-based prompt 개선안 생성
- 웹 detail에서 분석 preview와 개선안 표시
- 개선안 copy
- 개선안 save draft
- 저장 draft 조회
- prompt 삭제 시 draft 삭제

저장 방식:

- 개선 draft는 원문 prompt를 덮어쓰지 않는다.
- 저장 전 redaction을 다시 적용한다.
- 외부 LLM API를 호출하지 않는다.

판정:

- "다음에 더 좋은 요청을 쓰도록 바로 도와준다"는 기본 흐름이 구현되어 있다.
- 다만 품질 평가는 rule-based baseline이므로 실제 사용자 피드백 기반 개선은 beta 이후 과제다.

### 5. 나쁜 prompt 습관 분석

제공:

- prompt quality gap 분석
- dashboard 통계
- sensitive prompt count
- project distribution
- duplicate/reuse/saved/event 기반 지표
- AGENTS.md/CLAUDE.md 후보 suggestion
- Benchmark v1 analytics regression

저장 방식:

- 분석 결과는 로컬 SQLite에 저장한다.
- 외부 분석 route/client는 없다.

판정:

- "내 prompt 습관의 약점이 보인다"는 MVP 수준으로 완료다.

### 6. Project Control Plane

제공:

- project 목록 API와 웹 UI
- project policy 수정 API와 웹 UI
- `capture_disabled`
- `export_disabled`
- `analysis_disabled` 표시/저장
- `retention_candidate_days` 표시/저장
- `external_analysis_opt_in` 표시/저장
- policy audit event

저장 방식:

- policy와 audit event는 SQLite에 저장한다.
- browser surface에는 raw project path 대신 label 중심으로 표시한다.

판정:

- project별 capture/export 제어는 실제 실행 경로에 연결되어 있다.
- analysis/retention/external policy는 미래 기능을 위한 저장/표시 필드이며, 현재 실행 기능은 없다.

### 7. Transcript Import

제공:

- `prompt-memory import --dry-run`
- `prompt-memory import --save-job`
- `prompt-memory import --execute`
- `prompt-memory import --resume`
- `prompt-memory import-job`
- malformed line tolerance
- assistant/tool/unsupported role skip
- large line skip
- idempotency key
- import_records 저장
- imported-only list/search/API filter
- capture-disabled project import skip

저장 방식:

- 실행 import는 redaction 후 Markdown/SQLite/FTS에 저장한다.
- import job/record 출력에는 raw prompt, raw source path, raw secret을 저장하지 않는다.

판정:

- CLI 중심 import는 완료다.
- Web import UI/API는 아직 없다.

### 8. Anonymized Export

제공:

- `prompt-memory export --anonymized --preview`
- `prompt-memory export --anonymized --job`
- 웹 export preview
- 웹 export execution
- included/excluded fields 표시
- sensitive count
- residual identifier count
- small-set warning
- preview job invalidation
- JSON copy/download UI

저장 방식:

- export job snapshot에는 raw prompt id, raw cwd, raw path, raw secret을 저장하지 않는다.
- export payload는 anonymized id, masked prompt, tag, quality gap, coarse date, project alias 중심이다.

판정:

- public-safe anonymized export는 완료다.
- raw export는 의도적으로 제공하지 않는다.

### 9. Web UI

제공:

- Archive list
- Prompt detail
- Prompt Coach panel
- Project policy screen
- Export screen
- Dashboard/quality view
- Delete confirmation
- Copy/download interactions
- Desktop/mobile layout

검증:

- 자동 browser E2E가 archive -> detail -> coach copy/save -> projects -> export -> mobile overflow를 확인한다.

판정:

- public beta용 핵심 UI는 동작한다.

### 10. Privacy와 local-first 보안

제공:

- local-only 기본 동작
- prompt/secret redaction
- browser/export raw path masking
- ingest bearer auth
- browser state-changing API CSRF
- fail-open hook
- privacy regression fixture
- raw-free anonymized export
- external LLM analysis 미구현

주의:

- redaction은 best-effort다.
- Settings API의 `data_dir`, `excluded_project_roots`는 local diagnostics 용도로 raw local path를 포함할 수 있다.

판정:

- public beta에서 주장할 수 있는 범위는 "local-first, best-effort redaction, anonymized export"다.

### 11. Benchmark와 릴리즈 검증

제공:

- `pnpm benchmark`
- `pnpm benchmark -- --json`
- `pnpm e2e:browser`
- `pnpm smoke:release`
- `pnpm pack:dry-run`
- release checklist

측정 대상:

- privacy leak count
- search retrieval top-k
- coach gap fix rate
- analytics usefulness
- ingest/search/dashboard/export latency

판정:

- 기능이 동작하는지만 보는 수준을 넘어서 제품 핵심 가치 회귀를 숫자로 볼 수 있다.

## 명시적으로 없는 기능

- Claude Code/Codex prompt를 자동으로 가로채서 바꾸고 재입력하는 기능
- auto-approve permission으로 개선 prompt를 자동 제출하는 기능
- 외부 LLM/API 기반 prompt 평가
- GitHub 연동
- Web import upload UI
- raw export
- semantic embedding search
- 실제 사용자 archive 기반 opt-in benchmark
- macOS/Windows/Linux arm64 전체 release smoke matrix

## 남은 리스크

- Benchmark v1은 synthetic fixture 기반이라 실제 사용자가 느끼는 유용성을 완전히 대변하지 않는다.
- Prompt Coach는 rule-based라 복잡한 코딩 요청 품질 개선에는 한계가 있다.
- Settings/local diagnostics에는 로컬 사용자에게 필요한 raw path가 일부 표시될 수 있다.
- `better-sqlite3`은 플랫폼별 native install 변수가 있어 stable release 전 cross-platform smoke가 필요하다.
- Codex hook surface는 beta adapter로 문서화해야 한다.

## 다음 우선순위

1. release note 작성
2. public beta 태그/배포 여부 결정
3. GitHub Actions에서 Node 22/24 release gate 고정
4. macOS/Windows/Linux arm64 smoke 확장
5. beta 사용자 피드백 기반 Prompt Coach 품질 평가 설계

