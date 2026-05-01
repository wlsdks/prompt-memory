# prompt-memory

Local-first prompt archive for AI coding tools.

`prompt-memory` collects user prompts from supported coding tools, redacts sensitive values before storage, writes Markdown files, indexes them in SQLite, and serves a local web UI for search, review, and deletion.

This project is not affiliated with, endorsed by, or sponsored by Anthropic, OpenAI, or any other AI tool provider. Product names such as Claude Code and Codex are used only to describe compatibility.

## Status

This repository is pre-release software.

- Claude Code support: MVP path
- Codex support: beta adapter
- External LLM analysis: not implemented
- Default data handling: local only

## Requirements

- Node.js `>=22 <25`
- pnpm `10.x`
- A platform supported by `better-sqlite3`

The CI target is Node 22 and Node 24.

## Supported Platforms

Release validation currently targets:

- Linux x64 through GitHub Actions
- Node.js 22 and 24

macOS, Linux arm64, and Windows support are intended, but they still require release smoke validation for `better-sqlite3`, filesystem permissions, and hook command behavior before a stable release claim.

## Install

For local development:

```sh
pnpm install
pnpm build
```

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

## Documentation

- [PRD](docs/PRD.md)
- [Tech spec](docs/TECH_SPEC.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Adapter guide](docs/ADAPTERS.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Security policy](SECURITY.md)

## License

MIT
