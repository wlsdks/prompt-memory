# prompt-memory Technical Specification

작성일: 2026-05-01  
상태: Implementation Ready  
관련 문서: [PRD.md](./PRD.md)

## 1. 목적

이 문서는 `prompt-memory` MVP를 구현하기 위한 기술 설계서다. `prompt-memory`의 제품 정체성은 "AI coding prompt memory and improvement workspace, local-first"이며, Claude Code, Codex 같은 AI 코딩 도구에 입력한 프롬프트를 로컬에 안전하게 기록하고, 다시 찾고, 분석하고, 다음 요청을 더 잘 쓰도록 돕는 developer tool이다.

PRD가 제품 요구사항과 정책 경계를 정의한다면, 이 문서는 코드 구조, API 계약, 저장소 스키마, 보안 흐름, hook adapter 구현 기준을 정의한다.

MVP core의 구현 목표는 다음이다.

- Claude Code `UserPromptSubmit` hook으로 사용자의 prompt를 안정적으로 수집한다.
- 저장 전 redaction을 적용한다.
- prompt를 Markdown 파일로 저장하고 SQLite로 색인한다.
- CLI와 최소 웹 UI에서 저장된 prompt를 조회/검색/삭제한다.
- local rule 기반 분석과 copy-based Prompt Coach로 사용자의 반복적인 약한 prompting 패턴을 드러내고 다음 요청 개선을 돕는다.
- 서버가 꺼져 있거나 hook이 실패해도 원래 AI 도구 사용 흐름을 막지 않는다.
- 첫 public beta release에는 Codex adapter를 같은 계약을 검증하는 beta 범위로 포함한다.

## 2. 기술 스택

### 2.1 선택안

MVP는 단일 TypeScript 패키지로 시작한다.

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 언어 | TypeScript | CLI, server, web, adapter 타입을 한 언어로 공유한다. |
| 런타임 | Node.js 22/24 LTS | npm 배포와 native dependency 호환성을 명확히 하기 위해 지원 major를 고정한다. `engines.node`는 `>=22 <25`로 시작하고 CI는 Node 22/24에서 실행한다. |
| 패키지 매니저 | pnpm | workspace 전환이 쉽고 lockfile이 명확하다. |
| CLI | Commander | 명령 구조가 단순하고 설치/doctor 명령 구현에 충분하다. |
| HTTP server | Fastify | schema validation, plugin 구조, 낮은 오버헤드가 로컬 서버에 적합하다. |
| DB | SQLite | 로컬 우선, 단일 파일, 백업/재색인이 쉽다. |
| DB driver | better-sqlite3 | MVP는 동기 transaction이 단순하고 로컬 단일 사용자 쓰기 패턴에 적합하다. native dependency이므로 로컬 smoke test를 P0에서 수행하고, npm publish 전 macOS x64/arm64, Linux x64/arm64, Windows x64에서 install/open/FTS5/WAL smoke test를 통과해야 한다. 실패 시 sql.js 또는 Node 내장 SQLite 계열 대안을 재검토한다. |
| Query | 직접 SQL + 작은 repository layer | 초기에는 ORM보다 DDL과 migration을 명확히 유지한다. |
| Web UI | Vite + React | 로컬 UI 구현이 빠르고 빌드 결과를 server에서 정적 제공하기 쉽다. |
| Markdown parsing | gray-matter | frontmatter와 body 분리가 명확하다. |
| Markdown rendering | react-markdown + rehype-sanitize | raw HTML 비활성화와 allowlist 기반 preview 구현에 적합하다. |
| Validation | Zod | hook payload, config, API request 타입 검증에 사용한다. |
| Testing | Vitest | TypeScript 단위 테스트와 fixture 테스트에 적합하다. |

### 2.2 선택하지 않는 것

- Electron: MVP에는 과하다. 로컬 서버 + 브라우저 UI로 충분하다.
- Next.js: 서버 렌더링, 배포 기능이 불필요하다.
- Prisma/대형 ORM: migration과 raw SQL 통제가 더 중요하다.
- Cloud sync: PRD 범위 밖이다.
- 외부 LLM 분석: MVP 완료 기준이 아니다.

### 2.3 확정 결정

