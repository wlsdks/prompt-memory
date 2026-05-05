# prompt-memory

[English](README.md) | [한국어](README.ko.md)

**Local-first prompt memory and coach for Claude Code and Codex.**

- 🗂️ Captures every prompt you send to Claude Code / Codex into a local
  Markdown + SQLite archive — nothing leaves your machine.
- 🧠 Scores each prompt 0–100 across five criteria and tells you which
  axis cost points, so you learn instead of guessing.
- ✍️ Generates a copy-ready improved draft on demand (English or Korean,
  auto-detected) without auto-resubmitting anything.

```sh
npm install -g prompt-memory
prompt-memory setup --profile coach --register-mcp --open-web
# then send a real Claude Code or Codex prompt and run:
prompt-memory coach
```

`prompt-memory` is a developer tool that safely records prompts you enter into AI coding tools such as Claude Code and Codex, helps you find them again, analyzes weak prompting patterns, and helps you write better follow-up requests.

It collects supported tool prompts locally, redacts sensitive values before storage, writes Markdown files, indexes them in SQLite, and serves a local web UI for search, review, archive scoring, prompt practice, analysis, deletion, and copy-based prompt improvement.

This project is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, or any other AI tool provider. Product names such as Claude Code and Codex are used only to describe compatibility.

## First 3-Minute Coach Loop

The first success is not the web dashboard. It is seeing a score and one useful
fix for a real Claude Code or Codex prompt you just sent.

For most users, the happy path is:

```sh
prompt-memory start --open-web
prompt-memory setup --profile coach --register-mcp --open-web
# send one real Claude Code or Codex coding prompt
prompt-memory coach
```

Skip `--open-web` if you do not want the web workspace to open automatically on
new agent sessions.

Only troubleshoot after that path fails:

```sh
prompt-memory doctor claude-code
prompt-memory doctor codex
# if MCP registration failed:
# claude mcp add --transport stdio prompt-memory -- prompt-memory mcp
# codex mcp add prompt-memory -- prompt-memory mcp
```

Open the local archive only when you want dashboard, search, history review, or
export.

## Status

This repository is pre-release software.

- Claude Code support: MVP path
- Codex support: beta adapter
- Local rule-based analysis preview: implemented
- Prompt Quality Score: implemented as a local deterministic `0-100` rubric
- MCP prompt scoring tools: implemented as a local stdio server
- Copy-based Prompt Coach: implemented, including raw-free next request briefs
- Prompt Practice workspace: implemented as a local draft-and-score UI with
  score history and outcome feedback that do not store draft text
- Transcript import: CLI only
- Anonymized export: web UI and CLI preview/job flow
- Benchmark v1: implemented as a local regression baseline
- English/Korean web UI: implemented
- External LLM analysis: no hidden provider calls from `prompt-memory`;
  optional MCP agent rewrite/judge packets can enter the active
  user-controlled Claude Code/Codex/Gemini CLI provider session when requested
- Default data handling: local only

## Requirements

- Node.js `>=22 <25`
- pnpm `10.x`
- A platform supported by `better-sqlite3`

The CI target is Node 22 and Node 24.

## Quick Start

There are two pieces:

1. the `prompt-memory` CLI, which owns the local server, hooks, storage, and web UI
2. the Claude Code or Codex marketplace plugin, which gives the agent an easy setup/status/open workflow

The marketplace plugin does not install the CLI binary by itself. Install the CLI first, then add the marketplace.

The examples below use the published CLI command `prompt-memory`. When running
from a cloned development checkout, use `pnpm prompt-memory` instead.

### 1. Install The CLI

After the package is published:

```sh
npm install -g prompt-memory
```

For local development from this repository:

```sh
git clone https://github.com/wlsdks/prompt-memory.git
cd prompt-memory
pnpm install   # also builds dist via the prepare lifecycle
pnpm setup     # installs Claude Code + Codex hooks, MCP, status line, and service
```

`pnpm install` runs `pnpm build` automatically through the `prepare` lifecycle,
so a fresh checkout has a working `dist/` after the install finishes.

`pnpm setup` is an alias for
`pnpm prompt-memory setup --profile coach --register-mcp --open-web` — one
command that connects every detected agent (Claude Code and Codex), registers
the MCP server with absolute paths, installs the Claude Code status line, and
enables the local server on session start.

### 2. Add The Claude Code Marketplace

Inside Claude Code:

```text
/plugin marketplace add wlsdks/prompt-memory
/plugin install prompt-memory
/reload-plugins
/prompt-memory:setup
```

