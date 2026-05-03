---
description: Rewrite the latest captured prompt-memory request for approval
allowed-tools: Bash
---

# Improve Latest Prompt

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

Do not print the stored original prompt body, raw hook payloads, raw absolute
paths, tokens, or secrets. If the archive is empty, tell the user to capture one
Claude Code or Codex prompt first.
