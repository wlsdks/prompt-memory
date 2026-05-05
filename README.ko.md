# prompt-memory

[English](README.md) | [한국어](README.ko.md)

**Claude Code · Codex용 로컬 prompt 기억 및 코치 도구.**

- 🗂️ Claude Code / Codex에 보낸 모든 prompt를 로컬 Markdown + SQLite에
  보관합니다 — 외부로 나가지 않습니다.
- 🧠 각 prompt를 5개 기준으로 0–100점 평가하고 어떤 항목에서 점수가
  깎였는지 알려줍니다. 추측 대신 학습합니다.
- ✍️ 자동 재제출 없이 복사해서 바로 쓸 수 있는 개선안 초안을 만들어
  줍니다 (영어/한국어 자동 감지).

```sh
npm install -g prompt-memory
prompt-memory setup --profile coach --register-mcp --open-web
# Claude Code 또는 Codex에 prompt 한 번 보낸 뒤:
prompt-memory coach
```

`prompt-memory`는 Claude Code, Codex 같은 AI 코딩 도구에 입력한 프롬프트를 안전하게 로컬에 기록하고, 나중에 다시 찾고, 반복되는 약한 프롬프트 패턴을 분석하고, 다음 요청을 더 잘 쓰도록 돕는 developer tool입니다.

지원되는 도구의 프롬프트를 로컬에서 수집하고, 민감값을 저장 전에 마스킹하고, 사람이 읽을 수 있는 Markdown을 원본으로 남기며, SQLite/FTS 인덱스와 로컬 웹 UI를 통해 검색, 상세 보기, 누적 점수 측정, 프롬프트 연습, 분석, 삭제, 승인형 Prompt Coach 개선안을 제공합니다.

이 프로젝트는 Anthropic, OpenAI 또는 다른 AI 도구 제공사와 제휴, 보증, 후원 관계가 없습니다. Claude Code, Codex 같은 제품명은 호환성을 설명하기 위해서만 사용합니다.

## 첫 3분 Coach Loop

첫 성공은 웹 dashboard가 아닙니다. 방금 Claude Code 또는 Codex에 보낸
실제 prompt의 점수와 바로 고칠 한 가지를 확인하는 것입니다.

대부분의 사용자는 아래 happy path로 시작하면 됩니다.

```sh
prompt-memory start --open-web
prompt-memory setup --profile coach --register-mcp --open-web
# 실제 Claude Code 또는 Codex coding prompt를 하나 보냅니다
prompt-memory coach
```

새 agent session마다 웹 workspace가 자동으로 열리는 것이 싫다면
`--open-web`은 빼고 시작하세요.

아래는 이 happy path가 실패했을 때만 확인하세요.

```sh
prompt-memory doctor claude-code
prompt-memory doctor codex
# MCP 등록이 실패한 경우:
# claude mcp add --transport stdio prompt-memory -- prompt-memory mcp
# codex mcp add prompt-memory -- prompt-memory mcp
```

로컬 archive는 dashboard, 검색, history review, export가 필요할 때만
열면 됩니다.

## 상태

이 저장소는 pre-release 소프트웨어입니다.

- Claude Code 지원: MVP 경로
- Codex 지원: beta adapter
- 로컬 rule-based 분석 preview: 구현됨
- Prompt Quality Score: 로컬 deterministic `0-100` rubric으로 구현됨
- MCP prompt scoring tools: 로컬 stdio server로 구현됨
- 승인형 Prompt Coach: raw-free 다음 요청 브리프 복사까지 구현됨
- Prompt Practice 작업면: 초안 본문을 저장하지 않는 로컬 작성/점수
  history와 outcome feedback UI로 구현됨
- Transcript import: CLI 중심
- 익명화 export: 웹 UI와 CLI preview/job 흐름
- Benchmark v1: 로컬 회귀 baseline
- English/Korean 웹 UI: 구현됨
- 외부 LLM 분석: `prompt-memory`의 숨은 provider 호출 없음. 명시적으로
  요청한 경우에만 MCP agent rewrite/judge packet이 현재 사용자가 제어하는
  Claude Code/Codex/Gemini CLI provider 세션으로 들어갈 수 있음
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

아래 예시는 publish된 CLI 명령 `prompt-memory`를 기준으로 합니다. 이 저장소를
clone해서 개발 모드로 실행할 때만 `pnpm prompt-memory`를 사용하세요.

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

