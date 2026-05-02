# prompt-memory

[English](README.md) | [한국어](README.ko.md)

AI 코딩 프롬프트를 로컬에서 기억하고, 다시 찾고, 더 나은 요청으로 고쳐 쓰게 돕는 도구입니다.

`prompt-memory`는 Claude Code, Codex 같은 AI 코딩 도구에 입력한 프롬프트를 안전하게 로컬에 기록하고, 나중에 다시 찾고, 반복되는 약한 프롬프트 패턴을 분석하고, 다음 요청을 더 잘 쓰도록 돕는 developer tool입니다.

지원되는 도구의 프롬프트를 로컬에서 수집하고, 민감값을 저장 전에 마스킹하고, 사람이 읽을 수 있는 Markdown을 원본으로 남기며, SQLite/FTS 인덱스와 로컬 웹 UI를 통해 검색, 상세 보기, 누적 점수 측정, 프롬프트 연습, 분석, 삭제, 승인형 Prompt Coach 개선안을 제공합니다.

이 프로젝트는 Anthropic, OpenAI 또는 다른 AI 도구 제공사와 제휴, 보증, 후원 관계가 없습니다. Claude Code, Codex 같은 제품명은 호환성을 설명하기 위해서만 사용합니다.

## 상태

이 저장소는 pre-release 소프트웨어입니다.

- Claude Code 지원: MVP 경로
- Codex 지원: beta adapter
- 로컬 rule-based 분석 preview: 구현됨
- Prompt Quality Score: 로컬 deterministic `0-100` rubric으로 구현됨
- MCP prompt scoring tools: 로컬 stdio server로 구현됨
- 승인형 Prompt Coach: 구현됨
- Prompt Practice 작업면: 초안 본문을 저장하지 않는 로컬 작성/점수
  history UI로 구현됨
- Transcript import: CLI 중심
- 익명화 export: 웹 UI와 CLI preview/job 흐름
- Benchmark v1: 로컬 회귀 baseline
- English/Korean 웹 UI: 구현됨
- 외부 LLM 분석: 미구현
- 기본 데이터 처리: 로컬 전용

## 요구사항

- Node.js `>=22 <25`
- pnpm `10.x`
- `better-sqlite3`가 지원하는 플랫폼

CI 대상은 Node 22와 Node 24입니다.

## 빠른 시작

구성은 두 부분입니다.

1. `prompt-memory` CLI: 로컬 서버, hook, 저장소, 웹 UI를 담당합니다.
2. Claude Code 또는 Codex marketplace plugin: setup/status/open 흐름을 쉽게 실행하게 돕습니다.

marketplace plugin은 CLI binary를 자동 설치하지 않습니다. 먼저 CLI를 설치한 뒤 marketplace를 추가하세요.

### 1. CLI 설치

패키지 publish 이후:

```sh
npm install -g prompt-memory
```

이 저장소에서 로컬 개발로 실행:

```sh
git clone https://github.com/wlsdks/prompt-memory.git
cd prompt-memory
pnpm install
pnpm build
```

### 2. Claude Code Marketplace 추가

Claude Code 안에서:

```text
/plugin marketplace add wlsdks/prompt-memory
/plugin install prompt-memory
/reload-plugins
/prompt-memory:setup
```

`/prompt-memory:setup`은 CLI 사용 가능 여부를 확인하고, `prompt-memory setup --dry-run`을 먼저 실행한 뒤, 설정 파일을 쓰기 전에 사용자의 승인을 받습니다.

### 3. Codex Marketplace 추가

쉘에서:

```sh
codex plugin marketplace add wlsdks/prompt-memory
```

그 다음 로컬 setup을 실행합니다.

```sh
prompt-memory setup
```

Codex는 marketplace 관리를 `codex plugin marketplace add/upgrade/remove`로 제공합니다. 프롬프트 capture hook은 `prompt-memory setup`이 Codex hook config를 쓰고 Codex hooks를 활성화하면서 설치합니다.

### 4. Capture 확인

```sh
prompt-memory doctor claude-code
prompt-memory doctor codex
prompt-memory statusline claude-code
```

로컬 archive 열기:

```text
http://127.0.0.1:17373
```

## 지원 플랫폼

현재 release validation 대상:

- GitHub Actions의 Linux x64
- Node.js 22와 24

macOS, Linux arm64, Windows 지원을 목표로 하지만 stable release로 주장하려면 `better-sqlite3`, 파일 권한, hook command 동작에 대한 release smoke 검증이 더 필요합니다.

## 설치와 setup

agent marketplace 흐름 없이 로컬 개발로 설치:

```sh
pnpm install
pnpm build
pnpm prompt-memory setup
```

