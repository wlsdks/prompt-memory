---
description: Rewrite the latest captured prompt-coach request for approval (deterministic or agent-assisted)
allowed-tools: Bash, AskUserQuestion
---

# Improve Latest Prompt

This command rewrites the most recently captured prompt for the user's approval.
There are two modes — pick one before running anything.

## 1. Pick the rewrite mode

Default to **deterministic** mode and run it without asking. This matches the
historical UX — `/prompt-coach:improve-last` should produce a rewrite quickly
in the common case.

Only call `AskUserQuestion` when the user's request explicitly signals agent
intent — phrases like "agent", "rewrite with the active session", "have Claude
rewrite", "semantic rewrite", or asking for a more thoughtful rewrite than the
local heuristic. In that case, present these two options verbatim:

- **deterministic** — Local rewrite from prompt-coach's heuristic improver. No
  agent reasoning; reproducible; never sends prompt content out of the local
  process.
- **agent** — Use this active Claude Code session to semantically rewrite the
  prompt. prompt-coach hands you one locally redacted body, the local score,
  and a baseline draft. You rewrite, then ask the user before saving. Because
  the redacted packet is processed by this active provider session, the user's
  configured provider may see the redacted text.

## 2a. Deterministic mode

Prefer the MCP tool when it is available:

```text
prompt-coach:improve_prompt latest=true
```

Return the approval-ready draft, the changed sections, and the safety notes.
Make it clear that the draft is copy-based and must not be auto-submitted.

If MCP is not configured, use the privacy-safe CLI fallback:

```bash
prompt-coach improve --latest --json
```

## 2b. Agent mode

Prefer the MCP tools when they are available:

```text
prompt-coach:prepare_agent_rewrite latest=true
prompt-coach:record_agent_rewrite
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
`prompt-coach mcp` server. Use `prompt-coach improve --latest --json` only as
the local deterministic fallback, and label it clearly as the fallback.

## Safety (both modes)

Do not auto-submit the rewrite. Do not call external providers through
prompt-coach. Do not ask for provider tokens. Do not print the stored original
prompt body, raw hook payloads, raw absolute paths, tokens, or secrets. If the
archive is empty, tell the user to capture one Claude Code or Codex prompt
first.
