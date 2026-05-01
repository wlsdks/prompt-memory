# prompt-memory PRD

작성일: 2026-05-01  
상태: Implementation Review  
대상: 오픈소스 로컬 우선 개발자 도구

## 1. 개요

`prompt-memory`는 Claude Code, Codex 같은 AI 코딩 도구에 사용자가 입력한 프롬프트를 자동으로 수집하고, Markdown 파일로 저장하며, 로컬 웹 UI에서 검색, 조회, 분석할 수 있게 하는 오픈소스 도구다.

핵심 목표는 AI 코딩 도구 사용 중 사라지는 “입력 프롬프트”를 개인의 개발 자산으로 만들고, 이후 더 나은 프롬프트 작성으로 이어지게 하는 것이다.

이 제품은 전체 대화 로그 수집기가 아니라 “사용자가 직접 입력한 프롬프트”에 집중한다. 저장된 프롬프트를 기반으로 잘한 점, 부족한 점, 반복되는 실수, 개선된 프롬프트 예시, 프로젝트별 지침 후보를 제안한다.

`prompt-memory`의 1차 가치는 프롬프트 분석 점수가 아니라, AI 코딩 도구에 입력한 사용자 프롬프트를 로컬에서 안전하게 보존하고 다시 찾을 수 있게 만드는 것이다. 분석과 instruction 후보 제안은 저장된 기록이 충분히 쌓인 뒤 사용자의 반복 패턴을 개선하기 위한 보조 기능으로 제공한다.

## 2. 배경

AI 코딩 도구를 자주 쓰는 개발자는 비슷한 요청을 반복하거나, 좋은 프롬프트를 한 번 작성하고도 다시 찾지 못하는 경우가 많다. 또한 결과가 좋았던 입력과 결과가 나빴던 입력의 차이를 체계적으로 회고하기 어렵다. 단, MVP는 결과 품질 자동 판정까지 포함하지 않고 프롬프트 저장/검색/삭제 기반을 먼저 완성한다.

Claude Code와 Codex는 훅, 설정 파일, instruction 파일, MCP 등 공식 확장 지점을 제공한다. hook payload에 포함되는 transcript 경로는 메타데이터로 보존하되, transcript JSONL 파싱은 공식 안정 API가 아닌 best-effort import로 분리한다.

## 3. 제품 원칙

- 로컬 우선: 기본 저장 위치는 사용자 로컬 머신이며, 외부 API 분석은 명시적 opt-in으로만 동작한다.
- Markdown 우선: 저장 정책이 적용된 프롬프트 본문은 사람이 읽을 수 있는 `.md` 파일로 저장한다.
- 최소 수집: MVP는 사용자가 입력한 프롬프트와 필요한 메타데이터만 저장한다.
- 도구 독립성: Claude Code, Codex를 우선 지원하되 어댑터 구조로 다른 도구를 추가할 수 있게 한다.
- 프라이버시 기본값: 비밀키, 토큰, `.env` 값, 고객정보 가능성이 있는 문자열은 기본적으로 탐지 및 마스킹한다.
- 개선 중심: 단순 아카이브가 아니라 다음 입력을 더 좋게 만드는 피드백 루프를 제공한다.

## 4. 대상 사용자

- Claude Code, Codex, Cursor, Gemini CLI 등 AI 코딩 도구를 자주 쓰는 개인 개발자
- 자신의 프롬프트 품질을 회고하고 개선하고 싶은 개발자
- 반복 작업용 프롬프트를 축적하고 재사용하고 싶은 오픈소스 메인테이너
- 팀 차원의 AI 코딩 사용 패턴과 프로젝트 지침을 정리하고 싶은 개발팀

## 5. 핵심 사용 시나리오

### 5.1 자동 수집

사용자는 `prompt-memory` 로컬 서버를 실행하고 Claude Code 또는 Codex에 훅 설정을 연결한다. 이후 평소처럼 AI 코딩 도구에 프롬프트를 입력하면, 제출 시점의 프롬프트가 자동으로 로컬 서버에 전달되고 Markdown 파일로 저장된다.

### 5.2 프롬프트 조회

사용자는 웹 UI에서 날짜, 프로젝트, 도구, 태그, 세션 기준으로 프롬프트를 조회한다. 특정 프롬프트를 검색하고, Markdown 저장 본문과 메타데이터를 확인한다.

### 5.3 프롬프트 분석

사용자는 저장된 프롬프트를 선택해 분석한다. 시스템은 목표 명확성, 맥락 충분성, 제약조건, 출력 형식, 완료 기준, 검증 요청 여부를 기준으로 잘한 점과 개선할 점을 제안한다.

### 5.4 개선안 재사용

Phase 2 이후 사용자는 개선된 프롬프트 예시를 복사하거나, 반복적으로 발견되는 규칙을 `CLAUDE.md` 또는 `AGENTS.md`에 추가할 후보로 확인한다.

## 6. MVP 범위

MVP는 “Claude Code의 안정적인 자동 수집, 안전한 로컬 저장, 빠른 조회, 쉬운 삭제”에 집중한다. Codex는 같은 adapter 계약을 검증하는 beta adapter로 제공하되 MVP 완료의 필수 조건은 아니다. 분석 기능은 MVP에서 로컬 규칙 기반 preview로 제한하며, MVP 성공 조건을 분석 품질에 의존시키지 않는다.

포함 범위:

- 로컬 서버
- Claude Code `UserPromptSubmit` 훅 완성도 높은 우선 지원
- Codex `UserPromptSubmit` beta adapter
- 프롬프트 수집 API
- Markdown 파일 저장
- SQLite 메타데이터 인덱스
- CLI 목록/검색/상세/open
- 웹 UI 목록/상세
- 규칙 기반 품질 분석 preview: 단일 프롬프트 요약/주의점만 제공
- 민감정보 탐지 및 마스킹
- 프로젝트별 수집 제외 설정
- hook 설치/제거/검증/진단
- 쉬운 삭제

제외 범위:

- 클라우드 동기화
- 팀 계정/권한 관리
- 브라우저 확장
- 모든 AI 도구 지원
- 자동 프롬프트 재작성의 실시간 개입
- 엔터프라이즈 관리 정책
- 대화 전체의 완전한 재현
- 결과 품질 자동 판정
- assistant 응답과 tool output의 기본 저장
- 분석 점수, 트렌드, 자동 태그, instruction 파일 후보 자동 반영