`setup`은 의도적으로 명시적입니다. npm/pnpm package 설치만으로 Claude Code 또는 Codex 설정을 조용히 수정하거나, login service를 설치하거나, 로컬 background server를 시작하지 않습니다. `prompt-memory setup`이 사용자의 동의 단계입니다.

dry-run으로 변경 사항만 preview:

```sh
pnpm prompt-memory setup --dry-run
```

background service를 원하지 않으면:

```sh
pnpm prompt-memory setup --no-service
pnpm prompt-memory server
```

웹 UI:

```text
http://127.0.0.1:17373
```

기본 데이터 위치:

```text
~/.prompt-memory
```

다른 위치를 쓰려면:

```sh
pnpm prompt-memory init --data-dir /path/to/prompt-memory-data
```

## Claude Code 연결

Claude Code hook 설치:

```sh
pnpm prompt-memory install-hook claude-code
```

설정 변경 preview:

```sh
pnpm prompt-memory install-hook claude-code --dry-run
```

진단:

```sh
pnpm prompt-memory doctor claude-code
```

hook 제거:

```sh
pnpm prompt-memory uninstall-hook claude-code
```

installer는 Claude Code settings 파일에 prompt-memory command를 쓰고, 기존 파일이 있으면 backup을 만듭니다. hook command에는 ingest token이 포함되지 않습니다.

## Codex Beta 연결

Codex hook 지원은 beta입니다.

Codex hook 설치:

```sh
pnpm prompt-memory install-hook codex
```

`hooks.json`과 `config.toml` 변경 preview:

```sh
pnpm prompt-memory install-hook codex --dry-run
```

진단:

```sh
pnpm prompt-memory doctor codex
```

hook 제거:

```sh
pnpm prompt-memory uninstall-hook codex
```

Codex installer는 기본적으로 사용자 레벨 config를 대상으로 합니다.

```text
~/.codex/hooks.json
~/.codex/config.toml
```

다음 feature flag를 활성화합니다.

```toml
[features]
codex_hooks = true
```

uninstall은 prompt-memory hook entry를 제거하지만 Codex feature flag는 그대로 둡니다.

## Plugin Packaging

이 저장소는 plugin packaging artifact도 함께 제공합니다.

```text
.claude-plugin
commands
plugins/prompt-memory
integrations/claude-code
docs/PLUGINS.md
```

권장 순서:

1. `prompt-memory` CLI 설치
2. agent marketplace 추가
3. `prompt-memory setup` 또는 `/prompt-memory:setup` 실행

Claude Code plugin slash commands:

```text
/prompt-memory:setup
/prompt-memory:status
/prompt-memory:score
/prompt-memory:open
```

`/prompt-memory:setup`은 먼저 dry-run을 실행하고, 로컬 설정을 쓰기 전에 승인받습니다. Claude Code status line은 다음 명령으로 설치할 수 있습니다.

```sh
pnpm prompt-memory install-statusline claude-code
```

Codex package는 `.codex-plugin` manifest, fail-open `UserPromptSubmit` hook, 로컬 archive를 설치/진단/사용하도록 돕는 skill을 포함합니다.

## CLI

프롬프트 목록:

```sh
pnpm prompt-memory list
```

검색:

```sh
pnpm prompt-memory search "migration plan"
```

프롬프트 Markdown 보기:

```sh
pnpm prompt-memory show <prompt-id>
```

삭제:

```sh
pnpm prompt-memory delete <prompt-id>
```

로컬 웹 UI에서 열기:

```sh
pnpm prompt-memory open <prompt-id>
```

Markdown archive에서 SQLite/FTS 재구축:

```sh
pnpm prompt-memory rebuild-index
```

JSONL transcript import preview/실행:

```sh
pnpm prompt-memory import --dry-run --file ./transcript.jsonl --save-job
pnpm prompt-memory import --execute --file ./transcript.jsonl
pnpm prompt-memory import-job <job-id>
```

import는 현재 CLI 중심입니다. 웹 UI에서는 imported prompt를 일반 archive와 imported-only filter로 볼 수 있지만, 웹 업로드 화면은 없습니다.

익명화 export preview/실행:

```sh
pnpm prompt-memory export --anonymized --preview --preset anonymized_review --json
pnpm prompt-memory export --anonymized --job <export-job-id> --json
```

웹 UI는 익명화 export만 제공합니다. Raw export는 구현되어 있지 않습니다.

승인형 Prompt Coach 개선안 생성:

```sh
pnpm prompt-memory improve --text "make this request clearer" --json
```

누적 prompt 습관 점수 측정:

```sh
pnpm prompt-memory score --json
pnpm prompt-memory score --tool codex --json
```

## 로컬 분석 Preview

