---
description: Check prompt-coach capture health
allowed-tools: Bash
---

# Prompt Memory Status

First check that the CLI is installed:

```bash
command -v prompt-coach
```

If this returns nothing, report that the plugin is installed but the
`prompt-coach` CLI is not on `PATH` yet.

Run:

```bash
prompt-coach doctor claude-code
prompt-coach statusline claude-code
```

If Codex is installed, also run:

```bash
prompt-coach doctor codex
```

Report whether the local server is reachable, the hook is installed, and the
MCP command access is registered. `doctor` may use read-only `mcp list`
fallbacks when config-file detection is inconclusive. Do not print raw prompt
bodies or raw hook payloads.
