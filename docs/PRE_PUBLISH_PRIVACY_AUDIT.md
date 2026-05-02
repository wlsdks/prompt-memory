# Pre-Publish Privacy Audit

Use this checklist before publishing a beta package or opening the repository
for wider public use.

## Scope

Review:

- npm dry-run package contents
- README and public documentation
- plugin manifests and command files
- release, benchmark, and browser smoke scripts
- built `dist/` files and source maps
- `.gitignore` coverage for local data and package artifacts

## Required Checks

Run:

```sh
npm pack --dry-run --json
rg -n "maintainer-local-path|gho_|sk-[A-Za-z0-9_-]|sk-proj|PRIVATE KEY|BEGIN .* KEY|password|secret" dist README.md SECURITY.md docs commands plugins integrations package.json .claude-plugin scripts --glob '!node_modules'
```

Also scan for any real workstation path or username before publishing. Do not
write the real value into this document.

## Current Expected Findings

Allowed synthetic fixture values:

- `/Users/example` in browser, release-smoke, and benchmark fixtures
- fake `sk-proj...` strings used to prove redaction and privacy checks
- documentation text that describes passwords, tokens, secrets, and private keys
  as things the tool should not expose

Not allowed:

- real local user names or workstation paths
- real API keys, OAuth tokens, session tokens, or GitHub tokens
- real prompts from a user archive
- real SQLite databases or Markdown prompt archives
- private screenshots, browser traces, or logs

## Publish Decision Rule

Do not publish if any real local path, real token, real prompt archive, or
private database appears in `npm pack --dry-run` output or in the package scan.
