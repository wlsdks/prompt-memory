# MCP Coach Loop Audit (2026-05-08)

환경: `/tmp/pm-audit-mcp-72858` (init 직후 빈 archive). `pnpm prompt-coach mcp` stdio JSON-RPC + CLI 미러. stdin EOF/SIGTERM에 깨끗하게 종료(exit 0, stderr 0줄).

## 도구 카탈로그 첫인상
`tools/list`는 13개 (사용자 인식 12개 + status). 즉시 이해: `score_prompt`, `improve_prompt`, `coach_prompt`, `score_prompt_archive`, `review_project_instructions`, `get_prompt_coach_status`. 모호: `apply_clarifications` / `record_clarifications` / `ask_clarifying_questions` 셋 — 이름이 비슷하고 description이 모두 "user's verbatim answers...clarifying_questions"로 시작해 호출 단계 구분이 어려움. `prepare_agent_*` / `record_agent_*` 페어는 "redacted packet" 도메인어 모르면 어렵다. `initialize.instructions`(1745자)가 ASK-FIRST 룰과 `coach_prompt` default를 강하게 깔아주는 점은 좋음.

## 흐름별 friction
| 심각도 | 도구/명령 | 입력 | 응답에서 부족한 것 | 막힘 지점 |
|---|---|---|---|---|
| High | CLI `score` | `--text "fix the bug"` | `--text` 미지원, archive aggregate + `--latest`만 | MCP `score_prompt(prompt)` 와 surface 불일치, "Did you mean --latest?"만 |
| High | CLI `improve` 사람 출력 | `--text "fix the bug"` | `clarifying_questions` 화면 미표시 (JSON에만) | ASK-FIRST가 제품 핵심인데 사람 사용자는 질문을 못 봄 |
| High | MCP `improve_prompt` ko | `language:"ko"`, 영어 원문 | 영어 원문을 한국어 `## 목표`에 그대로 박음. `## 검증`은 원문에 없는데 "원문에 명시된 검증 명령" 으로 거짓 단정 | 사용자가 복사 시 영어/한국어 mix + 거짓 verification 문구 |
| Med | MCP `score_prompt` | `prompt:""` | "exactly one of `prompt`,`prompt_id`,`latest`" — 빈 문자열을 falsy 처리 | "프롬프트가 비어있다"가 아니라 spec-level 메시지 |
| Med | MCP `improve_prompt` | `prompt:"a"` | 1글자도 통과해 풀 length draft 생성 | 빈 입력 거부 vs 1자 통과 임계 모호 |
| Med | MCP unknown tool | `name:"nonexistent_tool"` | `-32602 Unknown tool: ...`, 사용 가능 도구 hint 없음 | 모델이 오타 쳤을 때 추천 도구 부재 |
| Low | MCP schema | `unknown_field`, `score_prompt`에 `language:"xx"` | `additionalProperties:false`인데 검증 없이 통과 | 스펙/런타임 불일치, 향후 호환 함정 |
| Low | `coach_prompt` 빈 archive | `{}` | headline + 4 next_actions + suggested_user_response 모두 정상 | 막힘 없음 |

## CLI vs MCP 일관성
- MCP `score_prompt` (text/prompt_id/latest) ↔ CLI `score` (archive aggregate + `--latest`만): 같은 이름, 다른 contract.
- MCP `improve_prompt` `language` 지원, CLI `improve` 미지원.
- CLI `improve --text` 사람 출력에 `## Original prompt` 섹션이 raw text echo. MCP는 `returns_stored_prompt_body:false` 보장이지만 surface별 정책 다름.
- CLI `coach` 사람 출력은 우수: headline / next actions / agent commands / suggested response / privacy line 모두 표기, MCP `agent_brief` 1:1.

## 에러 응답 품질
- `not_found`(score/improve/review:latest 빈 archive)는 모두 "Capture a Claude Code/Codex prompt first" + "or call ... with a `prompt` text argument" 식 다음 행동 제시. **양호**.
- `invalid_input`은 spec 문구라 사용자 친화 낮음. 빈 문자열, 1자 같은 경계값 메시지 분리 필요.
- JSON-RPC unknown tool은 spec compliant이나 hint 부재.

## 종합

### Top 3 fix
1. **CLI `score --text` / `--language` 추가**: MCP `score_prompt(prompt)`와 surface 일치. 동시에 `improve --language` 추가.
2. **`improve_prompt` ko 출력에 원문 echo 금지 + 거짓 verification 문구 제거**: 영어 원문을 한국어 템플릿에 박지 말고 `<원문에서 추출한 목표>` 자리표시자 또는 `## 원문(검토용)` 별도 섹션. axis가 missing이면 본문을 "원문에 명시된" 으로 단정하지 말고 instruction tone("검증 명령을 1줄로 명시").
3. **CLI `improve` 사람 출력에 `clarifying_questions` 표시**: axis 라벨 + Q1/Q2 형식. ASK-FIRST를 사람 사용자가 볼 수 있도록.

### README/docs 추가
- `coach_prompt`를 default로 호출하라는 가이드는 `initialize.instructions`에는 있으나 `docs/PLUGINS.md`에는 없음. README "First 3-Minute Coach Loop" 다음 줄에 "MCP에서는 `coach_prompt`만 부르세요" 추가.
- `apply_clarifications` / `record_clarifications` / `ask_clarifying_questions` 셋의 사용 시점을 다이어그램(질문→답→저장) 1장으로 PLUGINS.md에 명시 — 도구 선택 비용 절감.
- 빈 archive 첫 사용자를 위해 `get_prompt_coach_status` → empty → `setup` 순서를 README Quick Start 최상단으로 끌어올리기.