## 7. 공식 연동 검토

### 7.1 Claude Code

Claude Code의 1차 연동 지점은 `UserPromptSubmit` 훅이다. 공식 문서에 따르면 이 이벤트는 사용자가 프롬프트를 제출한 뒤 Claude가 처리하기 전에 실행되며, 입력 JSON에 `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `prompt`가 포함된다.

권장 MVP 방식:

- Claude Code는 `UserPromptSubmit` command hook 또는 HTTP hook을 사용할 수 있다.
- hook payload를 `http://127.0.0.1:<port>/api/ingest/claude-code`로 전송한다.
- 서버는 `prompt`, `session_id`, `cwd`, `transcript_path`, `permission_mode`를 저장한다.
- HTTP hook과 command hook의 실패 의미를 구분한다.
- `UserPromptSubmit` hook은 성공 시 stdout을 반드시 비워야 한다.
- HTTP hook을 사용할 경우에도 2xx 응답 body를 비워야 한다.
- stdout 또는 HTTP body에 수집 결과, 에러 상세, raw prompt를 출력하면 모델 context와 transcript에 남을 수 있다.
- 과거 가져오기는 `~/.claude/projects/` 아래 JSONL transcript를 선택적으로 스캔하되, MVP 이후 best-effort import로 분류한다.

참고:

- Claude Code Hooks: https://code.claude.com/docs/en/hooks
- Claude Code Hooks Guide: https://code.claude.com/docs/en/hooks-guide
- Claude Code Settings: https://docs.anthropic.com/en/docs/claude-code/settings

### 7.2 Codex

Codex의 1차 연동 지점도 `UserPromptSubmit` 훅이다. Codex 공식 Hooks 문서는 command hook 중심이다. Codex `UserPromptSubmit` command hook은 stdin으로 JSON 객체를 받는다. 공통 필드는 `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`이며, `UserPromptSubmit`에는 `turn_id`와 `prompt`가 포함된다. 이 이벤트의 `matcher`는 현재 무시되므로 설치기는 matcher 기반 필터링에 의존하지 않는다.

권장 MVP 방식:

- Codex hooks 기능과 `[features].codex_hooks` 활성화 여부를 확인한다.
- `UserPromptSubmit` hook에서 로컬 수집 스크립트를 실행한다.
- 수집 스크립트는 stdin JSON을 로컬 서버로 POST한다.
- 서버는 tool 값을 `codex`로 기록한다.
- hook 성공 시 stdout을 반드시 비워야 한다.

추가 활용:

- Codex `AGENTS.md`는 프로젝트별 지침을 자동으로 읽는다. 분석 결과 중 반복되는 개선안은 Codex용 `AGENTS.md` 후보로 제안할 수 있다.
- Claude Code용 후보는 `CLAUDE.md` 또는 `.claude/rules/*.md` 대상으로 제안한다.
- Codex 공식 Prompting Guide의 권장 항목을 분석 기준에 반영한다.

참고:

- Codex Hooks: https://developers.openai.com/codex/hooks
- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Codex Prompting Guide: https://developers.openai.com/cookbook/examples/gpt-5/codex_prompting_guide

### 7.3 공식 연동과 비공식 import 경계

MVP의 신뢰 가능한 수집 경로는 Claude Code/Codex의 공식 hook payload로 제한한다. transcript JSONL, 내부 state DB, history 파일 파싱은 공식 안정 API가 아닌 best-effort import로 분류하며, 버전별 파서와 실패 허용 정책을 별도로 둔다. 비공식 import 실패는 기존 Markdown/SQLite 데이터를 손상시키지 않아야 한다.

### 7.4 서버 미실행 및 hook 실패 정책

기본 동작은 fail-open이다. `prompt-memory` 서버가 실행 중이 아니거나 timeout이 발생해도 Claude Code/Codex의 원래 프롬프트 처리를 막지 않아야 한다.

요구사항:

- hook timeout은 짧게 설정한다.
- 오류 상세는 저장용 프롬프트 본문 없이 로컬 진단 로그에만 기록한다.
- hook 성공 시 stdout과 HTTP response body를 비워 AI 도구의 모델 context에 수집 결과가 들어가지 않게 한다.
- 선택 기능으로만 local spool에 임시 저장 후 서버 시작 시 재전송한다.
- spool 기능은 사용자가 명시적으로 켠 경우에만 저장 정책이 적용된 prompt를 디스크에 임시 저장한다.

## 8. 기능 요구사항

### 8.1 로컬 서버

- 사용자는 `prompt-memory` 서버를 로컬에서 실행할 수 있어야 한다.
- 기본 바인딩은 `127.0.0.1`이어야 한다.
- 기본 포트는 설정 가능해야 한다.
- 서버는 수집 API, 조회 API, 분석 API, 설정 API를 제공해야 한다.
- 저장용 프롬프트 본문을 애플리케이션 로그에 중복 기록하지 않아야 한다.
- 모든 수집 API, 조회 API, 변경 API는 per-install random secret 기반 인증을 요구해야 한다.
- hook 수집에는 조회/변경 API 토큰과 분리된 최소 권한 ingest token을 사용한다.
- ingest token은 prompt 생성 권한만 갖고 조회/삭제/설정 변경 권한은 갖지 않는다.
- 기본 CORS 정책은 deny-all이며, `Origin`, `Host` 헤더를 검증해야 한다.
- state-changing 요청은 CSRF token 또는 same-origin 검증을 적용해야 한다.
- 최대 payload 크기, 요청 rate limit, prompt 길이 제한을 가져야 한다.
- 인증 실패, schema 검증 실패, rate limit 초과 이벤트는 raw prompt 없이 보안 이벤트로만 기록한다.

### 8.2 수집 API

수집 API는 다음 입력을 받아야 한다.

