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
rg -n "maintainer-local-path|gho_|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]|sk-proj-[A-Za-z0-9_-]|sk-ant-[A-Za-z0-9_-]|npm_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{20,}|xoxb-[A-Za-z0-9_-]+|AKIA[A-Z0-9]{12,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|PRIVATE KEY|BEGIN .* KEY|password|secret" dist README.md README.ko.md SECURITY.md CHANGELOG.md docs commands plugins integrations package.json .claude-plugin scripts --glob '!node_modules'
```

The token patterns in this grep should mirror the live detectors in
`src/redaction/detectors.ts`. When a new detector is added there, add the
same pattern here so the pre-publish scan never falls behind the runtime
redaction layer.

Also scan for any real workstation path or username before publishing. Do not
write the real value into this document.

## Current Expected Findings

Allowed synthetic fixture values:

- `/Users/example` in browser, release-smoke, and benchmark fixtures
- fake `sk-proj...` strings used to prove redaction and privacy checks
- a fake `npm_…` token used in the privacy regression fixture (built with
  `String.join` so secret scanners do not flag the source file)
- a fake `AIzaSy…` Google API key used in redaction unit tests
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
