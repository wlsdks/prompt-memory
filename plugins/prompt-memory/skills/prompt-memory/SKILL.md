---
name: prompt-memory
description: Use when the user wants to install, verify, search, or troubleshoot the local prompt-memory archive for Codex or Claude Code prompts.
---

# Prompt Memory

Use this skill when the user wants Codex to work with the local `prompt-memory`
archive.

## What This Plugin Does

`prompt-memory` stores coding-agent prompts locally. It redacts sensitive values
before writing Markdown files, indexes the archive in SQLite, and exposes a
local web UI at `http://127.0.0.1:17373`.

The plugin hook is fail-open and expects the `prompt-memory` CLI to be available
on `PATH`. For the most reliable local setup, run the explicit setup command
from the installed package:

```sh
prompt-memory setup
```

When working from this repository during development, build first and use the
repo script:

```sh
pnpm build
pnpm prompt-memory setup
```

## Common Checks

Check Codex capture:

```sh
prompt-memory doctor codex
```

Check Claude Code capture:

```sh
prompt-memory doctor claude-code
```

Open the web archive:

```sh
prompt-memory server
```

Then visit `http://127.0.0.1:17373`.

## Safety Rules

- Do not print raw prompt bodies or raw hook payloads unless the user explicitly
  asks for them.
- Prefer `doctor`, `list`, `search`, and `show <id>` over reading SQLite or
  Markdown internals directly.
- If a hook fails, keep the agent workflow unblocked and report the setup issue.
- Do not add external LLM calls. The archive and rule-based analysis are local.