`/prompt-memory:setup`은 CLI 사용 가능 여부를 확인하고, `prompt-memory setup --profile coach --register-mcp --dry-run`을 먼저 실행한 뒤, 설정 파일을 쓰기 전에 사용자의 승인을 받습니다.

### 3. Codex Marketplace 추가

쉘에서:

```sh
codex plugin marketplace add wlsdks/prompt-memory
```

그 다음 로컬 coach setup을 실행합니다.

```sh
prompt-memory setup --profile coach --register-mcp
```

Codex는 marketplace 관리를 `codex plugin marketplace add/upgrade/remove`로 제공합니다. 프롬프트 capture hook은 `prompt-memory setup`이 Codex hook config를 쓰고 Codex hooks를 활성화하면서 설치합니다.

### 4. Capture 확인

```sh
prompt-memory doctor claude-code
prompt-memory doctor codex
prompt-memory statusline claude-code
prompt-memory buddy --once
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

## 설치 (Development Checkout)와 setup 옵션 reference

이 섹션은 contributor와 모든 `setup` 옵션이 필요한 사용자를 위한 reference입니다.
npm으로 설치한 일반 사용자는 위의 [빠른 시작](#빠른-시작)을 따라가면 됩니다.

agent marketplace 흐름 없이 로컬 개발로 설치:

```sh
pnpm install
pnpm build
pnpm prompt-memory setup --profile coach --register-mcp
```

`setup`은 의도적으로 명시적입니다. npm/pnpm package 설치만으로 Claude Code 또는 Codex 설정을 조용히 수정하거나, login service를 설치하거나, 로컬 background server를 시작하지 않습니다. `prompt-memory setup --profile coach`가 사용자의 동의 단계이며, hook capture, 낮은 마찰의 rewrite guidance, Claude Code status line, 로컬 server startup을 한 번에 준비합니다. 기존 Claude Code status line이 있으면 덮어쓰지 않고 하나의 chained command 안에서 함께 실행하며, 제거 시 가능한 경우 이전 command를 복구합니다. `--register-mcp`를 붙이면 감지된 Claude Code/Codex CLI에 `prompt-memory mcp`도 함께 등록합니다.

dry-run으로 변경 사항만 preview:

```sh
pnpm prompt-memory setup --profile coach --register-mcp --dry-run
```

Serena처럼 agent를 시작할 때 웹 workspace도 같이 열고 싶으면 명시적으로 opt-in합니다.

```sh
pnpm prompt-memory setup --profile coach --register-mcp --open-web
```

이 옵션은 기본값이 아닙니다. `SessionStart` hook을 설치해 로컬 server를 확인/시작하고, 같은 agent session id에서는 브라우저를 한 번만 엽니다. hook은 fail-open이며 prompt 본문, raw path, token을 stdout/stderr에 출력하지 않습니다.

프롬프트 coaching 없이 수동 capture만 원하면 기본 profile을 사용합니다.

```sh
pnpm prompt-memory setup
```

background service를 원하지 않으면:

```sh
pnpm prompt-memory setup --no-service
pnpm prompt-memory server
```

웹 UI URL은 빠른 시작과 동일합니다: `http://127.0.0.1:17373`.

기본 데이터 위치:

```text
~/.prompt-memory
```

다른 위치를 쓰려면:

```sh
pnpm prompt-memory init --data-dir /path/to/prompt-memory-data
```

## 로컬 서버 시작

```sh
pnpm prompt-memory server
```

기본 주소:

```text
http://127.0.0.1:17373
```

브라우저에서 위 주소를 열면 웹 UI를 사용할 수 있습니다.

macOS에서는 `setup`이 LaunchAgent를 설치해서 로그인 시 서버를 자동 시작할
수 있습니다. 직접 관리도 가능합니다:

```sh
pnpm prompt-memory service install
pnpm prompt-memory service status
pnpm prompt-memory service start
pnpm prompt-memory service stop
```

## Claude Code 연결

Claude Code hook 설치:

```sh
pnpm prompt-memory install-hook claude-code
```

선택 기능: Prompt Rewrite Guard

```sh
pnpm prompt-memory install-hook claude-code --rewrite-guard block-and-copy --rewrite-min-score 80
```

선택 기능: 웹 자동 open

```sh
pnpm prompt-memory install-hook claude-code --open-web
```

