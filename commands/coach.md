---
description: Run the full prompt-memory coach inside Claude Code
allowed-tools: Bash
---

# Prompt Memory Coach

Prefer the MCP tool when it is available:

```text
prompt-memory:coach_prompt
```

Use this as the default command when the user wants prompt coaching inside
Claude Code. It returns local readiness, latest prompt score, approval-required
rewrite, recent habit review, project AGENTS.md/CLAUDE.md review, and next
request guidance in one call.

If MCP is not configured, use the privacy-safe CLI fallback:

```bash
prompt-memory coach --json
```

Summarize the result as:

- latest prompt score and first fix
- approval-ready rewrite status
- recurring habit gap
- project rule issue if present
- next request template or next action

Do not print raw prompt bodies, raw hook payloads, raw absolute paths,
instruction file bodies, tokens, or secrets. Do not auto-submit rewritten
prompts.
