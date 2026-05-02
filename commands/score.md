---
description: Score accumulated prompt-memory habits
allowed-tools: Bash
---

# Prompt Memory Score

Prefer the MCP tool when it is available:

```text
prompt-memory:score_prompt_archive
```

If MCP is not configured, run:

```bash
prompt-memory score --json
```

Summarize the average archive score, recurring quality gaps, and the lowest
scoring prompt ids. Do not print raw prompt bodies, raw hook payloads, raw
absolute paths, tokens, or secrets.

If the user asks to focus on one tool, use:

```bash
prompt-memory score --tool claude-code --json
prompt-memory score --tool codex --json
```