`block-and-copy`는 공식 `UserPromptSubmit` decision 흐름만 사용합니다.
점수가 낮은 prompt는 Claude Code가 처리하기 전에 block하고, 로컬 개선안을
보여주며 clipboard 복사를 best-effort로 시도합니다. 터미널에 자동 입력하거나
Enter를 누르거나 composer 내용을 비공식적으로 바꾸지는 않습니다. 로컬 ingest
server가 꺼져 있거나 ingest가 실패하면 hook은 fail-open으로 prompt를 막지
않습니다.

설정 변경 preview:

```sh
pnpm prompt-memory install-hook claude-code --dry-run
```

진단:

```sh
pnpm prompt-memory doctor claude-code
```

`doctor`는 로컬 server 접근성, ingest token, hook 설치, MCP command access를
확인합니다. MCP는 알려진 로컬 config 파일을 먼저 보고, 필요하면 read-only
`claude mcp list`로 한 번 더 확인합니다.

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

선택 기능: Prompt Rewrite Guard

```sh
pnpm prompt-memory install-hook codex --rewrite-guard block-and-copy --rewrite-min-score 80
```

선택 기능: 웹 자동 open

```sh
pnpm prompt-memory install-hook codex --open-web
```

Codex도 같은 안전한 hook command 경로를 사용합니다. Codex plugin-local hook
동작은 버전에 따라 다를 수 있으므로 `prompt-memory setup` /
`install-hook`은 여전히 user-level hook config를 작성합니다. 로컬 ingest
server가 꺼져 있거나 ingest가 실패하면 hook은 fail-open으로 prompt를 막지
않습니다.

`hooks.json`과 `config.toml` 변경 preview:

```sh
pnpm prompt-memory install-hook codex --dry-run
```

진단:

```sh
pnpm prompt-memory doctor codex
```

`doctor`는 로컬 server 접근성, ingest token, hook 설치, Codex hook feature
상태, MCP command access를 확인합니다. MCP는 알려진 로컬 config 파일을 먼저
보고, 필요하면 read-only `codex mcp list`로 한 번 더 확인합니다.

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

## Agent Wrappers Experimental

`pm-claude`와 `pm-codex`는 초기 prompt 인자를 먼저 다루는 실험적 front-door
wrapper입니다. prompt를 로컬에서 점수화하고, 약하면 redaction된 개선안을 만든 뒤,
선택된 prompt를 실제 `claude` 또는 `codex` binary에 넘깁니다.

```sh
pm-claude --pm-mode auto -- "fix this"
pm-codex --pm-mode auto -- "fix this"
pm-codex --pm-mode auto -- exec "fix this"
```

실제 agent를 실행하지 않고 먼저 검증하려면 dry-run을 사용합니다.

```sh
pm-claude --pm-mode auto --pm-dry-run -- "fix this"
pm-codex --pm-mode auto --pm-dry-run -- "fix this"
```

