---
description: Summarize recent prompt-coach habits and recurring gaps
allowed-tools: Bash
---

# Prompt Memory Habits

Prefer the MCP tool when it is available:

```text
prompt-coach:score_prompt_archive max_prompts=200 low_score_limit=8
```

Summarize:

- archive score and trend signal if available
- top recurring quality gaps
- the highest priority practice rule
- low-score prompt ids that are safe to review
- the next prompt template if the user asks for a draft

If MCP is not configured, run:

```bash
prompt-coach score --json --limit 200 --low-score-limit 8
```

Do not print raw prompt bodies, raw hook payloads, raw absolute paths, tokens,
or secrets.