- `raw` 저장 모드는 MVP UI에 노출하지 않고 config-only로 둔다.
- 웹 UI 인증은 local session cookie를 기본으로 한다.
- CLI/API 자동화는 app token을 사용한다.
- hook ingest는 별도 ingest token을 사용한다.
- MVP 배포 대상은 npm package다.
- GitHub release binary는 Phase 2 이후 검토한다.
- SQLite driver는 `better-sqlite3`으로 시작하되, P0에서는 현재 개발 머신 smoke test를 통과하고 P8 release readiness에서 macOS/Linux/Windows CI matrix를 통과해야 한다.
- Vite는 devDependency로 둔다.
- npm package에는 built CLI files와 built web assets를 포함하고, 런타임 설치에 Vite가 필요하지 않게 한다.

## 3. 저장 위치

기본 저장 위치는 사용자 홈 디렉터리 아래다.

```text
~/.prompt-memory/
  config.json
  hook-auth.json
  prompt-memory.sqlite
  prompts/
    2026/
      05/
        01/
          20260501-103000-claude-code-prmt_ab12cd.md
  logs/
    diagnostic.log
  quarantine/
  spool/
```

권한 요구사항:

- directory: owner-only
- files: owner-only
- Windows는 POSIX mode 대신 ACL 기반 owner-only 권한으로 검사한다.

## 4. 프로젝트 구조

초기 구현은 단일 package 안에서 모듈을 분리한다. 필요해지면 이후 workspace로 나눈다.

```text
prompt-memory/
  package.json
  tsconfig.json
  src/
    cli/
      index.ts
      commands/
        init.ts
        server.ts
        install-hook.ts
        uninstall-hook.ts
        doctor.ts
        list.ts
        search.ts
        show.ts
        open.ts
        rebuild-index.ts
    server/
      create-server.ts
      routes/
        ingest.ts
        prompts.ts
        settings.ts
        health.ts
      auth.ts
      errors.ts
    adapters/
      types.ts
      claude-code.ts
      codex.ts
      fixtures/
        claude-code-user-prompt-submit.json
        codex-user-prompt-submit.json
    redaction/
      redact.ts
      detectors.ts
      types.ts
    storage/
      paths.ts
      markdown.ts
      sqlite.ts
      migrations/
        001_initial.sql
      repositories/
        prompts.ts
        projects.ts
        sessions.ts
        settings.ts
    hooks/
      wrapper.ts
      post-to-server.ts
    web/
      index.html
      src/
        App.tsx
        api.ts
        routes/
          PromptList.tsx
          PromptDetail.tsx
          Settings.tsx
    shared/
      schema.ts
      ids.ts
      time.ts
      hashing.ts
  docs/
    PRD.md
    TECH_SPEC.md
```

## 5. 주요 흐름

### 5.1 Ingest flow

```text
Claude Code UserPromptSubmit
  -> hook wrapper
  -> POST /api/v1/ingest/claude-code
  -> auth
  -> payload validation
  -> adapter normalize
  -> path/capture exclusion
  -> redaction
  -> idempotency check
  -> markdown write
  -> sqlite index
  -> empty hook output
```

중요한 규칙:

- hook wrapper는 stdout을 비운다.
- 실패해도 AI 도구 실행을 막지 않는다.
- raw prompt는 일반 로그에 남기지 않는다.
- `redactionMode=mask`에서는 raw prompt 기반 hash를 저장하지 않는다.

### 5.2 Read/search flow

```text
CLI/Web
  -> GET /api/v1/prompts
  -> SQLite metadata + FTS query
  -> list item response
  -> GET /api/v1/prompts/:id
  -> read Markdown body
  -> render sanitized Markdown in UI
```

### 5.3 Delete flow

```text
DELETE /api/v1/prompts/:id
  -> auth + CSRF/same-origin check
  -> SQLite transaction
  -> delete prompt-related rows
  -> delete Markdown file
  -> remove FTS row
  -> return deletion result
```

삭제 실패 시:

- DB row만 남으면 `missing_file` 또는 reconciliation 대상이 된다.
- Markdown만 남으면 `rebuild-index`가 재색인하거나 삭제 후보로 표시한다.

## 6. Shared Types

### 6.1 NormalizedPromptEvent

