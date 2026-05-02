# prompt-memory

[English](README.md) | [한국어](README.ko.md)

AI coding prompt memory and improvement workspace, local-first.

`prompt-memory` is a developer tool that safely records prompts you enter into AI coding tools such as Claude Code and Codex, helps you find them again, analyzes weak prompting patterns, and helps you write better follow-up requests.

It collects supported tool prompts locally, redacts sensitive values before storage, writes Markdown files, indexes them in SQLite, and serves a local web UI for search, review, analysis, deletion, and copy-based prompt improvement.

This project is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, or any other AI tool provider. Product names such as Claude Code and Codex are used only to describe compatibility.

## Status

This repository is pre-release software.

- Claude Code support: MVP path
- Codex support: beta adapter
- Local rule-based analysis preview: implemented
- Prompt Quality Score: implemented as a local deterministic `0-100` rubric
- Copy-based Prompt Coach: implemented
- Transcript import: CLI only
- Anonymized export: web UI and CLI preview/job flow
- Benchmark v1: implemented as a local regression baseline
- English/Korean web UI: implemented
- External LLM analysis: not implemented
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

### 1. Install The CLI

After the package is published:

```sh
npm install -g prompt-memory
```

For local development from this repository:

```sh
git clone https://github.com/wlsdks/prompt-memory.git
cd prompt-memory
pnpm install
pnpm build
```

### 2. Add The Claude Code Marketplace

Inside Claude Code:

```text
/plugin marketplace add wlsdks/prompt-memory
/plugin install prompt-memory
/reload-plugins
/prompt-memory:setup
```

`/prompt-memory:setup` checks that the CLI is available, runs `prompt-memory setup --dry-run`, asks before writing settings, and then runs the real setup if approved.

### 3. Add The Codex Marketplace

From your shell:

```sh
codex plugin marketplace add wlsdks/prompt-memory
```

Then run the local setup:

```sh
prompt-memory setup
```

Codex currently exposes marketplace management through `codex plugin marketplace add/upgrade/remove`. The prompt capture hook is installed by `prompt-memory setup`, which writes the Codex hook config and enables Codex hooks.

### 4. Check Capture

```sh
prompt-memory doctor claude-code
prompt-memory doctor codex
prompt-memory statusline claude-code
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

## Install

For local development without the agent marketplace flow:

```sh
pnpm install
pnpm build
```

Run the guided local setup:

```sh
pnpm prompt-memory setup
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
- enables Codex hooks when Codex is detected
- installs and starts a macOS LaunchAgent for the local server when supported
- prints next steps and paths that were changed

Preview setup without writing files:

```sh
pnpm prompt-memory setup --dry-run
```

If you do not want a background service, use:

```sh
pnpm prompt-memory setup --no-service
pnpm prompt-memory server
```

Open the web UI:

```text
http://127.0.0.1:17373
```

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

Preview the settings change without writing:

```sh
pnpm prompt-memory install-hook claude-code --dry-run
```

Diagnose the setup:

```sh
pnpm prompt-memory doctor claude-code
```

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

Preview the `hooks.json` and `config.toml` changes without writing:

```sh
pnpm prompt-memory install-hook codex --dry-run
```

Diagnose the setup:

```sh
pnpm prompt-memory doctor codex
```

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
/prompt-memory:open
```

`/prompt-memory:setup` runs `prompt-memory setup --dry-run` first, asks before
writing local settings, and can optionally install a small Claude Code
`statusLine` indicator with:

```sh
pnpm prompt-memory install-statusline claude-code
```

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
pnpm prompt-memory improve --text "make this request clearer" --json
```

## Local Analysis Preview

Prompt detail views include a local rule-based analysis preview. It summarizes whether a prompt includes clear targets, context, constraints, output format, and verification criteria. Each prompt also receives a deterministic `0-100` Prompt Quality Score with a checklist-based breakdown.

This preview runs locally against the stored, redacted prompt body. It does not call an external LLM provider.

## Benchmark

Benchmark v1 measures local regression signals for privacy, retrieval,
rule-based prompt improvement, prompt quality score calibration, analytics, and
latency:

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
- External LLM analysis is not implemented and no prompt is sent to an external analysis provider by this app.
- Prompt Coach is copy-based. It does not automatically replace or resubmit prompts into Claude Code or Codex.
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
- [Tech spec](docs/TECH_SPEC.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Adapter guide](docs/ADAPTERS.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Security policy](SECURITY.md)

## License

MIT
