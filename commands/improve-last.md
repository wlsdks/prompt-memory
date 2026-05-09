---
description: Rewrite the latest captured prompt-memory request for approval (deterministic or agent-assisted)
allowed-tools: Bash, AskUserQuestion
---

# Improve Latest Prompt

This command rewrites the most recently captured prompt for the user's approval.
There are two modes — pick one before running anything.

## 1. Ask the user which mode to use

Use `AskUserQuestion` with these two options. Show them verbatim.

- **deterministic** — Local rewrite from prompt-memory's heuristic improver. No
  agent reasoning; reproducible; never sends prompt content out of the local
  process.
- **agent** — Use this active Claude Code session to semantically rewrite the
  prompt. prompt-memory hands you one locally redacted body, the local score,
  and a baseline draft. You rewrite, then ask the user before saving. Because
  the redacted packet is processed by this active provider session, the user's
  configured provider may see the redacted text.

If the user has no preference, default to **deterministic**.

## 2a. Deterministic mode

Prefer the MCP tool when it is available:

```text
prompt-memory:improve_prompt latest=true
```

Return the approval-ready draft, the changed sections, and the safety notes.
Make it clear that the draft is copy-based and must not be auto-submitted.

If MCP is not configured, use the privacy-safe CLI fallback:

```bash
prompt-memory improve --latest --json
```

## 2b. Agent mode

Prefer the MCP tools when they are available:

```text
prompt-memory:prepare_agent_rewrite latest=true
prompt-memory:record_agent_rewrite
```

`prepare_agent_rewrite` returns one locally redacted prompt, the local score
metadata, a local baseline draft, and a rewrite contract. Rewrite that redacted
prompt in this active Claude Code session, then ask the user before saving or
reusing the draft. Only call `record_agent_rewrite` after the user approves
saving the improved draft.

Summarize the result as:

- original local score
- what changed in the rewrite
- whether the rewrite is ready to paste
- one remaining risk or assumption
- whether the draft was saved with `record_agent_rewrite`

If MCP is not configured, say that agent mode needs the local
`prompt-memory mcp` server. Use `prompt-memory improve --latest --json` only as
the local deterministic fallback, and label it clearly as the fallback.

## Safety (both modes)

Do not auto-submit the rewrite. Do not call external providers through
prompt-memory. Do not ask for provider tokens. Do not print the stored original
prompt body, raw hook payloads, raw absolute paths, tokens, or secrets. If the
archive is empty, tell the user to capture one Claude Code or Codex prompt
first.
