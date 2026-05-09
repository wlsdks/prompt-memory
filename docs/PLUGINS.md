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
installation. Users who want active prompt coaching should still run:

```sh
prompt-memory start
prompt-memory setup --profile coach --register-mcp --open-web
```

The coach profile installs capture hooks, low-friction rewrite guidance through
hook context, local server startup where supported, and the Claude Code status
line when Claude Code is detected. `--register-mcp` is explicit consent to run
the detected agent CLI registration commands for the prompt-memory MCP server,
which gives the active agent session access to coach/rewrite/judge tools. From a
development checkout, run `pnpm setup`; it registers MCP with absolute Node +
`dist/cli/index.js` paths so Codex does not require a global `prompt-memory`
binary in `PATH`. Plain `prompt-memory setup` remains available for passive
capture only.

Users who want the web workspace to open automatically when Claude Code or Codex
starts can explicitly add `--open-web`:

```sh
prompt-memory setup --profile coach --register-mcp --open-web
```

This installs a `SessionStart` hook, ensures the local server is available, and
opens the web UI at most once per agent session id. It is opt-in because
installing a plugin should not surprise users by launching a browser.

Use a preview first when reviewing changes:

```sh
prompt-memory setup --profile coach --register-mcp --dry-run
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
- `/prompt-memory:buddy` to show the side-pane buddy command and one-shot
  checks
- `/prompt-memory:coach` to run the one-call prompt coach workflow inside
  Claude Code
- `/prompt-memory:score` to score the latest captured request or the
  accumulated archive
- `/prompt-memory:judge` to ask the active Claude Code session to judge a
  bounded batch of low-scoring redacted prompts through MCP
- `/prompt-memory:improve-last` to generate an approval-ready rewrite for the
  latest captured request, in either deterministic or active-agent mode
- `/prompt-memory:habits` to summarize recurring prompt habit gaps
- `/prompt-memory:open` to open the local archive

Prompt capture still uses Claude Code hook configuration in settings files. The
supported install paths are:

```sh
prompt-memory setup --profile coach --register-mcp --open-web
prompt-memory install-hook claude-code
```

The coach profile also installs the optional Claude Code status line. It can be
managed manually with:

```sh
prompt-memory install-statusline claude-code
prompt-memory statusline claude-code
```

This status line reports capture readiness, server health, the latest prompt
score when available, and the last ingest status. Claude Code supports one
`statusLine` command, so prompt-memory preserves an existing HUD by chaining the
previous command and the prompt-memory command into one status line. Uninstall
restores the previous command when prompt-memory captured it during install. The
setup command must ask before installing it.

Claude Code and Codex can also use an always-on side-pane buddy in a second
terminal pane:

```sh
prompt-memory buddy
prompt-memory buddy --once
prompt-memory buddy --json
```

The buddy prints latest prompt score, tool, top gap, habit score, and the next
move without returning prompt bodies, raw paths, or secrets.

## Agent Wrappers

The npm package also ships experimental `pm-claude` and `pm-codex` binaries.
They sit in front of the real agent binary for the initial prompt argument:

```sh
pm-claude --pm-mode auto -- "fix this"
pm-codex --pm-mode auto -- "fix this"
pm-codex --pm-mode auto -- exec "fix this"
```

Use `--pm-dry-run` to inspect the local rewrite plan without launching the real
agent:

```sh
pm-claude --pm-mode auto --pm-dry-run -- "fix this"
pm-codex --pm-mode auto --pm-dry-run -- "fix this"
```

Run `pm-claude --pm-help` or `pm-codex --pm-help` to see every supported flag
(`--pm-mode`, `--pm-min-score`, `--pm-language`, `--pm-dry-run`) with working
example invocations.

The wrappers intentionally do not rewrite management subcommands such as
`auth`, `mcp`, `plugin`, and `login`. They also do not intercept every later
message typed inside the interactive UI. For the latter, use hook-based coach
profile feedback or future wrapper work.

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

This server exposes ten model-controlled tools:

- `get_prompt_memory_status`
- `coach_prompt`
- `score_prompt`
- `improve_prompt`
- `prepare_agent_rewrite`
- `record_agent_rewrite`
- `score_prompt_archive`
- `review_project_instructions`
- `prepare_agent_judge_batch`
- `record_agent_judgments`

`coach_prompt` is the default agent-facing workflow. It combines local archive
status, latest prompt score, approval-required rewrite, recent habit review,
project instruction review, and next request guidance in one read-only call.
`get_prompt_memory_status` checks local archive readiness and returns safe
counts, latest prompt metadata, available tool names, and next actions.
`score_prompt` scores direct prompt text, a stored prompt id, or the latest
stored prompt with the same local deterministic `0-100` Prompt Quality Score
used by the web UI. The response also includes a per-criterion `breakdown`
(`weight` and `earned` for each of `goal_clarity`, `background_context`,
`scope_limits`, `output_format`, `verification_criteria`) plus the same
`weight`/`earned` on every `checklist` item, so an agent can tell the user
exactly which axis cost points instead of repeating only the overall score.
`improve_prompt` returns an approval-ready copy-based
rewrite draft for direct prompt text, a stored prompt id, or the latest stored
prompt. `prepare_agent_rewrite` is the opt-in semantic rewrite handoff: it
returns one locally redacted prompt, local score metadata, a local baseline
draft, and a rewrite contract so the current Claude Code, Codex, or Gemini CLI
session can produce a better prompt itself. `record_agent_rewrite` saves that
agent-produced rewrite as a redacted improvement draft after user approval,
without returning the rewrite body. `score_prompt_archive` scores accumulated
prompt habits across recent stored prompts and returns aggregate score,
recurring gaps, a practice plan, a next prompt template, and low-score prompt
ids. `review_project_instructions`
scores local `AGENTS.md` / `CLAUDE.md` rules for the latest or selected project
and returns file metadata, checklist status, and improvement hints.
`prepare_agent_judge_batch` is the opt-in LLM-as-judge handoff: it returns a
bounded set of locally redacted prompt bodies, local score metadata, and a
rubric so the current Claude Code, Codex, or Gemini CLI session can evaluate
prompt quality itself. `record_agent_judgments` stores that active agent
session's advisory scores, confidence, risks, and suggestions without storing
prompt bodies or raw paths.

`coach_prompt`, `improve_prompt`, and `score_prompt_archive` accept an optional
`language: "en" | "ko"` argument. When unset, `improve_prompt` auto-detects
Korean inputs by Hangul ratio and returns a Korean draft; the archive review
falls back to English unless the agent explicitly forwards `language: "ko"` (or
`coach_prompt` does so on the agent's behalf).

These tools do not make hidden external LLM calls. Archive-backed score/rewrite
flows do not return stored original prompt bodies. The archive and status tools
avoid raw absolute paths, and the instruction review tool avoids file bodies and
raw absolute paths. The agent rewrite/judge packets are explicit because they
return redacted prompt bodies to the active user-controlled agent session for
rewrite or evaluation; that agent may send the packet through its provider
session according to the user's tool setup. `prompt-memory` does not extract,
proxy, or reuse provider credentials. Read tool definitions are marked
read-only, idempotent, and local-only through MCP annotations.
`record_agent_rewrite` and
`record_agent_judgments` are marked as non-destructive write tools. Each
`tools/call` response includes
`structuredContent` plus a JSON text block for clients that still expect text
content, and each tool definition declares an MCP `outputSchema` for the
structured result. If MCP is not configured, users can run the same local archive
review through:

```sh
prompt-memory score --json
```

## Prompt Rewrite Guard

For users who want a stronger query-rewriting workflow, the hook can be
installed with an opt-in guard:

```sh
prompt-memory install-hook claude-code --rewrite-guard block-and-copy --rewrite-min-score 80
prompt-memory install-hook codex --rewrite-guard block-and-copy --rewrite-min-score 80
```

This uses the official `UserPromptSubmit` hook decision path where supported.
It blocks low-score prompts before the agent processes them, shows a local
improved draft, and tries to copy the draft to the clipboard. The user still
pastes and submits the draft manually. It does not simulate keyboard input,
rewrite the interactive composer, or auto-submit prompts. If local ingest is
unavailable or fails, the hook fails open and does not block.

`--rewrite-guard context` is less disruptive: it allows the original prompt to
continue and adds model-visible rewrite guidance. That mode is not a true
replacement because the original submitted prompt remains part of the turn.

Claude Code registration:

```sh
claude mcp add --transport stdio prompt-memory -- prompt-memory mcp
```

Codex registration:

```sh
codex mcp add prompt-memory -- prompt-memory mcp
```

The manual commands above assume `prompt-memory` is globally available in
`PATH`. In a cloned checkout, use `pnpm setup` or
`pnpm prompt-memory setup --profile coach --register-mcp --open-web` so the MCP
registration uses absolute paths.

After registration, `prompt-memory doctor claude-code` and
`prompt-memory doctor codex` report MCP command access. The doctor command first
inspects known local config files, then uses read-only `claude mcp list` or
`codex mcp list` as a fallback when config-file detection is inconclusive.

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
prompt-memory:coach_prompt
prompt-memory:prepare_agent_rewrite latest=true
prompt-memory:record_agent_rewrite provider=codex prompt_id=...
prompt-memory:prepare_agent_judge_batch selection=low_score max_prompts=5
prompt-memory:record_agent_judgments provider=codex judgments=[...]
```

```sh
prompt-memory coach
prompt-memory coach --json
prompt-memory score --latest --json
prompt-memory improve --latest --json
prompt-memory score --json --limit 200
```

## Local-First Boundary

The plugin and hook commands do not contain the ingest token. The hook wrapper
loads local configuration, posts only to the local server, and fails open if the
server is unavailable.