wrapper 전용 옵션은 `--pm-*` prefix를 사용하므로 일반 Claude/Codex 옵션을
그대로 전달할 수 있습니다. 기본 mode는 `ask`이고, `--pm-mode auto`가 낮은
점수의 초기 prompt를 묻지 않고 교체하는 딸깍 모드입니다. `auth`, `mcp`,
`plugin`, `login` 같은 관리 subcommand는 rewrite하지 않고 그대로 통과시킵니다.
이 wrapper는 interactive session 안에서 이후에 입력하는 모든 메시지를 계속
가로채지는 않습니다.

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
/prompt-memory:guard
/prompt-memory:buddy
/prompt-memory:coach
/prompt-memory:score
/prompt-memory:judge
/prompt-memory:score-last
/prompt-memory:improve-last
/prompt-memory:habits
/prompt-memory:rules
/prompt-memory:coach-next
/prompt-memory:open
```

`/prompt-memory:guard`는 `off / context / ask / block-and-copy` 네 가지
`UserPromptSubmit` rewrite-guard 모드를 인터랙티브 picker로 전환합니다.
CLI 옵션을 외울 필요 없이 슬래시 명령 한 번으로 모드를 바꿀 수 있습니다.
`prompt-memory hook status`로 현재 설치된 모드를 도구별로 확인할 수 있습니다.

`/prompt-memory:setup`은 먼저 dry-run을 실행하고, 로컬 설정을 쓰기 전에 승인받습니다. Claude Code status line은 최신 prompt score HUD로 쓸 수 있으며 다음 명령으로 설치할 수 있습니다.

```sh
pnpm prompt-memory install-statusline claude-code
```

다른 Claude Code HUD가 이미 있으면 prompt-memory는 기존 command를 보존하고 하나의 `statusLine` command에서 둘 다 실행합니다. prompt-memory를 제거하면 설치 시 보존한 이전 command로 복구합니다.

Claude Code 또는 Codex 옆에 두 번째 터미널 pane을 열고 항상 켜두는 buddy를 실행할 수도 있습니다.

```sh
pnpm prompt-memory buddy
```

한 번만 확인하려면 `pnpm prompt-memory buddy --once`, 자동화에는 `pnpm prompt-memory buddy --json`을 사용합니다.

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
pnpm prompt-memory coach
pnpm prompt-memory coach --json
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

MCP server는 열세 개의 tool을 제공합니다.

- `get_prompt_memory_status`: 로컬 archive가 초기화되었는지, prompt가 캡처되었는지, 다음에 어떤 MCP tool을 호출하면 좋은지 확인합니다.
- `coach_prompt`: Claude Code/Codex 안에서 로컬 readiness, 최신 prompt 점수, 승인형 rewrite, 누적 습관, 프로젝트 규칙, 다음 요청 가이드를 한 번에 받습니다.
- `score_prompt`: 직접 전달한 prompt text, 저장된 `prompt_id`, 또는 최신 저장 prompt를 점수화합니다.
- `improve_prompt`: 직접 전달한 prompt text, 저장된 `prompt_id`, 또는 최신 저장 prompt를 승인 가능한 개선 prompt 초안으로 재작성합니다. 결과에는 사용자에게 native ask UI로 물어야 할 `clarifying_questions` 배열(JSON-Schema 형태의 `answer_schema.examples` 포함)이 포함됩니다.
- `apply_clarifications`: 사용자가 직접 답한 답변(각 항목은 `origin: "user"` 필수)을 받아 최종 승인용 draft를 합성합니다. agent가 자기 ask UI로 답을 모은 뒤 호출합니다.
- `ask_clarifying_questions`: prompt-memory가 ask-then-apply 흐름 자체를 주도합니다. 클라이언트가 elicitation capability를 광고하면(Claude Code 2.1.76+) MCP `elicitation/create`로 직접 사용자에게 묻고 final draft를 합성하며, 미지원 / 거부 / 타임아웃 시 clarifying_questions metadata로 fallback합니다. rewrite를 자동 제출하지 않습니다.
- `record_clarifications`: 사용자가 답한 verbatim 답변과 합성된 최종 draft를 prompt id에 묶어 로컬 archive(`prompt_improvement_drafts`)에 영구 저장합니다. 응답에는 metadata(`draft_id`, `answers_count`, `changed_sections` 등)만 들어가고 prompt body나 draft 본문은 echo하지 않습니다.
- `prepare_agent_rewrite`: 현재 Claude Code/Codex/Gemini CLI 세션이 의미론적으로 더 좋은 prompt를 만들 수 있도록, 하나의 redacted prompt packet, 로컬 점수 metadata, 로컬 baseline draft, rewrite contract를 준비합니다.
- `record_agent_rewrite`: 사용자가 승인한 agent rewrite를 redacted improvement draft로 저장하고, rewrite 본문은 반환하지 않습니다.
- `score_prompt_archive`: 최근 저장 prompt 전체를 대상으로 누적 prompt 습관을 점수화하고, 평균 점수, 반복 부족 항목, practice plan, 다음 prompt template, 낮은 점수 prompt id를 반환합니다.
- `review_project_instructions`: 최신 또는 선택한 프로젝트의 `AGENTS.md` / `CLAUDE.md` 규칙 파일을 리뷰하고 점수, checklist 상태, 개선 힌트를 반환합니다.
- `prepare_agent_judge_batch`: 현재 Claude Code/Codex/Gemini CLI 세션이 직접 LLM judge로 평가할 수 있도록, bounded redacted prompt packet과 rubric을 준비합니다. `prompt-memory`가 provider를 대신 호출하지 않습니다.
- `record_agent_judgments`: 현재 agent 세션이 만든 advisory score와 제안을 prompt body/raw path 없이 저장합니다.

읽기 tool은 local-only로 동작하고 구조화 JSON metadata에 대한 MCP
`outputSchema`와 text JSON fallback을 함께 제공합니다.
`record_agent_rewrite`와 `record_agent_judgments`는 non-destructive write tool입니다.
전자는 redacted rewrite draft를 저장하고, 후자는 judgment metadata만 저장합니다.
archive 기반 로컬 tool은 저장된 prompt 본문, raw absolute path, secret,
숨은 외부 LLM 결과를 반환하지 않습니다. agent-judge 모드는 opt-in이며 현재
agent 세션을 evaluator로 사용합니다. agent-rewrite 모드도 opt-in이며 현재
agent 세션을 rewriter로 사용합니다.

Agent에게 이렇게 요청할 수 있습니다.

```text
prompt-memory get_prompt_memory_status를 사용해서 점수 측정 전에 prompt capture가 제대로 동작하는지 확인해줘.

