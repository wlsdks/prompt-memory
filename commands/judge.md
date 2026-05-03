---
description: Judge low-scoring prompts with the active agent session
allowed-tools: Bash
---

# Prompt Memory Agent Judge

Prefer the MCP tools when they are available:

```text
prompt-memory:prepare_agent_judge_batch selection=low_score max_prompts=5
prompt-memory:record_agent_judgments
```

Use this when the user explicitly asks Claude Code to judge accumulated prompt
quality, not just run the local deterministic score. The first tool returns a
bounded packet of locally redacted prompt bodies, local scores, quality gaps,
and a rubric. Evaluate those redacted prompts in this active Claude Code
session, then call `record_agent_judgments` with one score per `prompt_id`.

Do not call external providers through prompt-memory. Do not ask for provider
tokens. Do not print raw prompt bodies, raw absolute paths, raw hook payloads,
tokens, or secrets. The judgment is advisory and should be summarized alongside
the local score.

Summarize the result as:

- how many prompts were judged
- average agent judgment score
- strongest recurring issue
- one concrete practice rule for the next request
- whether any prompt should be rewritten before reuse

If MCP is not configured, say that agent-judge mode needs the local
`prompt-memory mcp` server. Do not emulate it by manually reading Markdown
archives unless the user explicitly asks for raw local file inspection.