`/prompt-memory:setup` checks that the CLI is available, previews
`prompt-memory setup --profile coach --register-mcp`, asks before writing
settings, and then runs the real setup if approved.

### 3. Add The Codex Marketplace

From your shell:

```sh
codex plugin marketplace add wlsdks/prompt-memory
```

Then run the local coach setup:

```sh
prompt-memory setup --profile coach --register-mcp
```

Codex currently exposes marketplace management through `codex plugin marketplace add/upgrade/remove`. The prompt capture hook is installed by `prompt-memory setup`, which writes the Codex hook config and enables Codex hooks.

### 4. Check Capture

```sh
prompt-memory doctor claude-code
prompt-memory doctor codex
prompt-memory statusline claude-code
prompt-memory buddy --once
prompt-memory coach
```

Open the local archive:

```text
http://127.0.0.1:17373
```

## Supported Platforms

Release validation currently targets:

- Linux x64 through GitHub Actions
- Node.js 22 and 24

macOS, Linux arm64, and Windows support are intended, but they still require release smoke validation for `better-sqlite3`, filesystem permissions, and hook command behavior before a stable release claim.

## Install (Development Checkout) And Setup Options

This section is for contributors and for users who want every `setup` flag
documented. End users who installed `prompt-memory` from npm should follow
[Quick Start](#quick-start) instead and treat this section as a reference.

For local development without the agent marketplace flow:

```sh
pnpm install
pnpm build
```

Run the guided local coach setup:

```sh
pnpm prompt-memory setup --profile coach --register-mcp
```

`setup` is intentionally explicit. Installing an npm/pnpm package should not
silently edit Claude Code or Codex settings, install a login service, or start a
local background server. `prompt-memory setup` is the consent step that prepares
the local archive, connects supported tools that are installed on your machine,
and configures the local server startup where supported.

The setup command:

- initializes the local data directory
- detects `claude` and `codex`
- installs Claude Code and/or Codex hooks for detected tools
- with `--profile coach`, adds low-friction rewrite guidance through hook
  context instead of making you run separate score/improve commands
- with `--profile coach`, installs the Claude Code status line when Claude Code
  is detected. Existing Claude Code status line commands are chained and
  restored on uninstall where possible.
- with `--register-mcp`, registers `prompt-memory mcp` with detected Claude
  Code and/or Codex CLIs
- with `--open-web`, installs a `SessionStart` hook that ensures the local
  server is running and opens `http://127.0.0.1:17373` once per agent session
- enables Codex hooks when Codex is detected
- installs and starts a macOS LaunchAgent for the local server when supported
- prints next steps and paths that were changed

Preview setup without writing files:

```sh
pnpm prompt-memory setup --profile coach --register-mcp --dry-run
```

Opt in to a Serena-like startup experience when you want the web workspace to
open automatically beside Claude Code or Codex:

```sh
pnpm prompt-memory setup --profile coach --register-mcp --open-web
```

This is not enabled by default. It writes an explicit `SessionStart` hook, opens
the browser at most once per agent session id, and keeps the hook fail-open with
no prompt body, raw path, or token output.

Use passive capture only when you do not want coaching:

```sh
pnpm prompt-memory setup
```

If you do not want a background service, use:

```sh
pnpm prompt-memory setup --no-service
pnpm prompt-memory server
```

The web UI URL is the same as in Quick Start: `http://127.0.0.1:17373`.

You can still run each setup step manually.

Initialize the local data directory:

```sh
pnpm prompt-memory init
```

By default, data is stored under:

```text
~/.prompt-memory
```

You can use a different location with `--data-dir`:

```sh
pnpm prompt-memory init --data-dir /path/to/prompt-memory-data
```

## Start The Local Server

```sh
pnpm prompt-memory server
```

The server defaults to:

```text
http://127.0.0.1:17373
```

Open that URL in a browser to use the web UI.

On macOS, `setup` can install a LaunchAgent so the server starts automatically
at login. You can also manage it directly:

```sh
pnpm prompt-memory service install
pnpm prompt-memory service status
pnpm prompt-memory service start
pnpm prompt-memory service stop
```

## Connect Claude Code

Install the Claude Code hook:

```sh
pnpm prompt-memory install-hook claude-code
```

Optional Prompt Rewrite Guard:

```sh
pnpm prompt-memory install-hook claude-code --rewrite-guard block-and-copy --rewrite-min-score 80
```

Optional web auto-open:

```sh
pnpm prompt-memory install-hook claude-code --open-web
```

`block-and-copy` uses the supported `UserPromptSubmit` decision path: weak
prompts are blocked before Claude Code processes them, an improved local draft
is shown, and prompt-memory tries to copy that draft to the clipboard. It does
not type into the terminal, press Enter, replace the composer contents, or
auto-submit anything. If the local ingest server is unavailable or ingest fails,
the hook fails open and does not block the prompt.

Preview the settings change without writing:

```sh
pnpm prompt-memory install-hook claude-code --dry-run
```

Diagnose the setup:

```sh
pnpm prompt-memory doctor claude-code
```

`doctor` checks local server reachability, ingest token, hook installation, and
MCP command access. For MCP, it first inspects known local config files and then
falls back to read-only `claude mcp list` when needed.

Remove the hook:

```sh
pnpm prompt-memory uninstall-hook claude-code
```

The installer writes a prompt-memory command into the Claude Code settings file and creates a backup before changing an existing file. The hook command does not contain the ingest token.

## Connect Codex Beta

Codex hook support is beta.

Install the Codex hook:

```sh
pnpm prompt-memory install-hook codex
```

Optional Prompt Rewrite Guard:

```sh
pnpm prompt-memory install-hook codex --rewrite-guard block-and-copy --rewrite-min-score 80
```

Optional web auto-open:

```sh
pnpm prompt-memory install-hook codex --open-web
```

Codex support uses the same safe hook command path. Because Codex plugin-local
hooks may vary by Codex version, `prompt-memory setup` / `install-hook` still
writes the user-level hook config. If the local ingest server is unavailable or
ingest fails, the hook fails open and does not block the prompt.

Preview the `hooks.json` and `config.toml` changes without writing:

```sh
pnpm prompt-memory install-hook codex --dry-run
```

Diagnose the setup:

```sh
pnpm prompt-memory doctor codex
```

`doctor` checks local server reachability, ingest token, hook installation,
Codex hook feature status, and MCP command access. For MCP, it first inspects
known local config files and then falls back to read-only `codex mcp list` when
needed.

Remove the hook:

```sh
pnpm prompt-memory uninstall-hook codex
```

The Codex installer targets user-level config by default:

```text
~/.codex/hooks.json
~/.codex/config.toml
```

It enables:

```toml
[features]
codex_hooks = true
```

Uninstall removes the prompt-memory hook entry but leaves the Codex feature flag in place.

## Agent Wrappers Experimental

`pm-claude` and `pm-codex` are experimental front-door wrappers for the initial
prompt argument. They score the prompt locally, generate a redacted improvement
when it is weak, and then launch the real `claude` or `codex` binary with the
selected prompt.

```sh
pm-claude --pm-mode auto -- "fix this"
pm-codex --pm-mode auto -- "fix this"
pm-codex --pm-mode auto -- exec "fix this"
```

Use dry-run first to verify what would be sent without launching the agent:

```sh
pm-claude --pm-mode auto --pm-dry-run -- "fix this"
pm-codex --pm-mode auto --pm-dry-run -- "fix this"
```

Wrapper options are prefixed with `--pm-*` so normal Claude/Codex options can
still be forwarded. The default mode is `ask`; `--pm-mode auto` is the one-click
mode that replaces a low-score initial prompt without asking. Management
subcommands such as `auth`, `mcp`, `plugin`, and `login` pass through without
rewriting. These wrappers do not intercept every later message typed inside an
interactive session.

## Plugin Packaging

This repository also ships plugin packaging artifacts:

```text
.claude-plugin
commands
plugins/prompt-memory
integrations/claude-code
docs/PLUGINS.md
```

Recommended order:

1. install the `prompt-memory` CLI
2. add the agent marketplace
3. run `prompt-memory setup` or `/prompt-memory:setup`

Claude Code can consume this repository as a marketplace:

```text
/plugin marketplace add wlsdks/prompt-memory
/plugin install prompt-memory
/reload-plugins
/prompt-memory:setup
```

The Claude Code plugin provides slash commands:

```text
/prompt-memory:setup
/prompt-memory:status
/prompt-memory:buddy
/prompt-memory:coach
/prompt-memory:score
/prompt-memory:judge
/prompt-memory:score-last
/prompt-memory:improve-last
/prompt-memory:habits
/prompt-memory:rules
/prompt-memory:coach-next
/prompt-memory:open
```

`/prompt-memory:setup` runs `prompt-memory setup --dry-run` first, asks before
writing local settings, and can optionally install a small Claude Code
`statusLine` indicator with the latest prompt score:

```sh
pnpm prompt-memory install-statusline claude-code
```

If another Claude Code HUD is already installed, prompt-memory preserves it by
running both commands through one chained `statusLine` command. Uninstalling
prompt-memory restores the previous command when it was captured during install.

For Claude Code or Codex, open a second terminal pane beside the agent and run
the always-on prompt buddy:

```sh
pnpm prompt-memory buddy
```

Use `pnpm prompt-memory buddy --once` for a one-shot text snapshot, or
`pnpm prompt-memory buddy --json` for automation.

The Codex package under `plugins/prompt-memory` contains a `.codex-plugin`
manifest, a fail-open `UserPromptSubmit` hook, and a small skill that helps
Codex install, diagnose, and use the local archive.

Claude Code prompt capture is exposed through its documented hook settings, so
`integrations/claude-code/settings.example.json` is provided as a manual example.
For normal use, prefer:

```sh
pnpm prompt-memory setup
```

The explicit setup command is still required because plugin discovery should not
silently edit user settings, install a login service, or start a local server.
See `docs/PLUGINS.md` for the packaging boundary and manual configuration notes.

Render the Claude Code status line manually:

```sh
pnpm prompt-memory statusline claude-code
```

Render a side-pane buddy snapshot manually:

```sh
pnpm prompt-memory buddy --once
```

Codex can add the same repository as a marketplace:

```sh
codex plugin marketplace add wlsdks/prompt-memory
```

After that, use `prompt-memory setup` to install the Codex hook and enable Codex hooks.

## CLI

List prompts:

```sh
pnpm prompt-memory list
```

Search prompts:

```sh
pnpm prompt-memory search "migration plan"
```

Show a prompt Markdown body:

```sh
pnpm prompt-memory show <prompt-id>
```

Delete a prompt:

```sh
pnpm prompt-memory delete <prompt-id>
```

Open a prompt in the local web UI:

```sh
pnpm prompt-memory open <prompt-id>
```

Rebuild SQLite/FTS from Markdown:

```sh
pnpm prompt-memory rebuild-index
```

Preview and import JSONL transcripts:

```sh
pnpm prompt-memory import --dry-run --file ./transcript.jsonl --save-job
pnpm prompt-memory import --execute --file ./transcript.jsonl
pnpm prompt-memory import-job <job-id>
```

Import is currently CLI-centered. The web UI can browse imported prompts through
the normal archive and imported-only filters, but there is no web import upload
screen.

Create and execute an anonymized export:

```sh
pnpm prompt-memory export --anonymized --preview --preset anonymized_review --json
pnpm prompt-memory export --anonymized --job <export-job-id> --json
```

The web UI exposes only anonymized export. Raw export is not implemented.
Previewed export jobs expire and are invalidated when the selected prompt set,
project policy versions, redaction version, or preview counts change.

Generate a copy-based Prompt Coach draft:

```sh
pnpm prompt-memory coach
pnpm prompt-memory coach --json
pnpm prompt-memory improve --text "make this request clearer" --json
pnpm prompt-memory improve --latest --json
```

Score accumulated prompt habits without returning prompt bodies:

```sh
pnpm prompt-memory score --json
pnpm prompt-memory score --latest --json
pnpm prompt-memory score --tool codex --json
```

## Local Analysis Preview

Prompt detail views include a local rule-based analysis preview. It summarizes whether a prompt includes clear targets, context, constraints, output format, and verification criteria. Each prompt also receives a deterministic `0-100` Prompt Quality Score with a checklist-based breakdown.

This preview runs locally against the stored, redacted prompt body. It does not call an external LLM provider.

## Project Instruction Review

The Projects screen can analyze project-local `AGENTS.md` and `CLAUDE.md`
files. The review stores a local snapshot with file names, hashes, timestamps,
checklist status, score, and improvement hints.

It does not store or return instruction file bodies, raw absolute paths, or
external LLM results. The score is a deterministic local rubric for project
context, agent workflow, verification commands, privacy/safety, and reporting
rules.

## MCP Prompt Scoring

`prompt-memory` can expose the same local Prompt Quality Score to Claude Code,
Codex, or any MCP client through a stdio MCP server:

```sh
prompt-memory mcp
```

The MCP server exposes ten tools:

- `get_prompt_memory_status`: check whether the local archive is initialized,
  whether prompts have been captured, and which MCP tool to call next.
- `coach_prompt`: run the default one-call agent workflow for Claude Code or
  Codex: local readiness, latest prompt score, approval-required rewrite,
  recent habit review, project instruction review, and next request guidance.
- `score_prompt`: score either direct prompt text, a stored `prompt_id`, or the
  latest stored prompt.
- `improve_prompt`: generate an approval-ready improved prompt draft for direct
  prompt text, a stored `prompt_id`, or the latest stored prompt.
- `prepare_agent_rewrite`: prepare one locally redacted prompt packet, local
  score metadata, local baseline draft, and rewrite contract so the active
  Claude Code/Codex/Gemini CLI session can semantically improve the prompt.
- `record_agent_rewrite`: save that agent-produced rewrite as a redacted
  improvement draft after user approval, without returning the rewrite body.
- `score_prompt_archive`: score accumulated prompt habits across recent stored
  prompts and return aggregate score, recurring gaps, a practice plan, a next
  prompt template, and low-score prompt ids.
- `review_project_instructions`: review local `AGENTS.md` / `CLAUDE.md`
  instruction files for the latest or selected project and return score,
  checklist status, and improvement hints.
- `prepare_agent_judge_batch`: prepare a bounded, locally redacted prompt
  packet and rubric for the active Claude Code/Codex/Gemini CLI session to
  judge. `prompt-memory` does not call the provider for you.
- `record_agent_judgments`: store advisory scores and notes produced by the
  active agent session, without storing prompt bodies or raw paths.

All read tools are local-only and declare an MCP `outputSchema` for structured
JSON metadata plus a text JSON fallback. `record_agent_rewrite` and
`record_agent_judgments` are non-destructive write tools. Archive-backed local
tools do not return stored prompt bodies, raw absolute paths, secrets, or hidden
external LLM results. Agent rewrite/judge modes are opt-in and use the current
agent session as the rewriter or evaluator.

Practical agent prompts:

```text
Use prompt-memory coach_prompt and give me the one-call coaching result for my
latest request. Do not auto-submit the rewrite.

Use prompt-memory get_prompt_memory_status and tell me whether prompt capture is
working before you score anything.

Use prompt-memory score_prompt with latest=true and tell me what to improve in
my last request.

Use prompt-memory improve_prompt with latest=true and give me an
approval-ready draft I can copy and resubmit.

Use prompt-memory prepare_agent_rewrite with latest=true. Rewrite that redacted
prompt yourself, ask for my approval, then call record_agent_rewrite if I want
the draft saved.

Use prompt-memory score_prompt_archive for recent Codex prompts and summarize my
top recurring prompt habit gaps.

Use prompt-memory review_project_instructions with latest=true and tell me
whether my AGENTS.md/CLAUDE.md rules are strong enough for coding agents.

Use prompt-memory prepare_agent_judge_batch with selection=low_score and
max_prompts=5. Judge those redacted prompts yourself, then call
record_agent_judgments with your scores and suggestions.
```

The tools return score metadata, checklist breakdowns, warnings, recurring gaps,
approval-ready rewrite drafts, and improvement hints. They do not store direct
prompt text or make hidden external LLM calls. Archive-backed score/rewrite
flows do not return stored original prompt bodies. The archive scoring tool also
avoids raw absolute paths. The project instruction review tool also avoids
instruction file bodies and raw absolute paths. The status tool returns only
safe counts, latest prompt metadata, available tool names, and next actions.

Agent-judge packets are different: when explicitly requested, they return
locally redacted prompt bodies so the active Claude Code/Codex/Gemini CLI
session can judge them. This is documented in
[Legal usage guide](docs/LEGAL_USAGE_GUIDE.md). `prompt-memory` does not extract
or proxy Claude.ai OAuth tokens, Claude Code internal auth tokens,
OpenAI/Codex/ChatGPT session tokens, or provider API keys.

Example Claude Code registration:

```sh
claude mcp add --transport stdio prompt-memory -- prompt-memory mcp
```

Example Codex registration:

```sh
codex mcp add prompt-memory -- prompt-memory mcp
```

If you use a custom data directory:

```sh
prompt-memory mcp --data-dir /path/to/prompt-memory-data
```

## Benchmark

Benchmark v1 measures local regression signals for privacy, retrieval,
rule-based prompt improvement, `coach_prompt` actionability, prompt quality
score calibration, analytics, and latency:

```sh
pnpm benchmark
pnpm benchmark -- --json
```

The benchmark uses synthetic fixtures only. It is a local baseline, not a claim
that real user prompt quality is fully solved.

## Release Smoke

Run the local release smoke before publishing or tagging a beta:

```sh
pnpm smoke:release
```

The smoke script builds the package, creates an isolated temporary data directory and HOME, starts the local server, captures fixture-like Claude Code and Codex prompts, verifies CLI list/search/show/delete/rebuild-index, checks SQLite WAL/FTS5, and confirms deleted prompt metadata is removed.

Browser regression smoke is also available:

```sh
pnpm e2e:browser
```

It checks the archive, prompt detail, Prompt Coach copy/save flow, projects,
anonymized export, and mobile overflow against a real local server.

## Storage

`prompt-memory` treats Markdown as the source of truth and SQLite as an index.

Default files:

```text
~/.prompt-memory/config.json
~/.prompt-memory/hook-auth.json
~/.prompt-memory/prompt-memory.sqlite
~/.prompt-memory/prompts/
~/.prompt-memory/logs/
~/.prompt-memory/quarantine/
~/.prompt-memory/spool/
```

On POSIX systems, prompt-memory creates sensitive directories as `0700` and token/config files as `0600`.

## Privacy And Security

Default behavior:

- Prompt capture is local to `127.0.0.1`.
- Hook ingest uses a local bearer token stored in `hook-auth.json`.
- The browser UI uses a same-origin session cookie and CSRF token.
- Sensitive values are redacted before Markdown, SQLite, and FTS indexing in `mask` mode.
- External LLM analysis is never triggered as a hidden background call by
  `prompt-memory`. Optional MCP agent rewrite/judge workflows can return
  redacted prompt packets to the active user-controlled Claude Code, Codex, or
  Gemini CLI session when requested, and that agent may send the packet through
  its provider session according to the user's tool setup.
- Prompt Coach is copy-based. It does not automatically type into, replace, or resubmit prompts into Claude Code or Codex.
- Prompt Rewrite Guard is opt-in. In `block-and-copy` mode it blocks weak prompts and offers a copied local rewrite for manual paste/enter. In `context` mode it adds model-visible rewrite guidance but does not replace the original prompt.
- Settings and local diagnostics may show local filesystem paths to the local user. Browser prompt/archive/export surfaces mask prompt-body paths and avoid raw prompt identifiers.

Important limits:

- This tool stores prompts you submit to connected tools. Only enable hooks where you are allowed to store that content.
- Redaction is best-effort and should not be treated as a complete data loss prevention system.
- Deletion removes prompt-memory Markdown and SQLite rows, but it does not erase copies that may exist in terminal history, editor buffers, backups, filesystem snapshots, or the upstream AI tool transcript.
- This project does not extract, store, proxy, sell, or reuse Claude.ai OAuth tokens, Claude Code internal auth tokens, OpenAI/Codex session tokens, or ChatGPT account tokens.

## Remove Data

Remove a single prompt:

```sh
pnpm prompt-memory delete <prompt-id>
```

Remove hooks:

```sh
pnpm prompt-memory uninstall-hook claude-code
pnpm prompt-memory uninstall-hook codex
```

Remove all prompt-memory data:

```sh
rm -rf ~/.prompt-memory
```

Use your configured `--data-dir` path if you initialized prompt-memory somewhere else.

## Development

Run the full local gate:

```sh
pnpm format
pnpm test
pnpm lint
pnpm build
pnpm pack:dry-run
```

The dry-run package should include built CLI files, built web assets, README, and release documentation.

See [Package contents](docs/PACKAGE_CONTENTS.md) before publishing to confirm
which files ship to npm, and [Pre-publish privacy audit](docs/PRE_PUBLISH_PRIVACY_AUDIT.md)
for the current privacy review checklist.

## Contributing

Please read [CONTRIBUTING](CONTRIBUTING.md), [CODE OF CONDUCT](CODE_OF_CONDUCT.md),
[SUPPORT](SUPPORT.md), and [SECURITY](SECURITY.md) before opening issues,
pull requests, or security reports.

## Documentation

- [PRD](docs/PRD.md)
- [Phase 2 PRD](docs/PRD_PHASE2.md)
- [Package contents](docs/PACKAGE_CONTENTS.md)
- [Pre-publish privacy audit](docs/PRE_PUBLISH_PRIVACY_AUDIT.md)
- [Efficiency review](docs/EFFICIENCY_REVIEW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Tech spec](docs/TECH_SPEC.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Adapter guide](docs/ADAPTERS.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Security policy](SECURITY.md)

## License

MIT