```ts
type ToolName = "claude-code" | "codex" | "manual" | "unknown";

type NormalizedPromptEvent = {
  tool: ToolName;
  source_event: "UserPromptSubmit" | string;
  prompt: string;
  session_id: string;
  cwd: string;
  created_at: string;
  received_at: string;
  idempotency_key: string;
  raw_event_hash?: string; // redactionMode=raw에서만 영속 저장 가능
  adapter_version: string;
  schema_version: number;

  turn_id?: string;
  transcript_path?: string;
  project_root?: string;
  git_branch?: string;
  model?: string;
  permission_mode?: string;
  agent_id?: string;
  agent_type?: string;
  raw_metadata?: Record<string, unknown>;
};
```

### 6.2 StoredPrompt

```ts
type StoredPrompt = {
  id: string;
  tool: ToolName;
  source_event: string;
  project_id?: string;
  session_id: string;
  turn_id?: string;
  cwd: string;
  project_root?: string;
  git_branch?: string;
  model?: string;
  permission_mode?: string;
  created_at: string;
  received_at: string;
  markdown_path: string;
  stored_content_hash: string;
  raw_content_hash?: string; // redactionMode=raw에서만 영속 저장 가능
  prompt_length: number;
  is_sensitive: boolean;
  excluded_from_analysis: boolean;
  redaction_policy: "mask" | "raw" | "reject";
  adapter_version: string;
  index_status: "indexed" | "missing_file" | "hash_mismatch" | "corrupt_frontmatter";
};
```

### 6.3 RedactionResult

```ts
type RedactionResult = {
  policy: "mask" | "raw" | "reject";
  stored_text: string;
  is_sensitive: boolean;
  findings: Array<{
    detector_type: string;
    range_start: number;
    range_end: number;
    replacement?: string;
  }>;
};
```

## 7. API 설계

### 7.1 공통 규칙

- Base path: `/api/v1`
- Request/response: JSON
- Error format: RFC 7807 `application/problem+json`
- Auth:
  - ingest API: ingest token
  - CLI read/write/settings API: app token
  - Web UI read/write/settings API: local session cookie + CSRF protection
- Collection pagination:
  - `limit`: default 50, max 100
  - `cursor`: opaque cursor
- Timestamps: ISO 8601 string
- Naming: snake_case

### 7.2 로컬 서버 보안

- 서버는 기본적으로 `127.0.0.1`에만 bind한다.
- `0.0.0.0` 또는 외부 bind는 명시 설정과 CLI 경고가 있을 때만 허용한다.
- 모든 API 요청은 `Host`가 허용된 loopback host/port인지 검증한다.
- 브라우저 요청은 `Origin`과 `Sec-Fetch-Site`를 검증한다.
- 기본 CORS 정책은 deny-all이다.
- 수집/조회/변경 API에는 최대 body size, prompt length, query length, rate limit을 적용한다.
- HTTP logger는 request/response body와 `Authorization`, cookie, CSRF token header를 기록하지 않는다.
- validation error는 field name과 error code만 기록하고 rejected value는 기록하지 않는다.
- diagnostic log에는 prompt body, token, raw metadata 원문, 외부 API key를 기록하지 않는다.

### 7.3 Web session and CSRF

- 웹 세션 쿠키는 `HttpOnly`, `SameSite=Strict`, `Path=/`로 발급한다.
- loopback HTTP 환경에서는 `Secure=false`, HTTPS 사용 시 `Secure=true`로 발급한다.
- 모든 state-changing 요청(`POST`, `PATCH`, `DELETE`)은 세션 쿠키 외에 CSRF token header를 요구하거나, `Origin`/`Sec-Fetch-Site` 기반 same-origin 검증을 통과해야 한다.
- ingest bearer token 요청은 cookie auth와 분리하며 CSRF 대상이 아니다.

### 7.4 Error response

```json
{
  "type": "https://prompt-memory.local/errors/validation-error",
  "title": "Validation Error",
  "status": 422,
  "detail": "The request payload is invalid.",
  "instance": "/api/v1/ingest/claude-code",
  "errors": [
    { "field": "prompt", "message": "Required" }
  ]
}
```

### 7.5 Endpoints

#### `GET /api/v1/health`

서버 상태 확인.

Response:

```json
{
  "ok": true,
  "version": "0.0.0",
  "data_dir": "~/.prompt-memory"
}
```

#### `POST /api/v1/ingest/claude-code`

Claude Code hook payload 수집.

Headers:

```text
Authorization: Bearer <ingest_token>
Content-Type: application/json
```

Request:

```json
{
  "session_id": "abc",
  "transcript_path": "/Users/user/.claude/projects/example/session.jsonl",
  "cwd": "/Users/user/project",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "사용자 프롬프트"
}
```