- `tool`: `claude-code`, `codex`, `manual`, `unknown`
- `prompt`: 사용자 입력 원본. 저장 전 redaction 정책을 적용한다.
- `session_id`
- `turn_id`
- `transcript_path`
- `cwd`
- `project_root`
- `git_branch`
- `model`
- `permission_mode`
- `source_event`
- `created_at`
- `received_at`
- `adapter_version`
- `schema_version`
- `raw_event_hash`: `redactionMode=raw`일 때만 영속 저장 가능하며, `mask`에서는 request 처리 중 transient 값으로만 사용한다.
- `raw_metadata`

동작 요구사항:

- adapter가 생성한 stable event id를 우선 idempotency key로 사용한다.
- stable event id가 없으면 `tool + session_id + transcript_path + turn_id + normalized_content_hash` 조합을 사용한다.
- 같은 idempotency key의 재시도는 기존 레코드를 반환하고 파일을 중복 생성하지 않는다.
- `prompt`가 비어 있으면 저장하지 않는다.
- 제외 경로에 해당하는 `cwd`의 프롬프트는 저장하지 않는다.
- 민감정보 탐지 결과에 따라 raw 저장, 마스킹 저장, 저장 거부 중 설정된 정책을 적용한다.
- hook payload는 신뢰하지 않는 입력으로 취급한다.
- 모든 문자열 필드는 길이 제한, 타입 검증, UTF-8 정규화, 제어문자 제거를 거쳐야 한다.
- `cwd`, `project_root`, `transcript_path`는 canonicalize 후 허용된 사용자 홈/프로젝트 경계 안에 있는지 검증해야 한다.
- `created_at`은 클라이언트 제공값을 보존할 수 있지만, 정렬/보존 정책의 기준 시간은 서버 수신 시간인 `received_at`을 우선 사용한다.
- 수집 API도 기본적으로 per-install secret 인증을 요구한다.
- 사용자가 명시적으로 `allowUnauthenticatedLoopbackIngest=true`를 설정한 경우에만 loopback 비인증 수집을 허용하며, `doctor`는 이를 경고로 표시한다.

### 8.3 Adapter 정규화

각 adapter는 raw payload를 표준 `NormalizedPromptEvent`로 변환해야 한다.

필수 출력:

- `tool`
- `source_event`
- `prompt`
- `session_id`
- `cwd`
- `created_at`
- `received_at`
- `idempotency_key`
- `raw_event_hash`: `redactionMode=raw`일 때만 저장 가능
- `adapter_version`
- `schema_version`

선택 출력:

- `turn_id`
- `transcript_path`
- `project_root`
- `git_branch`
- `model`
- `permission_mode`
- `agent_id`
- `agent_type`
- `raw_metadata`

adapter는 알 수 없는 필드를 기본적으로 `raw_metadata` 후보로 분류하되, 개인정보 최소 수집 원칙을 우선 적용한다. `raw_metadata`는 크기 제한, denylist, redaction을 거쳐야 하며 외부 LLM 전송 대상에서 기본 제외한다. 필수 필드가 누락되면 저장 가능한 오류 코드와 함께 reject 또는 partial 정책을 반환한다.

### 8.4 Markdown 저장

각 프롬프트는 하나의 Markdown 파일로 저장한다.

권장 경로:

```text
prompt-memory-data/
  prompts/
    2026/
      05/
        01/
          20260501-103000-codex-prompt-memory.md
```

권장 파일 형식:

```md
---
schema_version: 1
id: prmt_20260501_103000_ab12cd
idempotency_key: codex:...
tool: codex
source_event: UserPromptSubmit
project_name: prompt-memory
project_root: /Users/jinan/side-project/prompt-memory
cwd: /Users/jinan/side-project/prompt-memory
git_branch: main
session_id: "abc123"
turn_id: "turn_123"
transcript_path: null
model: gpt-5.5
created_at: 2026-05-01T10:30:00+09:00
received_at: 2026-05-01T10:30:01+09:00
prompt_length: 1240
stored_content_hash: hmac-sha256:...
tags: []
analysis_status: pending
is_sensitive: false
excluded_from_analysis: false
adapter_version: codex-v1
---

저장 정책이 적용된 프롬프트 본문
```

요구사항:

- Markdown writer는 frontmatter를 구조화 YAML serializer로 생성한다.
- 사용자 입력은 frontmatter 밖 본문에만 기록한다.
- Markdown 본문에는 redaction 정책이 적용된 저장용 prompt를 기록한다.
- `redactionMode=raw`에서만 원문 prompt를 저장하며, `mask`에서는 마스킹된 prompt만 저장한다.
- 프롬프트 본문이 frontmatter delimiter와 충돌해도 메타데이터 파싱 결과가 변하지 않아야 한다.
- 저장 프로토콜은 파일/DB 불일치를 복구 가능하게 설계한다.
- 권장 구현은 staging 파일 작성, fsync, atomic rename, SQLite transaction을 사용한다.
- SQLite 기록 실패 시 orphan 여부를 recovery queue에 기록한다.

### 8.5 SQLite 인덱스

Markdown 파일은 원본 저장소 역할을 하고, SQLite는 검색과 UI 조회를 위한 인덱스 역할을 한다.

SQLite의 `prompts` 테이블은 기본적으로 저장 본문 전문을 저장하지 않고, Markdown 파일 경로, 저장 본문 hash, preview/snippet, 검색 인덱스용 정규화 텍스트만 저장한다. Markdown과 SQLite 메타데이터가 충돌할 경우 Markdown 파일을 source of truth로 간주하고 재색인한다.

필수 테이블:

- `prompts`
- `projects`
- `sessions`
- `prompt_analyses`
- `tags`
- `prompt_tags`
- `settings`
- `redaction_events`
- `schema_migrations`

요구사항:

- SQLite는 `schema_migrations` 테이블로 순차 migration을 관리한다.
- Markdown frontmatter에는 `schema_version`을 포함한다.
- SQLite는 WAL mode를 사용하고 writer 작업은 짧은 transaction으로 제한한다.
- 같은 `prompt_id`에 대한 분석/삭제/재색인은 optimistic concurrency 또는 job lock으로 중복 실행을 방지한다.
- 검색은 SQLite FTS5 기반 full-text search를 기본으로 한다.
- FTS 대상은 마스킹 정책이 적용된 검색용 텍스트, 제목/요약, 태그, 프로젝트명이다.
- 민감정보 패턴은 FTS 인덱스에 raw 값으로 저장하지 않는다.
- 검색 결과는 BM25 rank와 `created_at` 최신순을 조합해 정렬할 수 있어야 한다.

