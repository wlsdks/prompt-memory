# Security Policy

## Supported Versions

`prompt-memory` is currently pre-release software. Security fixes are applied to the main branch until a versioned release policy exists.

## Reporting A Vulnerability

Please report suspected vulnerabilities through a private channel rather than a public issue when the report includes exploit details or sensitive data.

If private vulnerability reporting is not available for this repository, contact the maintainer directly and include:

- affected version or commit
- operating system
- reproduction steps
- expected impact
- whether prompt text, tokens, or local files were exposed

Do not include real API keys, OAuth tokens, session tokens, private prompts, or proprietary code in the report.

## Data Handling Boundaries

`prompt-memory` is local-first:

- Ingest binds to the configured local server, defaulting to `127.0.0.1:17373`.
- Hook ingest requires a local bearer token.
- The web UI uses a same-origin session cookie and CSRF token.
- External LLM analysis is not implemented.
- Prompt text is redacted before Markdown, SQLite, and FTS storage in `mask` mode.

`prompt-memory` must not extract, store, proxy, sell, or reuse upstream account credentials such as Claude.ai OAuth tokens, Claude Code internal auth tokens, OpenAI/Codex session tokens, or ChatGPT account tokens.

## Known Limits

- Redaction is best-effort.
- Local users and local backup/snapshot systems may still access files in the configured data directory.
- Deleting prompt-memory records does not delete copies retained by upstream tools, terminals, shells, editors, filesystem snapshots, or external backups.
- Windows ACL hardening requires separate release validation.