Response:

```json
{
  "data": {
    "id": "prmt_01hx...",
    "stored": true,
    "duplicate": false,
    "redacted": false
  }
}
```

#### `POST /api/v1/ingest/codex`

Codex command hook payload 수집. Codex beta adapter용이다.

Request:

```json
{
  "session_id": "abc",
  "turn_id": "turn_123",
  "transcript_path": "/Users/user/.codex/sessions/example.jsonl",
  "cwd": "/Users/user/project",
  "hook_event_name": "UserPromptSubmit",
  "model": "gpt-5.5",
  "prompt": "사용자 프롬프트"
}
```

Response shape는 Claude Code ingest와 동일하다.

#### `GET /api/v1/prompts`

Prompt 목록 조회.

Query:

- `q`
- `tool`
- `project_id`
- `from`
- `to`
- `tag`
- `limit`
- `cursor`

Response:

```json
{
  "data": [
    {
      "id": "prmt_01hx...",
      "tool": "claude-code",
      "project_name": "prompt-memory",
      "created_at": "2026-05-01T10:30:00+09:00",
      "prompt_length": 1240,
      "snippet": "마스킹 정책이 적용된 snippet",
      "is_sensitive": false,
      "analysis_status": "pending"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false
  }
}
```

#### `GET /api/v1/prompts/:id`

Prompt 상세 조회.

Response:

```json
{
  "data": {
    "id": "prmt_01hx...",
    "metadata": {
      "tool": "claude-code",
      "source_event": "UserPromptSubmit",
      "cwd": "/Users/user/project",
      "created_at": "2026-05-01T10:30:00+09:00"
    },
    "markdown_body": "저장 정책이 적용된 프롬프트 본문",
    "analysis_preview": {
      "summary": "요청 목적은 명확하지만 완료 기준이 부족합니다.",
      "warnings": ["검증 기준이 없습니다."],
      "suggestions": ["원하는 출력 형식을 추가하세요."]
    }
  }
}
```

#### `DELETE /api/v1/prompts/:id`

Prompt hard delete.

Response:

```json
{
  "data": {
    "id": "prmt_01hx...",
    "deleted": true
  }
}
```

#### `GET /api/v1/settings`

설정 조회. secret 값은 반환하지 않는다.

#### `PATCH /api/v1/settings`

설정 변경. 외부 분석 opt-in, redaction mode, disabled projects 등을 변경한다.

## 8. SQLite Schema

### 8.1 Migration policy

- `schema_migrations` 테이블로 적용된 migration을 기록한다.
- migration은 순차 적용만 허용한다.
- 앱 시작 시 migration이 실패하면 서버는 ingest를 받지 않고 `doctor` 안내를 반환한다.

### 8.2 Initial DDL

```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  repo_url TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(root_path)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  project_id TEXT,
  transcript_path TEXT,
  started_at TEXT,
  ended_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE prompts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  stored_content_hash TEXT NOT NULL,
  raw_content_hash TEXT,
  tool TEXT NOT NULL,
  source_event TEXT NOT NULL,
  project_id TEXT,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  transcript_path TEXT,
  cwd TEXT NOT NULL,
  project_root TEXT,
  git_branch TEXT,
  model TEXT,
  permission_mode TEXT,
  created_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  markdown_path TEXT NOT NULL,
  markdown_schema_version INTEGER NOT NULL,
  markdown_mtime INTEGER,
  markdown_size INTEGER,
  prompt_length INTEGER NOT NULL,
  is_sensitive INTEGER NOT NULL DEFAULT 0,
  excluded_from_analysis INTEGER NOT NULL DEFAULT 0,
  redaction_policy TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  raw_event_hash TEXT,
  raw_metadata_json TEXT,
  index_status TEXT NOT NULL DEFAULT 'indexed',
  deleted_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id)
);

CREATE TABLE prompt_analyses (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  summary TEXT,
  warnings_json TEXT,
  suggestions_json TEXT,
  analyzer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE prompt_tags (
  prompt_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY(prompt_id, tag_id),
  FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE redaction_events (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  detector_type TEXT NOT NULL,
  range_start INTEGER NOT NULL,
  range_end INTEGER NOT NULL,
  policy TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE prompt_fts USING fts5(
  prompt_id UNINDEXED,
  body,
  snippet,
  project_name,
  tags
);
```