### 8.6 삭제

삭제는 prompt 단위 hard delete를 MVP 기본값으로 한다.

요구사항:

- 삭제 시 Markdown 파일, SQLite `prompts` row, `prompt_analyses`, `prompt_tags`, FTS row를 같은 작업 단위로 제거한다.
- 일부 삭제 실패 시 `doctor`가 orphan Markdown 또는 DB-only row를 탐지해야 한다.
- 삭제 API는 인증과 CSRF 방어를 적용한다.
- 삭제 작업은 저장용 prompt 본문을 로그에 기록하지 않는다.

### 8.7 웹 UI

MVP 화면:

- 프롬프트 목록
- 프롬프트 상세
- 검색
- 필터
- 분석 preview 표시
- 기본 설정

목록 화면 요구사항:

- 최신순 정렬
- 도구별 필터
- 프로젝트별 필터
- 날짜 범위 필터
- 태그 필터
- 민감정보 포함 여부 표시
- 분석 상태 표시

상세 화면 요구사항:

- Markdown preview
- frontmatter 메타데이터 표시
- 저장 정책이 적용된 본문 보기
- 분석 preview 결과 표시
- Markdown preview는 HTML 렌더링을 기본 비활성화한다.
- Markdown 내 외부 이미지, iframe, script, data URL, file URL 렌더링은 기본 차단한다.
- Markdown preview는 raw HTML을 파싱하지 않으며, 모든 사용자 제공 텍스트와 frontmatter/raw_metadata 표시값은 HTML escape 후 렌더링한다.
- 링크는 `http:`/`https:`만 허용하고 `javascript:`, `data:`, `file:`, custom scheme은 차단한다.
- 외부 링크는 새 창 열기 시 `rel="noopener noreferrer"`를 적용한다.
- syntax highlighting을 사용할 경우 highlighter 출력도 sanitizer allowlist를 통과해야 한다.
- 웹 UI는 기본 CSP를 적용한다: `default-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'`.

### 8.8 분석

MVP 분석은 저장된 단일 프롬프트에 대한 로컬 규칙 기반 preview로 제한한다. MVP에서는 점수, 트렌드, 자동 태그, instruction 파일 후보 제안, 외부 LLM 분석을 완료 기준에 포함하지 않는다.

분석 기준:

- 목표 명확성
- 배경 맥락 충분성
- 작업 범위 통제
- 제약조건 명시
- 원하는 출력 형식 명시
- 완료 기준 또는 검증 기준 포함
- 파일/명령/환경 같은 구체적 단서 제공
- 불필요하게 넓거나 모호한 요청 여부
- 반복 수정 가능성이 높은 지시 누락 여부

분석 결과:

- 한 줄 요약
- 주의할 점
- 다음 입력에서 보강하면 좋은 항목

분석은 기본적으로 로컬 규칙 기반으로 먼저 제공한다. 외부 LLM 기반 분석은 사용자가 명시적으로 API key와 전송 허용을 설정한 경우에만 실행한다.

## 9. 데이터 모델

### 9.1 Prompt

- `id`
- `stored_content_hash`
- `raw_content_hash`: `redactionMode=raw`일 때만 저장 가능
- `idempotency_key`
- `tool`
- `source_event`
- `project_id`
- `session_id`
- `turn_id`
- `transcript_path`
- `cwd`
- `project_root`
- `git_branch`
- `model`
- `permission_mode`
- `created_at`
- `received_at`
- `markdown_path`
- `markdown_schema_version`
- `markdown_mtime`
- `markdown_size`
- `prompt_length`
- `is_sensitive`
- `excluded_from_analysis`
- `redaction_policy`
- `adapter_version`
- `raw_event_hash`: `redactionMode=raw`일 때만 저장 가능
- `raw_metadata_path` 또는 `raw_metadata_json`
- `index_status`: `indexed`, `missing_file`, `hash_mismatch`, `corrupt_frontmatter`
- `import_job_id`: Phase 2 import에서 사용
- `deleted_at`

### 9.2 Project

- `id`
- `name`
- `root_path`
- `repo_url`
- `created_at`
- `disabled`

### 9.3 Session

- `id`
- `tool`
- `project_id`
- `transcript_path`
- `started_at`
- `ended_at`

### 9.4 PromptAnalysis

- `id`
- `prompt_id`
- `clarity_score`
- `context_score`
- `constraint_score`
- `actionability_score`
- `verification_score`
- `overall_score`
- `summary`
- `strengths`
- `weaknesses`
- `improvements`
- `rewritten_prompt`
- `instruction_candidates`
- `created_at`
- `analyzer`

요구사항:

- `PromptAnalysis`의 모든 free-text 필드는 저장 전 redaction pipeline을 통과해야 한다.
- raw secret 또는 raw 경로를 재생성한 분석 결과는 저장하지 않는다.
- `rewritten_prompt`와 `instruction_candidates`는 외부 전송 금지/분석 제외 설정을 상속한다.

### 9.5 Tag

- `id`
- `name`
- `created_at`

### 9.6 Setting

- `key`
- `value`
- `updated_at`

### 9.7 RedactionEvent

- `id`
- `prompt_id`
- `detector_type`
- `range_start`
- `range_end`
- `policy`
- `created_at`

### 9.8 Phase 2 데이터 모델

다음 테이블은 import와 복구 기능이 구현되는 시점에 상세 스키마를 확정한다.

- `import_jobs`
- `import_errors`
- `storage_reconciliation_events`
- `fts_index_metadata`

## 10. 보안 및 개인정보 요구사항

`prompt-memory`는 사용자의 AI 코딩 프롬프트가 소스코드, 비밀키, 고객정보, 사내 맥락을 포함할 수 있다는 전제하에 설계한다. 모든 기능은 로컬 우선, 명시적 동의, 최소 수집, 쉬운 삭제를 기본 원칙으로 한다.

### 10.1 로컬 서버

