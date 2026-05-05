# MCP Tool Inventory (prompt-memory)

The stdio MCP server (`prompt-memory mcp`) exposes 10 tools. All read tools are local-only and return structured JSON metadata via MCP `outputSchema` plus a text JSON fallback. Archive-backed tools never return stored prompt bodies, raw absolute paths, secrets, or hidden external LLM results.

## Read tools
| Tool | Purpose |
|---|---|
| `get_prompt_memory_status` | Local archive readiness, capture state, suggested next tool |
| `coach_prompt` | One-call agent workflow: status + latest score + redacted rewrite + recent habits + project review + next-prompt guidance |
| `score_prompt` | Score direct text, stored `prompt_id`, or latest stored prompt |
| `improve_prompt` | Approval-ready improved draft for direct text / `prompt_id` / latest |
| `prepare_agent_rewrite` | One redacted prompt packet + score metadata + baseline draft + rewrite contract for the active CLI session |
| `score_prompt_archive` | Aggregate score + recurring gaps + practice plan + next prompt template + low-score ids |
| `review_project_instructions` | Local rubric for `AGENTS.md` / `CLAUDE.md` |
| `prepare_agent_judge_batch` | Bounded redacted prompt packet + rubric for the active CLI session to judge |

## Write tools (non-destructive)
| Tool | Purpose |
|---|---|
| `record_agent_rewrite` | Save agent-produced rewrite as a redacted improvement draft after user approval (does not echo body) |
| `record_agent_judgments` | Store advisory scores + notes from the active agent session (no prompt body, no raw path) |

## Module split (do not collapse)
- Definitions / JSON schemas: `score-tool-definitions.ts`, `agent-rewrite-tool-definitions.ts`, `agent-judge-tool-definitions.ts`
- Argument / result contracts: `*-tool-types.ts`
- Handler orchestration: `*-tool.ts`
- JSON-RPC routing: `server.ts`

## Privacy contract
- Agent-judge packets are the only path that returns redacted prompt bodies, and only when explicitly requested.
- `prompt-memory` does not extract, store, or proxy any provider tokens (Claude.ai OAuth, Claude Code internal auth, OpenAI/Codex/ChatGPT session tokens, Gemini keys).
- `prepare_agent_rewrite` / `prepare_agent_judge_batch` rely on the user's already-authenticated CLI session as the rewriter / evaluator.
