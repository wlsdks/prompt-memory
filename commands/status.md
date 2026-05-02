---
description: Check prompt-memory capture health
allowed-tools: Bash
---

# Prompt Memory Status

First check that the CLI is installed:

```bash
command -v prompt-memory
```

If this returns nothing, report that the plugin is installed but the
`prompt-memory` CLI is not on `PATH` yet.

Run:

```bash
prompt-memory doctor claude-code
prompt-memory statusline claude-code
```

If Codex is installed, also run:

```bash
prompt-memory doctor codex
```

Report whether the local server is reachable, the hook is installed, and the
last ingest status is healthy. Do not print raw prompt bodies or raw hook
payloads.