프롬프트 상세 화면은 로컬 rule-based analysis preview를 제공합니다. 목표, 배경 맥락, 범위 제한, 출력 형식, 검증 기준이 포함되어 있는지 요약합니다. 각 프롬프트에는 checklist breakdown 기반의 deterministic `0-100` Prompt Quality Score도 표시됩니다.

이 preview는 저장된 redacted prompt body를 로컬에서만 분석합니다. 외부 LLM provider를 호출하지 않습니다.

## 프로젝트 규칙 파일 리뷰

Projects 화면에서 프로젝트별 `AGENTS.md`와 `CLAUDE.md`를 분석할 수
있습니다. 리뷰 결과는 파일명, 해시, 수정 시각, checklist 상태, 점수,
개선 힌트를 로컬 snapshot으로 저장합니다.

instruction file 본문, raw absolute path, 외부 LLM 결과는 저장하거나
반환하지 않습니다. 점수는 프로젝트 맥락, 에이전트 작업 방식, 검증 명령,
privacy/safety, 보고 규칙을 보는 deterministic local rubric입니다.

## MCP 프롬프트 점수 측정

`prompt-memory`는 같은 로컬 Prompt Quality Score를 Claude Code, Codex 또는
다른 MCP client가 호출할 수 있도록 stdio MCP server로 노출할 수 있습니다.

```sh
prompt-memory mcp
```

MCP server는 다섯 개의 tool을 제공합니다.

- `get_prompt_memory_status`: 로컬 archive가 초기화되었는지, prompt가 캡처되었는지, 다음에 어떤 MCP tool을 호출하면 좋은지 확인합니다.
- `score_prompt`: 직접 전달한 prompt text, 저장된 `prompt_id`, 또는 최신 저장 prompt를 점수화합니다.
- `improve_prompt`: 직접 전달한 prompt text, 저장된 `prompt_id`, 또는 최신 저장 prompt를 승인 가능한 개선 prompt 초안으로 재작성합니다.
- `score_prompt_archive`: 최근 저장 prompt 전체를 대상으로 누적 prompt 습관을 점수화하고, 평균 점수, 반복 부족 항목, practice plan, 다음 prompt template, 낮은 점수 prompt id를 반환합니다.
- `review_project_instructions`: 최신 또는 선택한 프로젝트의 `AGENTS.md` / `CLAUDE.md` 규칙 파일을 리뷰하고 점수, checklist 상태, 개선 힌트를 반환합니다.

모든 tool은 read-only, idempotent, local-only로 선언되며 구조화 JSON
metadata에 대한 MCP `outputSchema`와 text JSON fallback을 함께 제공합니다.
archive 기반 tool은 저장된 prompt 본문, raw absolute path, secret, 외부 LLM
결과를 반환하지 않습니다.

Agent에게 이렇게 요청할 수 있습니다.

```text
prompt-memory get_prompt_memory_status를 사용해서 점수 측정 전에 prompt capture가 제대로 동작하는지 확인해줘.

prompt-memory score_prompt를 latest=true로 사용해서 방금 내 요청에서 고칠 점을 알려줘.

prompt-memory improve_prompt를 latest=true로 사용해서 내가 복사해 다시 입력할 수 있는 승인용 개선안을 만들어줘.

최근 Codex 프롬프트를 prompt-memory score_prompt_archive로 측정하고 반복되는 프롬프트 습관 약점을 요약해줘.

prompt-memory review_project_instructions를 latest=true로 사용해서 내 AGENTS.md/CLAUDE.md 규칙이 코딩 에이전트에게 충분한지 평가해줘.
```

이 tool들은 점수, band, checklist breakdown, warning, 반복 부족 항목, 승인 가능한 재작성 초안, 개선 힌트를 반환합니다.
직접 전달한 prompt text는 저장하지 않고, 외부 LLM을 호출하지 않습니다. archive 기반 score/rewrite 흐름은 저장된 원문 prompt body를 반환하지 않습니다. archive scoring tool은 raw absolute path도 반환하지 않습니다. project instruction review tool은 instruction file 본문과 raw absolute path를 반환하지 않습니다. status tool은 안전한 개수, 최신 prompt metadata, 사용 가능한 tool 이름, 다음 행동만 반환합니다.

Claude Code 등록 예시:

```sh
claude mcp add --transport stdio prompt-memory -- prompt-memory mcp
```

Codex 등록 예시:

```sh
codex mcp add prompt-memory -- prompt-memory mcp
```

custom data directory를 쓴다면:

```sh
prompt-memory mcp --data-dir /path/to/prompt-memory-data
```

## Benchmark

Benchmark v1은 privacy, retrieval, rule-based prompt improvement, prompt quality score calibration, analytics, latency에 대한 로컬 회귀 신호를 측정합니다.

```sh
pnpm benchmark
pnpm benchmark -- --json
```

