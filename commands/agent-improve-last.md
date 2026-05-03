---
description: Rewrite the latest captured prompt with the active agent session
allowed-tools: Bash
---

# Agent Improve Latest Prompt

Prefer the MCP tools when they are available:

```text
prompt-memory:prepare_agent_rewrite latest=true
prompt-memory:record_agent_rewrite
```

Use this when the user wants Claude Code to semantically improve the latest
stored prompt, not just run the local deterministic rewrite. The first tool
returns one locally redacted prompt, local score metadata, a local baseline
draft, and a rewrite contract. Rewrite that redacted prompt in this active
Claude Code session, then ask the user before saving or reusing the draft.

Only call `record_agent_rewrite` after the user approves saving the improved
draft. Do not auto-submit the rewrite. Do not call external providers through
prompt-memory, ask for provider tokens, print raw prompt bodies, print raw
absolute paths, or restore redacted secrets.

Summarize the result as:

- original local score
- what changed in the rewrite
- whether the rewrite is ready to paste
- one remaining risk or assumption
- whether the draft was saved with `record_agent_rewrite`

If MCP is not configured, say that agent rewrite mode needs the local
`prompt-memory mcp` server. Use `prompt-memory improve --latest --json` only as
the local deterministic fallback, and label it clearly as the fallback.
