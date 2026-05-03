---
description: Score the latest captured prompt-memory request
allowed-tools: Bash
---

# Score Latest Prompt

Prefer the MCP tool when it is available:

```text
prompt-memory:score_prompt latest=true
```

Ask it to include concise suggestions and summarize:

- the score and band
- the missing or partial checklist items
- one concrete change the user should make before resubmitting

If MCP is not configured, use the privacy-safe CLI fallback:

```bash
prompt-memory score --latest --json
```

Do not print raw prompt bodies, raw hook payloads, raw absolute paths, tokens,
or secrets. If no captured prompt exists yet, tell the user to run
`prompt-memory setup` and submit one Claude Code or Codex prompt first.