benchmark는 synthetic fixture만 사용합니다. 실제 사용자 prompt 품질을 완전히 해결했다는 주장이 아니라 로컬 baseline입니다.

## Release Smoke

beta publish 또는 tag 전 release smoke를 실행하세요.

```sh
pnpm smoke:release
```

이 script는 package를 build하고, 격리된 임시 data directory와 HOME을 만들고, 로컬 서버를 시작하고, fixture 형태의 Claude Code/Codex prompt를 capture하고, CLI list/search/show/delete/rebuild-index, SQLite WAL/FTS5, 삭제 cleanup을 검증합니다.

브라우저 회귀 smoke:

```sh
pnpm e2e:browser
```

archive, detail, Prompt Coach copy/save, projects, anonymized export, mobile overflow, English/Korean language switch를 실제 로컬 서버에서 확인합니다.

## Storage

`prompt-memory`는 Markdown을 source of truth로 보고 SQLite를 index로 사용합니다.

기본 파일:

```text
~/.prompt-memory/config.json
~/.prompt-memory/hook-auth.json
~/.prompt-memory/prompt-memory.sqlite
~/.prompt-memory/prompts/
~/.prompt-memory/logs/
~/.prompt-memory/quarantine/
~/.prompt-memory/spool/
```

POSIX 시스템에서는 민감 directory를 `0700`, token/config 파일을 `0600`으로 생성합니다.

## Privacy And Security

기본 동작:

- Prompt capture는 `127.0.0.1` 로컬에서만 동작합니다.
- Hook ingest는 `hook-auth.json`에 저장된 로컬 bearer token을 사용합니다.
- Browser UI는 same-origin session cookie와 CSRF token을 사용합니다.
- `mask` mode에서는 민감값을 Markdown, SQLite, FTS indexing 전에 redaction합니다.
- 외부 LLM 분석은 구현되어 있지 않으며, 이 앱은 분석 목적으로 prompt를 외부 provider에 보내지 않습니다.
- Prompt Coach는 copy-based입니다. Claude Code 또는 Codex에 prompt를 자동으로 바꾸거나 재제출하지 않습니다.
- Settings와 local diagnostics는 로컬 사용자에게 filesystem path를 보여줄 수 있습니다. Browser prompt/archive/export 표면은 prompt-body path를 mask하고 raw prompt identifier를 피합니다.

중요한 한계:

- 이 도구는 연결된 도구에 제출하는 prompt를 저장합니다. 해당 content를 저장해도 되는 환경에서만 hook을 켜세요.
- Redaction은 best-effort이며 완전한 DLP로 취급하면 안 됩니다.
- 삭제는 prompt-memory의 Markdown과 SQLite row를 제거하지만 terminal history, editor buffer, backup, filesystem snapshot, upstream AI tool transcript에 남은 복사본까지 지우지는 않습니다.
- 이 프로젝트는 Claude.ai OAuth token, Claude Code internal auth token, OpenAI/Codex session token, ChatGPT account token을 추출, 저장, proxy, 판매, 재사용하지 않습니다.

## 데이터 제거

단일 prompt 삭제:

```sh
pnpm prompt-memory delete <prompt-id>
```

hook 제거:

```sh
pnpm prompt-memory uninstall-hook claude-code
pnpm prompt-memory uninstall-hook codex
```

prompt-memory 데이터 전체 제거:

```sh
rm -rf ~/.prompt-memory
```

다른 `--data-dir`를 사용했다면 해당 경로를 지우세요.

## 개발

전체 로컬 gate:

```sh
pnpm format
pnpm test
pnpm lint
pnpm build
pnpm pack:dry-run
```

dry-run package에는 built CLI, built web assets, README, release documentation이 포함되어야 합니다.

publish 전 [Package contents](docs/PACKAGE_CONTENTS.md)와 [Pre-publish privacy audit](docs/PRE_PUBLISH_PRIVACY_AUDIT.md)를 확인하세요.

## 기여

Issue, pull request, security report를 열기 전에 [CONTRIBUTING](CONTRIBUTING.md), [CODE OF CONDUCT](CODE_OF_CONDUCT.md), [SUPPORT](SUPPORT.md), [SECURITY](SECURITY.md)를 읽어주세요.

## 문서

- [PRD](docs/PRD.md)
- [Phase 2 PRD](docs/PRD_PHASE2.md)
- [Package contents](docs/PACKAGE_CONTENTS.md)
- [Pre-publish privacy audit](docs/PRE_PUBLISH_PRIVACY_AUDIT.md)
- [Efficiency review](docs/EFFICIENCY_REVIEW.md)
- [Tech spec](docs/TECH_SPEC.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Adapter guide](docs/ADAPTERS.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Security policy](SECURITY.md)

## License

MIT