### 8.3 Indexes

```sql
CREATE INDEX idx_prompts_created_at ON prompts(created_at DESC);
CREATE INDEX idx_prompts_tool ON prompts(tool);
CREATE INDEX idx_prompts_project_id ON prompts(project_id);
CREATE INDEX idx_prompts_session_id ON prompts(session_id);
CREATE INDEX idx_prompts_index_status ON prompts(index_status);
```

### 8.4 FTS safety

- FTS query는 사용자 입력을 그대로 SQL/FTS expression으로 삽입하지 않고 parameter binding과 FTS escaping을 적용한다.
- 검색어 길이와 토큰 수를 제한한다.
- 비정상 FTS syntax는 validation error로 반환한다.
- `rebuild-index`는 Markdown 본문을 다시 redaction 검증한 뒤 FTS에 넣는다.
- `rebuild-index` 중 raw secret이 감지되면 해당 파일을 `hash_mismatch` 또는 `quarantine` 대상으로 표시한다.

## 9. Markdown Schema v1

### 9.1 Frontmatter fields

필수:

- `schema_version`
- `id`
- `idempotency_key`
- `tool`
- `source_event`
- `session_id`
- `cwd`
- `created_at`
- `received_at`
- `prompt_length`
- `stored_content_hash`
- `redaction_policy`
- `adapter_version`

선택:

- `turn_id`
- `transcript_path`
- `project_name`
- `project_root`
- `git_branch`
- `model`
- `permission_mode`
- `tags`
- `analysis_status`
- `is_sensitive`
- `excluded_from_analysis`

### 9.2 File naming

```text
YYYYMMDD-HHMMSS-{tool}-{prompt_id}.md
```

예:

```text
20260501-103000-claude-code-prmt_01hx.md
```

파일명에는 raw prompt 내용을 넣지 않는다.

## 10. Redaction

### 10.1 Detector categories

MVP detector:

- API key style token
- Bearer token
- JWT
- private key block
- SSH key block
- cloud credential patterns
- database URL
- webhook URL
- email
- phone number

### 10.2 Policy

`mask`:

- 기본값이다.
- detector가 찾은 값은 `[REDACTED:<detector_type>]`으로 치환한다.
- raw secret, raw prompt hash, raw event hash를 영속 저장하지 않는다.
- raw prompt 또는 raw event payload 기반 hash가 필요한 경우 request 처리 중 transient 값으로만 사용하고 로그/DB/Markdown/FTS/recovery queue에는 기록하지 않는다.

`raw`:

- 사용자가 명시적으로 켠 경우에만 가능하다.
- UI와 README에 강한 경고를 표시한다.

`reject`:

- 민감정보가 감지되면 저장하지 않는다.
- hook은 fail-open으로 종료한다.

## 11. Hook 구현

### 11.1 Hook wrapper 원칙

- stdin JSON을 읽는다.
- token file에서 ingest token을 읽는다.
- 짧은 timeout으로 로컬 서버에 POST한다.
- 성공/실패와 무관하게 stdout을 비운다.
- raw prompt를 stderr/log에 쓰지 않는다.
- 서버 미실행 시 0 exit로 종료한다.

### 11.2 Token management

- `prompt-memory init`은 app token, ingest token, web session secret을 생성한다.
- token과 session secret은 owner-only 권한 파일에 저장한다.
- hook wrapper는 ingest token만 읽는다.
- app token은 CLI 자동화용으로만 사용한다.
- web session secret은 cookie signing 또는 session validation에만 사용한다.
- `uninstall-hook`은 해당 hook 전용 ingest token 폐기를 지원한다.
- token rotation은 Phase 2 기능으로 둔다.

### 11.3 Claude Code install target

우선순위:

1. user-level 설정
2. project-local 설정은 사용자가 명시한 경우만

설치기는 다음을 제공한다.

- `--dry-run`
- backup file
- structural merge
- uninstall
- duplicate detection

### 11.4 Codex beta install target

- user-level 설정을 기본 대상으로 한다.
- `[features].codex_hooks = true`가 필요한 경우 diff에 포함한다.
- project-local `.codex/` hook은 trust 상태를 `doctor`에서 별도 진단한다.

## 12. CLI Specification

### 12.1 Commands

