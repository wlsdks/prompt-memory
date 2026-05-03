# Contributing

Thanks for helping improve prompt-memory.

This project is a local-first developer tool for AI coding prompt memory,
search, analysis, and prompt improvement. Contributions should preserve the
privacy boundary: prompt data stays local unless a user explicitly exports it.

## Development Setup

```sh
pnpm install
pnpm build
pnpm test
```

Node.js `>=22 <25` is required.

## Pull Requests

`main` is protected. Work on a branch and open a pull request. A pull request
must have passing CI for Node 22 and Node 24 and all review conversations
resolved before merge. While this is a solo-maintainer project, required
approving reviews are not enforced because GitHub does not allow the pull
request author to satisfy their own required review. Add one required approval
again once external collaborators or reviewers are available.

Before opening a pull request, run:

```sh
pnpm test
pnpm lint
pnpm build
pnpm pack:dry-run
git diff --check
```

For web UI changes, also run:

```sh
pnpm e2e:browser
```

For release-sensitive changes, also run:

```sh
pnpm smoke:release
```

## Privacy Requirements

- Do not commit real prompts, API keys, OAuth tokens, session tokens, private
  file paths, SQLite archives, or local prompt-memory data.
- Use synthetic fixtures only.
- Redact paths, secrets, and stable prompt identifiers in screenshots, logs,
  issue comments, and test output.
- Hook changes must remain fail-open and must not print raw prompts or secrets
  to stdout or stderr.

## Design Requirements

prompt-memory is an operational developer tool. UI contributions should favor
dense, quiet workflows for search, review, deletion, settings, diagnostics, and
prompt improvement. Avoid marketing-style landing pages in the app shell.

## Release Notes

Changes that affect packaging, storage, hooks, export, deletion, or redaction
should update the relevant docs in `docs/`.

User-facing documentation or UI text changes should keep the English and Korean
surfaces aligned.