- 로컬 서버는 기본적으로 `127.0.0.1`에만 바인딩한다.
- 원격 접속 허용 시 별도 경고와 인증 설정이 필요하다.
- 로컬 서버의 모든 수집 API, 변경 API, 조회 API는 기본적으로 loopback 전용 bearer token 또는 per-install random secret 인증을 요구해야 한다.
- hook wrapper는 `~/.prompt-memory/hook-auth.json` 같은 owner-only 권한 파일에서 서버 토큰을 읽는다.
- hook 설정 파일에는 인증 토큰 값을 직접 기록하지 않는다.
- 설치기는 토큰을 hook command 문자열, stdout/stderr, Markdown, SQLite, 일반 로그에 기록하지 않는다.
- 환경변수 주입은 process inspection 리스크가 있으므로 기본 방식으로 사용하지 않는다.
- 웹 UI는 CSRF 방지를 위해 state-changing 요청에 CSRF token 또는 same-origin 검증을 적용해야 한다.
- 서버는 `Origin`, `Host` 헤더를 검증하고, 기본 CORS 정책은 deny-all이어야 한다.

### 10.2 저장소와 파일 권한

- 기본값은 로컬 저장이다.
- 데이터 디렉터리, SQLite DB, Markdown 파일, 설정 파일은 생성 시 owner-only 권한을 적용해야 한다. 예: directory `0700`, file `0600`.
- 권한이 더 넓게 설정된 기존 데이터 디렉터리를 감지하면 경고하고 자동 수정 옵션을 제공한다.
- token file은 `0600`, 상위 디렉터리는 `0700`으로 생성하고, `doctor`는 토큰 파일 권한과 유출 가능성을 검사한다.
- 삭제 기능은 Markdown 파일과 SQLite 인덱스를 함께 처리해야 한다.
- 로그에는 저장용 프롬프트 본문을 남기지 않는다.
- 보존 기간을 설정할 수 있어야 한다.
- 백업, export, 익명화 export는 별도 보안 요구사항을 따른다.

### 10.3 Redaction

- 경로 기반 제외 규칙과 본문 secret detector를 분리한다.
- `.git`, `node_modules`, `.env`, `secrets/**`는 기본 capture/import 제외 후보이다.
- 기본 탐지 대상에는 API key, bearer token, private key block, JWT, SSH key, cloud credentials, database URL, webhook URL, 이메일/전화번호 등 PII 패턴을 포함한다.
- 민감정보 탐지 시 저장 거부, 마스킹 저장, raw 저장 중 정책을 선택할 수 있어야 한다.
- redaction은 디스크 저장, SQLite 인덱싱, 분석 실행, 로그 기록, 외부 전송보다 먼저 수행되어야 한다.
- `redactionMode=mask`에서는 raw secret을 어떤 영속 저장소에도 저장하지 않는다.
- `redactionMode=mask`에서는 raw prompt 기반 `content_hash` 또는 `raw_event_hash`를 영속 저장하지 않는다.
- 중복 제거에는 redaction 이후 본문과 안정 메타데이터 기반 HMAC을 사용하며, HMAC key는 per-install secret으로 관리한다.
- raw 저장 정책일 때만 raw content hash를 저장할 수 있으며, export와 로그에는 포함하지 않는다.
- 분석 결과와 개선 프롬프트도 redaction pipeline을 다시 통과해야 한다.
- redaction 이벤트에는 raw secret을 저장하지 않고 detector type, 위치 범위, 처리 정책, timestamp만 저장한다.

### 10.4 Transcript import

- transcript import는 기본 비활성화이며, 사용자가 파일/프로젝트/기간을 명시적으로 선택한 경우에만 실행한다.
- importer는 사용자 입력 프롬프트 이벤트만 추출해야 하며, assistant 응답, tool output, 파일 내용, 명령 출력은 기본 저장 대상에서 제외한다.
- import 실행 전 예상 수집 건수, 포함 필드, 제외 필드, 민감정보 탐지 결과 요약을 preview로 보여줘야 한다.
- import 중 파싱 실패나 알 수 없는 이벤트 타입은 저장하지 않고 별도 오류로 기록한다.

### 10.5 외부 LLM 분석

- 외부 분석 API 전송은 기본 비활성화다.
- 외부 LLM 분석은 전역 opt-in 외에 프로젝트별 opt-in을 요구한다.
- 외부 전송 전 사용자에게 전송될 필드, provider, model, redaction 적용 여부, 예상 토큰 범위를 preview로 보여준다.
- 외부 분석에는 기본적으로 마스킹된 prompt와 최소 메타데이터만 전송한다.
- `cwd`, `project_root`, `repo_url`, `transcript_path` 같은 경로 정보는 별도 동의 없이는 제외한다.
- 민감정보가 감지된 prompt는 기본적으로 외부 분석 대상에서 제외하고, 사용자가 건별로 override할 수 있게 한다.
- 민감정보가 감지된 prompt의 외부 전송 override는 기본적으로 1회성으로만 허용하며, 전송 직전 감지 유형과 전송 필드 diff를 다시 보여주고 명시 확인을 요구한다.
- override 결정은 저장용 프롬프트 본문 없이 provider, model, prompt id, detector type, timestamp, user action만 감사 로그에 남긴다.
- 외부 전송은 redaction 이후 payload snapshot을 기준으로 수행하며, provider 응답과 분석 결과도 저장 전 redaction pipeline을 다시 통과한다.
- API key는 OS keychain 또는 권한 제한 파일에 저장하고, Markdown/SQLite/log/config export에 포함하지 않는다.

### 10.6 수집 제외와 사용자 제어

- 수집 대상 프로젝트를 사용자가 끌 수 있어야 한다.
- 특정 경로, 특정 git repo, 특정 키워드 포함 prompt를 저장 제외할 수 있어야 한다.
- 사용자는 prompt 단위로 저장 본문 삭제, 분석 제외, 외부 분석 금지를 설정할 수 있어야 한다.

## 11. 설정

권장 설정 파일:

```text
~/.prompt-memory/config.json
```