```sh
prompt-memory init
prompt-memory server
prompt-memory install-hook claude-code [--dry-run] [--project]
prompt-memory install-hook codex [--dry-run] [--project]
prompt-memory uninstall-hook claude-code
prompt-memory uninstall-hook codex
prompt-memory doctor
prompt-memory list [--tool] [--project] [--limit]
prompt-memory search <query>
prompt-memory show <prompt_id>
prompt-memory delete <prompt_id>
prompt-memory open
prompt-memory rebuild-index
```

### 12.2 Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | General failure |
| 2 | Validation error |
| 3 | Configuration error |
| 4 | Permission error |
| 5 | Storage error |

Hook wrapper는 서버 미실행, timeout, ingest 실패 상황에서도 기본적으로 `0`을 반환한다.

## 13. Web UI

MVP 화면:

- Prompt list
- Prompt detail
- Settings

### 13.1 Prompt list

기능:

- 최신순 목록
- 검색어 입력
- tool 필터
- project 필터
- 날짜 필터
- sensitive 표시

### 13.2 Prompt detail

기능:

- 저장 본문 Markdown preview
- metadata 표시
- analysis preview 표시
- delete 버튼

보안:

- raw HTML 비활성화
- 위험 URL scheme 차단
- 외부 리소스 차단
- CSP 적용: `default-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'`

## 14. 삭제와 복구 한계

- MVP의 hard delete는 애플리케이션 레벨 삭제를 의미하며, 파일시스템/SSD forensic recovery까지 보장하지 않는다.
- 삭제는 Markdown, SQLite row, FTS row, 분석 결과, 태그 링크, redaction event, spool/quarantine/recovery queue의 해당 prompt 참조를 제거해야 한다.
- 삭제 후 SQLite WAL checkpoint를 수행한다.
- 보안 삭제 보장은 README에 한계로 명시한다.

## 15. Test Plan

### 15.1 Unit tests

- adapter normalization
- redaction detectors
- idempotency key generation
- Markdown frontmatter serialization
- SQLite repository methods
- API schema validation
- CLI argument parsing

### 15.2 Integration tests

- Claude Code fixture ingest
- duplicate ingest
- mask mode storage
- reject mode storage
- search index update
- prompt delete
- rebuild-index
- doctor checks

### 15.3 Security tests

- unauthenticated ingest rejected
- wrong ingest token rejected
- raw prompt not logged
- redacted secret absent from Markdown/SQLite/FTS
- Markdown XSS payload not rendered
- dangerous URL scheme blocked
- hook command does not include token
- HTTP logger does not record request body or auth headers
- FTS query escaping rejects malformed expressions safely
- delete removes prompt references from Markdown, SQLite, FTS, redaction events, and queues

## 16. Implementation Milestones

### P0: Project skeleton

- package setup
- TypeScript config
- lint/test scripts
- basic CLI entry
- Node 22/24 engine and CI target
- current-machine `better-sqlite3` WAL/FTS5 smoke test

### P1: Core contracts and bootstrap

- `NormalizedPromptEvent`
- adapter fixtures
- config schema
- `prompt-memory init`
- app token, ingest token, web session secret
- ID/hash utilities

### P2: Claude ingest and redaction

- Fastify server
- auth
- Claude Code ingest route
- redaction pipeline
- storage boundary with mocked storage
- local server security controls

### P3: Storage

- Markdown writer
- SQLite migrations
- repositories
- FTS index
- duplicate handling
- Claude ingest persistence integration

### P4: Claude Code integration

- hook wrapper
- install/uninstall
- dry-run diff
- doctor checks

### P5: Read/delete API and CLI

- prompt read/delete API
- list/search/show/delete/open
- hard delete consistency
- rebuild-index

### P6: Web UI

- prompt list
- prompt detail
- settings
- sanitized Markdown preview

### P7: Codex beta

- codex adapter
- codex ingest route
- codex install/uninstall
- codex fixture tests

### P8: Hardening

- release CI matrix
- package dry-run verification
- cross-platform `better-sqlite3` install/open/WAL/FTS5 smoke
- privacy/security release documentation

## 17. Open Questions

- Phase 2에서 GitHub release binary를 제공할지 결정해야 한다.
- Phase 2에서 외부 LLM 분석 provider를 어느 순서로 지원할지 결정해야 한다.
- Phase 2에서 transcript import UI를 CLI-only로 둘지 web에서도 제공할지 결정해야 한다.
