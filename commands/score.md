---
description: Score prompt-coach habits (latest prompt or accumulated archive)
allowed-tools: Bash
---

# Prompt Memory Score

This command covers both the latest captured prompt and the whole local
archive. Pick the scope based on the user's request.

## Latest captured prompt

Prefer the MCP tool when it is available:

```text
prompt-coach:score_prompt latest=true
```

Ask it to include concise suggestions and summarize:

- the score and band
- the missing or partial checklist items
- one concrete change the user should make before resubmitting

If MCP is not configured, use the privacy-safe CLI fallback:

```bash
prompt-coach score --latest --json
```

If no captured prompt exists yet, tell the user to run `prompt-coach setup`
and submit one Claude Code or Codex prompt first.

## Accumulated archive

Prefer the MCP tool when it is available:

```text
prompt-coach:score_prompt_archive
```

If MCP is not configured, run:

```bash
prompt-coach score --json
```

Summarize the average archive score, recurring quality gaps, and the lowest
scoring prompt ids.

If the user asks to focus on one tool, use:

```bash
prompt-coach score --tool claude-code --json
prompt-coach score --tool codex --json
```

## Safety

Do not print raw prompt bodies, raw hook payloads, raw absolute paths, tokens,
or secrets.
