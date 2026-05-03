---
description: Review project AGENTS.md or CLAUDE.md rules for coding agents
allowed-tools: Bash
---

# Prompt Memory Rules

Prefer the MCP tool when it is available:

```text
prompt-memory:review_project_instructions latest=true
```

Summarize:

- the project instruction score and band
- which instruction files were found by file name only
- missing or weak rule areas
- the next concrete edit the user should make

Do not print instruction file bodies, raw absolute paths, prompt bodies, tokens,
or secrets.

If MCP is not configured, ask the user to register the local MCP server:

```bash
claude mcp add --transport stdio prompt-memory -- prompt-memory mcp
```