설정 예시:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 39291,
    "auth": "required"
  },
  "storage": {
    "dataDir": "~/.prompt-memory",
    "markdownDir": "~/.prompt-memory/prompts",
    "retentionDays": 365
  },
  "capture": {
    "enabledTools": ["claude-code", "codex"],
    "excludedPaths": ["**/.env", "**/secrets/**"],
    "disabledProjects": [],
    "failOpen": true,
    "spoolOnServerDown": false
  },
  "privacy": {
    "redactionMode": "mask",
    "externalAnalysis": false,
    "externalAnalysisProjects": []
  }
}
```

## 12. 설치 및 온보딩

MVP 온보딩 목표는 사용자가 5분 안에 첫 프롬프트를 저장하는 것이다.

권장 흐름:

1. 패키지 설치
2. `prompt-memory init`
3. 로컬 서버 실행
4. Claude Code 또는 Codex hook 설정 자동 생성
5. 테스트 프롬프트 전송
6. 웹 UI 열기

CLI 명령 예시:

```sh
prompt-memory init
prompt-memory server
prompt-memory install-hook claude-code
prompt-memory install-hook codex
prompt-memory install-hook codex --dry-run
prompt-memory doctor
prompt-memory uninstall-hook codex
prompt-memory open
```

### 12.1 Hook 설치 및 설정 병합

`prompt-memory install-hook`은 기존 Claude Code/Codex 설정 파일을 덮어쓰지 않고 구조적으로 병합해야 한다.

요구사항:

- 설치 전 기존 파일의 백업을 생성한다.
- 설치 전 dry-run diff를 제공한다.
- 동일 hook의 중복 설치를 방지한다.
- 설치 실패 또는 사용자 취소 시 원본 설정을 복원할 수 있어야 한다.
- hook command 필드는 공식 설정상 문자열이므로, 설치기는 OS별 shell quoting을 적용한 고정 command 문자열을 생성한다.
- command에는 설치된 실행 파일의 절대 경로와 고정 인자만 넣고, 사용자 입력, 프로젝트 경로, 인증 토큰을 직접 보간하지 않는다.
- 인증 토큰은 owner-only 권한의 별도 설정 파일에서 hook wrapper가 읽는다.
- hook 제거/복구 명령을 제공한다.
- `uninstall-hook`은 hook 설정뿐 아니라 해당 hook 전용 토큰 폐기도 지원한다.
- 프로젝트 저장소 안의 악성 설정이 전역 `prompt-memory` 설정을 임의 변경할 수 없어야 한다.

Claude Code 고려사항:

- 사용자/프로젝트/local/managed settings 계층을 고려한다.
- managed policy로 사용자 hook이 차단된 경우 이를 감지해 사용자에게 설명한다.

Codex 고려사항:

- `~/.codex/hooks.json`, `~/.codex/config.toml`, project-local `.codex/*`를 검사한다.
- `[features].codex_hooks` 활성화 여부를 검사하고 필요한 변경 diff를 보여준다.
- Codex 설치기는 user-level 설정을 기본 대상으로 한다.
- project-local `.codex/` hook은 해당 프로젝트 설정 layer가 trust된 경우에만 동작하므로 `doctor`에서 trust 상태를 별도 진단한다.
- Codex는 여러 config layer의 matching hook을 모두 실행하므로, 중복 설치 탐지는 user/project 양쪽 hook source를 모두 검사해야 한다.

### 12.2 Doctor

`prompt-memory doctor`는 첫 실행과 문제 해결을 위한 진단 명령이다.

검사 항목:

- 서버 상태
- 포트 충돌
- 데이터 디렉터리 권한
- SQLite 접근 가능 여부
- Markdown 디렉터리 쓰기 가능 여부
- Claude Code/Codex 설치 및 버전
- hook 기능 지원 여부
- hook 설정 파일 유효성
- 인증 토큰 설정 여부
- ingest token 파일 권한과 유출 가능성
- 테스트 payload 수집 여부
- 마지막 수집 이벤트
- redaction 설정
- 외부 분석 비활성화 여부

### 12.3 Cross-platform 지원

MVP는 macOS, Linux, Windows에서 설정 파일 위치, path separator, shell quoting, executable path, localhost 접근, 파일 잠금 동작을 검증해야 한다. hook command는 OS별 shell 문자열 삽입을 최소화하고, 가능하면 `prompt-memory hook <tool>` 형태의 단일 CLI entrypoint를 사용한다.

Windows에서는 POSIX mode(`0700`, `0600`) 대신 ACL 기반 owner-only 권한을 검증한다. hook command 생성은 macOS/Linux POSIX shell, Windows cmd/PowerShell, `.exe`/`.cmd` resolution을 분리 테스트한다. localhost는 `127.0.0.1`을 기본으로 쓰고, `localhost`의 IPv6/프록시/방화벽 차이는 `doctor`에서 별도 진단한다.

## 13. 아키텍처

권장 구성:

```text
Claude Code
  -> UserPromptSubmit Hook
  -> HTTP Hook or Local Ingest Script
  -> prompt-memory Local Server

Codex
  -> UserPromptSubmit Command Hook
  -> Local Ingest Script
  -> prompt-memory Local Server

prompt-memory Local Server
  -> Redaction Pipeline
  -> Markdown Writer
  -> SQLite Indexer
  -> Web UI
  -> Analyzer
```

모듈:

- `adapters`: 도구별 hook payload 정규화
- `ingest`: 수집 API와 중복 방지
- `redaction`: 민감정보 탐지 및 마스킹
- `storage`: Markdown writer와 SQLite indexer
- `analysis`: 규칙 기반 분석 및 선택적 LLM 분석
- `web`: 로컬 UI
- `cli`: init, server, hook install, import

### 13.1 Import pipeline

import pipeline은 다음 단계로 구성한다.

```text
discover -> parse -> normalize -> redact -> deduplicate -> persist -> index
```

요구사항:

- import job은 dry-run, resume, progress reporting, per-record error log를 지원한다.
- 한 transcript 파싱 실패가 전체 import를 중단하지 않아야 한다.
- 재실행 시 idempotency key로 기존 항목을 건너뛴다.
- import source가 공식 hook payload인지, transcript/log 파싱인지 기록한다.
- transcript/log 파싱 기반 import는 experimental 또는 best-effort로 표시한다.

### 13.2 복구와 재색인

로컬 우선 도구는 사용자가 Markdown 파일을 직접 수정/삭제하거나 SQLite가 손상될 가능성을 전제로 한다.

요구사항:

- `prompt-memory doctor`는 Markdown 파일, frontmatter, content hash, SQLite row, FTS index의 불일치를 검사한다.
- `prompt-memory rebuild-index`는 Markdown 디렉터리를 source of truth로 SQLite와 FTS 인덱스를 재생성할 수 있어야 한다.
- 손상된 Markdown은 quarantine 디렉터리로 이동하고 UI에 복구 필요 상태로 표시한다.
- 앱 시작 시 Markdown-only 파일은 재색인하고 DB-only 레코드는 `missing_file` 상태로 표시한다.
- 오래된 Markdown frontmatter는 읽기 시 호환 처리하되 백그라운드 upgrade 작업으로 최신 `schema_version`으로 갱신할 수 있어야 한다.

## 14. 향후 로드맵

### Phase 1: MVP

- Claude Code hook 수집 완성
- Codex beta adapter
- Markdown 저장
- SQLite 인덱스
- CLI 목록/검색/상세
- 최소 웹 UI
- 민감정보 마스킹
- hook 설치/제거/검증
- doctor/rebuild-index

### Phase 2: 개발자 경험 개선

- 규칙 기반 분석 정식화
- 과거 transcript import
- 프로젝트별 설정 UI
- 중복 프롬프트 감지
- 태그 자동 추천
- Git branch/commit/PR 연결
- `CLAUDE.md`, `AGENTS.md` 후보 제안
- import/reconciliation 이벤트 테이블 상세화

### Phase 3: 분석 고도화

- 프롬프트 품질 트렌드
- 작업 유형 분류
- 실패 가능성이 높은 프롬프트 패턴 감지
- 성공률 높은 프롬프트 클러스터링
- 개인 프롬프트 스타일 리포트

### Phase 4: 확장성

- Cursor, Gemini CLI 등 추가 어댑터
- MCP 서버 제공
- 플러그인형 분석기
- 익명화 export
- 팀 공유용 템플릿 라이브러리

## 15. 오픈소스 고려사항

- 라이선스는 MIT 또는 Apache-2.0을 우선 검토한다.
- 기본 데이터 포맷은 Markdown과 SQLite로 유지해 vendor lock-in을 피한다.
- hook 설치는 사용자의 기존 설정 파일을 덮어쓰지 않고 병합해야 한다.
- 기여자는 새 도구 어댑터를 쉽게 추가할 수 있어야 한다.
- 공식 문서 기반 연동과 비공식 파싱을 명확히 구분한다.
- README는 구현 후가 아니라 첫 개발 산출물로 관리한다.
- README에는 제품명, 저장 위치, 삭제 방법, 외부 전송 없음, hook 제거 방법을 명확히 적는다.
- 새 도구 adapter는 표준 `Adapter` 인터페이스, sample payload fixture, conformance test를 추가하는 방식으로 구현할 수 있어야 한다.
- 각 adapter는 공식 연동 기반인지, transcript/log 파싱 기반인지 명시해야 한다.
- 비공식 파싱 기반 adapter는 안정성 등급을 낮게 표시한다.
- issue template은 new adapter request, redaction false positive, install failure, docs mismatch를 포함한다.

## 16. 정책, 법무, 자료 사용 검토

이 섹션은 개발 전 정책 리스크를 낮추기 위한 제품 요구사항이다. 법률 자문을 대체하지 않으며, 배포 전 라이선스/상표/개인정보/약관 관련 최종 검토가 필요하다.

### 16.1 참고 자료 사용 원칙

- PRD와 구현은 공개된 공식 문서, 공개 API/설정, 공개 hook 인터페이스만 참고한다.
- 비공개 문서, 유출 자료, 리버스 엔지니어링 결과, 사설 API, undocumented endpoint를 제품 요구사항이나 구현 근거로 사용하지 않는다.
- 공식 문서의 기능 사실, 필드명, 설정 경로, 공개 예시는 호환성 구현을 위해 참조할 수 있다.
- 공식 문서 본문을 README, 웹사이트, 앱 UI에 길게 복제하지 않는다.
- 문서에는 필요한 링크와 짧은 요약만 제공하고, 자세한 설명은 공식 문서로 연결한다.
- 공식 문서의 샘플 코드는 그대로 복사하기보다 제품에 맞는 최소 wrapper/fixture로 재작성한다.

### 16.2 상표와 제휴 오인 방지

- 제품명, 패키지명, 도메인, 로고, 아이콘에 `Claude`, `Anthropic`, `OpenAI`, `Codex`, `ChatGPT`, `GPT`를 포함하지 않는다.
- README와 UI에서는 “Claude Code 지원”, “Codex beta adapter”처럼 호환성 설명에 필요한 범위에서만 제3자 제품명을 사용한다.
- OpenAI/Anthropic 로고, 아이콘, wordmark, 브랜드 색상, 제품 UI를 앱 브랜딩에 사용하지 않는다.
- README와 웹 UI에는 “This project is not affiliated with, endorsed by, or sponsored by Anthropic or OpenAI.”에 해당하는 비제휴 고지를 포함한다.
- adapter 이름은 `claude-code`, `codex`처럼 기술적 식별자로만 사용하고, 제품 자체를 해당 브랜드의 공식 확장처럼 표현하지 않는다.

### 16.3 공급자 약관 및 인증 경계

- 이 프로젝트는 Claude Code/Codex 사용자의 로컬 hook payload를 사용자가 직접 선택해 로컬에 저장하는 도구다.
- 사용자의 Claude.ai OAuth 토큰, Claude Code 내부 인증 토큰, OpenAI/Codex 세션 토큰을 추출, 저장, 재사용, 프록시, 공유, 판매하지 않는다.
- 사용자를 대신해 Free/Pro/Max 같은 개인 구독 인증 정보를 라우팅하거나, 해당 자격 증명으로 제3자 서비스를 제공하지 않는다.
- 외부 LLM 분석을 제공할 경우 사용자가 직접 제공한 API key 또는 공급자가 허용한 공식 인증 방식만 사용한다.
- 공급자의 rate limit, usage limit, 안전장치, 접근 제한을 우회하거나 회피하도록 설계하지 않는다.
- 사용자가 각 공급자의 약관, usage policy, supported region, 조직 정책을 준수해야 함을 README에 명시한다.

### 16.4 개인정보와 데이터 권리

- 사용자가 저장할 권리와 권한이 있는 프롬프트만 수집한다는 전제를 README와 온보딩에 명시한다.
- 사용자가 소속 조직, 고객, 제3자의 비밀정보나 개인정보를 수집할 수 있으므로 기본값은 로컬 저장, 마스킹, 외부 전송 비활성화다.
- 외부 LLM 분석은 전역 opt-in, 프로젝트 opt-in, 건별 preview를 모두 통과해야 한다.
- 민감정보가 감지된 prompt는 기본적으로 외부 전송 대상에서 제외한다.
- export 기능은 익명화 export와 raw export를 분리하고, raw export에는 강한 경고를 표시한다.
- 사용자는 prompt 단위 삭제, 프로젝트 단위 수집 중지, 전체 데이터 삭제를 수행할 수 있어야 한다.

### 16.5 공식/비공식 통합 경계

- Claude Code/Codex 공식 hook payload는 canonical ingest source로 취급한다.
- transcript JSONL, 내부 state 파일, history 파일 파싱은 best-effort import로 분류한다.
- best-effort import는 기본 비활성화이며, 사용자가 명시적으로 선택한 파일/기간/프로젝트에만 적용한다.
- best-effort import 실패는 기존 Markdown/SQLite 데이터를 손상시키지 않아야 한다.
- 비공식 import 기능은 README와 UI에서 “experimental” 또는 “best effort”로 표시한다.

### 16.6 배포 전 체크리스트

- 제품명과 패키지명이 제3자 상표를 포함하지 않는다.
- README에 비제휴 고지, 저장 위치, 삭제 방법, 외부 전송 기본 비활성화, 공급자 약관 준수 안내가 있다.
- 공식 문서 링크는 최신이고, 인용은 짧은 요약과 링크 중심이다.
- hook installer가 기존 설정 파일을 백업하고, dry-run diff와 rollback을 제공한다.
- OAuth/session token을 읽거나 저장하지 않는다는 테스트가 있다.
- redaction, 삭제, export, 외부 분석 opt-in 동작이 acceptance test로 검증된다.

참고한 공개 공식 자료:

- Claude Code Legal and Compliance: https://code.claude.com/docs/en/legal-and-compliance
- Claude Code Data Usage: https://code.claude.com/docs/en/data-usage
- Anthropic Usage Policy: https://www.anthropic.com/legal/aup
- Anthropic Consumer Terms: https://www.anthropic.com/legal/consumer-terms
- OpenAI Usage Policies: https://openai.com/policies/usage-policies/
- OpenAI Brand Guidelines: https://openai.com/brand/
- OpenAI Services Agreement: https://openai.com/policies/services-agreement/

## 17. 개발 우선순위

1. 제품명/포지셔닝/README 정리
2. `NormalizedPromptEvent` 계약과 sample payload fixture 확정
3. ingest API, 인증, idempotency, redaction 계약 구현
4. 민감정보 탐지/마스킹 구현
5. Markdown 저장 포맷 v1 구현
6. SQLite 인덱스, FTS5, migration/versioning 구현
7. Claude Code hook 설치/제거/검증
8. `prompt-memory init`, `install-hook`, `uninstall-hook`, `doctor` 구현
9. CLI 목록/검색/상세/open 구현
10. 최소 웹 UI 목록/상세 구현
11. 삭제 API와 hard delete 정합성 구현
12. Codex beta adapter 구현
13. `doctor`, `rebuild-index`, storage reconciliation 구현
14. 규칙 기반 분석 preview 구현
15. 과거 transcript import 구현

## 18. 미해결 질문

- 외부 LLM 분석을 어느 provider부터 지원할지 결정해야 한다.
- raw 저장 모드를 MVP에 노출할지, 기본 마스킹 저장만 제공할지 결정해야 한다.
- MVP의 핵심 채택 경로를 웹 UI 중심으로 둘지, CLI-first로 둘지 결정해야 한다.
- 분석 기능을 MVP 핵심 가치로 둘지, 저장/검색 이후의 Phase 2 가치로 둘지 결정해야 한다.
- 사용자 프롬프트만 저장할 때 “결과가 좋았던/나빴던 프롬프트”를 어떤 신호로 판단할지 결정해야 한다.
- Markdown 파일명을 사용자가 커스터마이즈할 수 있게 할지 결정해야 한다.

## 19. MVP Acceptance Criteria

이 항목은 비즈니스 KPI가 아니라 개발 완료 판단 기준이다.

- 신규 사용자가 5분 안에 첫 프롬프트 저장에 성공한다.
- hook 설치 실패 시 `doctor`가 원인을 진단한다.
- 저장된 프롬프트를 CLI 또는 UI에서 3초 안에 검색할 수 있다.
- 사용자는 저장 위치, 삭제 방법, 외부 전송 여부를 온보딩 중 명확히 이해한다.
- 기존 Claude Code 설정 파일을 손상시키지 않는다.
- Codex beta adapter 설치 시 기존 Codex 설정 파일을 손상시키지 않는다.
- 서버가 꺼져 있어도 MVP 기준 도구의 원래 프롬프트 처리를 막지 않는다.
- 수집 API는 hook 전용 ingest token 없이는 prompt를 저장하지 않는다.
- 민감정보 마스킹 모드에서는 탐지된 raw secret이 Markdown, SQLite, 로그, 분석 결과에 저장되지 않는다.
- `redactionMode=mask`에서는 탐지된 raw secret뿐 아니라 raw 기반 hash, FTS text, preview, 분석 결과, 외부 전송 payload에도 secret이 남지 않는다.
- Markdown preview에서 raw HTML, 위험 URL scheme, 외부 리소스가 실행/로드되지 않는다.
- 외부 LLM 분석은 전역 opt-in, 프로젝트 opt-in, 건별 preview를 모두 통과한 경우에만 실행된다.
- `rebuild-index`로 Markdown 디렉터리에서 SQLite/FTS 인덱스를 재생성할 수 있다.
- 제품명, 패키지명, 로고, README가 OpenAI/Anthropic과의 공식 제휴를 암시하지 않는다.
- OAuth/session token을 추출, 저장, 재사용, 프록시하지 않는다.
