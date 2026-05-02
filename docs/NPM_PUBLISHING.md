# NPM Publishing Runbook

Date: 2026-05-02

## Current Readiness

The local environment is authenticated to npm as:

```sh
npm whoami
# stark97
```

The unscoped package name currently appears available:

```sh
npm view prompt-memory version
# E404 Not Found
```

That result means the package has not been published to the public npm registry at the time of the check. It is not a reservation. The name can still be taken by someone else before the first publish.

## Recommended First Publish

Use a beta prerelease first:

```sh
npm publish --tag beta
```

Recommended version:

```json
{
  "version": "0.1.0-beta.0"
}
```

Why `--tag beta`:

- users must intentionally install the beta tag
- `npm install -g prompt-memory@beta` gets the prerelease
- the `latest` tag remains unused until the package is stable enough

## Install Commands After Publish

```sh
npm install -g prompt-memory@beta
prompt-memory setup
prompt-memory doctor claude-code
prompt-memory doctor codex
prompt-memory server
```

## Required Local Gate Before Publishing

Run on Node 22:

```sh
pnpm format
pnpm test
pnpm lint
pnpm build
pnpm benchmark -- --json
pnpm e2e:browser
pnpm smoke:release
pnpm pack:dry-run
git diff --check
```

Recommended additional package smoke:

```sh
npm pack --dry-run
npm pack
TMP_HOME="$(mktemp -d)"
TMP_PREFIX="$(mktemp -d)"
HOME="$TMP_HOME" npm install -g --prefix "$TMP_PREFIX" ./prompt-memory-0.1.0-beta.0.tgz
"$TMP_PREFIX/bin/prompt-memory" --help
```

## Publish Checklist

- [ ] package name is still available or already owned by the maintainer
- [ ] version is bumped and has never been published
- [ ] README is available in English and Korean and matches the actual feature set
- [ ] package contents contain built CLI/server/web assets
- [ ] `bin.prompt-memory` points to `dist/cli/index.js`
- [ ] `dist/cli/index.js` is executable after build
- [ ] release checklist passes
- [ ] npm account is authenticated
- [ ] 2FA/OTP requirement is available if npm asks for it
- [ ] publish uses `--tag beta` for the first prerelease

## Do Not Publish Yet If

- `pnpm smoke:release` fails
- `pnpm pack:dry-run` does not include `dist/cli`, `dist/server`, or `dist/web`
- npm reports that `prompt-memory` is already taken by another owner
- the npm account cannot complete 2FA/OTP
- README still claims a feature that is not implemented

## Useful NPM Commands

```sh
npm whoami
npm view prompt-memory version
npm access list packages stark97 --json
npm publish --tag beta
npm dist-tag ls prompt-memory
npm view prompt-memory versions --json
```
