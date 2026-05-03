# Plugin Packaging

`prompt-memory` supports two integration layers:

- an explicit setup command that installs hooks and, where supported, a local
  server service
- packaging artifacts that let coding agents discover the integration as a
  plugin or reusable workflow

## Why Setup Is Still Required

Installing a package should not silently edit user-level agent settings, install
login services, or start a background server. `prompt-memory setup` is the
consent step that performs those local changes.

The plugin package is therefore discovery and convenience, not hidden
installation. Users should still run:

```sh
prompt-memory setup
```

Use a preview first when reviewing changes:

```sh
prompt-memory setup --dry-run
```

## Codex Plugin

The repo-local Codex plugin lives in:

```text
plugins/prompt-memory
```

It includes:

- `.codex-plugin/plugin.json` for plugin metadata
- `hooks.json` for a fail-open Codex `UserPromptSubmit` hook
- `skills/prompt-memory/SKILL.md` so Codex can help install, diagnose, and use
  the archive

The plugin hook expects `prompt-memory` to be available on `PATH`. This keeps the
plugin portable, but it means `prompt-memory setup` remains the reliable path for
normal users because setup records an absolute CLI command and can configure the
local service.

## Claude Code Plugin

Claude Code can consume this repository as a plugin marketplace:

```text
/plugin marketplace add wlsdks/prompt-memory
/plugin install prompt-memory
/reload-plugins
/prompt-memory:setup
```

The Claude Code plugin files live in:

```text
.claude-plugin
commands
```

The plugin exposes:

- `/prompt-memory:setup` to preview and run local setup
- `/prompt-memory:status` to run doctor and statusLine checks
- `/prompt-memory:score` to score accumulated prompt habits
- `/prompt-memory:score-last` to score the latest captured request
- `/prompt-memory:improve-last` to generate an approval-ready rewrite for the
  latest captured request
- `/prompt-memory:habits` to summarize recurring prompt habit gaps
- `/prompt-memory:rules` to review project `AGENTS.md` / `CLAUDE.md` quality
- `/prompt-memory:coach-next` to create the next better request template
- `/prompt-memory:open` to open the local archive

Prompt capture still uses Claude Code hook configuration in settings files. The
supported install paths are:

```sh
prompt-memory setup
prompt-memory install-hook claude-code
```

The plugin can also install an optional Claude Code status line:

```sh
prompt-memory install-statusline claude-code
prompt-memory statusline claude-code
```

This status line reports capture readiness, server health, and the last ingest
status. Claude Code supports one `statusLine` command, so installing it may
replace another status line such as a HUD. The setup command must ask before
installing it.

For manual configuration, see:

```text
integrations/claude-code/settings.example.json
```

That example is intentionally PATH-based. The installer is preferred because it
uses the exact CLI path from the current installation.

## MCP Prompt Scoring

`prompt-memory` also ships a local stdio MCP server:

```sh
prompt-memory mcp
```

This server exposes five model-controlled tools:

- `get_prompt_memory_status`
- `score_prompt`
- `improve_prompt`
- `score_prompt_archive`
- `review_project_instructions`

`get_prompt_memory_status` checks local archive readiness and returns safe
counts, latest prompt metadata, available tool names, and next actions.
`score_prompt` scores direct prompt text, a stored prompt id, or the latest
stored prompt with the same local deterministic `0-100` Prompt Quality Score
used by the web UI. `improve_prompt` returns an approval-ready copy-based
rewrite draft for direct prompt text, a stored prompt id, or the latest stored
prompt. `score_prompt_archive` scores accumulated prompt habits across recent
stored prompts and returns aggregate score, recurring gaps, a practice plan, a
next prompt template, and low-score prompt ids. `review_project_instructions`
scores local `AGENTS.md` / `CLAUDE.md` rules for the latest or selected project
and returns file metadata, checklist status, and improvement hints.

These tools do not call external LLMs. Archive-backed score/rewrite flows do not
return stored original prompt bodies. The archive and status tools avoid raw
absolute paths, and the instruction review tool avoids file bodies and raw
absolute paths. Tool definitions are marked read-only, idempotent, and
local-only through MCP annotations. Each `tools/call` response includes
`structuredContent` plus a JSON text block for clients that still expect text
content, and each tool definition declares an MCP `outputSchema` for the
structured result. If MCP is not configured, users can run the same archive
review through:

```sh
prompt-memory score --json
```

Claude Code registration:

```sh
claude mcp add --transport stdio prompt-memory -- prompt-memory mcp
```

Codex registration:

```sh
codex mcp add prompt-memory -- prompt-memory mcp
```

Use `--data-dir` when the archive is not in the default location:

```sh
prompt-memory mcp --data-dir /path/to/prompt-memory-data
```

For agent-native usage, prefer MCP first and CLI fallback second:

```text
prompt-memory:score_prompt latest=true
prompt-memory:improve_prompt latest=true
prompt-memory:score_prompt_archive max_prompts=200
prompt-memory:review_project_instructions latest=true
```

```sh
prompt-memory score --latest --json
prompt-memory improve --latest --json
prompt-memory score --json --limit 200
```

## Local-First Boundary

The plugin and hook commands do not contain the ingest token. The hook wrapper
loads local configuration, posts only to the local server, and fails open if the
server is unavailable.