prompt-memory score_prompt를 latest=true로 사용해서 방금 내 요청에서 고칠 점을 알려줘.

prompt-memory improve_prompt를 latest=true로 사용해서 내가 복사해 다시 입력할 수 있는 승인용 개선안을 만들어줘.

prompt-memory prepare_agent_rewrite를 latest=true로 사용해줘. redacted prompt를 네가 직접 더 좋은 요청으로 고친 뒤, 내가 승인하면 record_agent_rewrite로 저장해줘.

최근 Codex 프롬프트를 prompt-memory score_prompt_archive로 측정하고 반복되는 프롬프트 습관 약점을 요약해줘.

prompt-memory review_project_instructions를 latest=true로 사용해서 내 AGENTS.md/CLAUDE.md 규칙이 코딩 에이전트에게 충분한지 평가해줘.

prompt-memory prepare_agent_judge_batch를 selection=low_score, max_prompts=5로 사용해줘. redacted prompt를 네가 직접 평가한 뒤 record_agent_judgments로 점수와 제안을 저장해줘.
```

이 tool들은 점수, band, checklist breakdown(축별 earned/weight 포인트), redaction 알림, 반복 부족 항목, clarifying_questions, 승인 가능한 재작성 초안을 반환합니다.
직접 전달한 prompt text는 저장하지 않고, 숨은 외부 LLM 호출도 하지 않습니다. archive 기반 score/rewrite 흐름은 저장된 원문 prompt body를 반환하지 않습니다. archive scoring tool은 raw absolute path도 반환하지 않습니다. project instruction review tool은 instruction file 본문과 raw absolute path를 반환하지 않습니다. status tool은 안전한 개수, 최신 prompt metadata, 사용 가능한 tool 이름, 다음 행동만 반환합니다.

Agent-judge packet은 예외적으로 명시 요청 시 로컬에서 redaction된 prompt body를 반환합니다. 이는 현재 Claude Code/Codex/Gemini CLI 세션이 직접 평가할 수 있게 하기 위한 것이며, `prompt-memory`가 provider 계정이나 token을 대신 호출하거나 proxy하지 않습니다. 근거와 경계는 [Legal usage guide](docs/LEGAL_USAGE_GUIDE.md)에 기록되어 있습니다.

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

Benchmark v1은 privacy, retrieval, rule-based prompt improvement, `coach_prompt` actionability, prompt quality score calibration, analytics, latency에 대한 로컬 회귀 신호를 측정합니다.

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
- 외부 LLM 분석은 `prompt-memory`의 숨은 background 호출로 실행되지
  않습니다. 선택형 MCP agent rewrite/judge workflow는 사용자가 요청한
  경우에만 redacted prompt packet을 현재 user-controlled Claude Code,
  Codex, Gemini CLI 세션에 제공할 수 있고, 해당 agent는 사용자 tool 설정에
  따라 provider 세션으로 packet을 보낼 수 있습니다.
- Prompt Coach는 copy-based입니다. Claude Code 또는 Codex에 prompt를 자동 입력, 교체, 재제출하지 않습니다.
- Prompt Rewrite Guard는 opt-in입니다. `block-and-copy` mode에서는 낮은 점수 prompt를 block하고 로컬 개선안을 사용자가 paste/enter할 수 있게 제공합니다. `context` mode는 model-visible rewrite guidance를 추가하지만 원문 prompt를 교체하지는 않습니다.
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
- [Architecture](docs/ARCHITECTURE.md)
- [Tech spec](docs/TECH_SPEC.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Adapter guide](docs/ADAPTERS.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Security policy](SECURITY.md)

## License

MIT
