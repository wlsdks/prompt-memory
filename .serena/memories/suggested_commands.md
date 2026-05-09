# Suggested Commands (Darwin / zsh)

## Verification gate (run after any feature change)
```sh
pnpm test          # vitest
pnpm lint          # tsc --noEmit (server + web) + scripts/quality-gate.mjs
pnpm format        # prettier --check
pnpm build         # tsc + vite build
pnpm pack:dry-run  # npm pack --dry-run, check shipped files
git diff --check   # whitespace / conflict markers
```

For UI / server changes also:
```sh
pnpm e2e:browser   # Playwright browser regression
pnpm smoke:release # isolated end-to-end CLI/server/storage smoke
pnpm benchmark -- --json
```

## Targeted test runs
```sh
pnpm test -- src/storage          # narrow vitest scope
pnpm test -- -t "redaction"       # by test name
```

## Dev loops
```sh
pnpm dev:web                       # vite dev server for src/web
pnpm prompt-coach server          # local Fastify server (127.0.0.1:17373)
pnpm prompt-coach mcp             # stdio MCP server
pnpm prompt-coach setup --profile coach --register-mcp --dry-run
```

## CLI inspection
```sh
pnpm prompt-coach list
pnpm prompt-coach search "<query>"
pnpm prompt-coach show <prompt-id>
pnpm prompt-coach coach
pnpm prompt-coach score --json
pnpm prompt-coach rebuild-index
pnpm prompt-coach doctor claude-code
pnpm prompt-coach doctor codex
```

## Format
```sh
pnpm format:write
```

## Git
```sh
git status
git diff
git log --oneline -20
git checkout -b feat/<short-name>
git push -u origin <branch>
gh pr create
gh pr view --web
```

## macOS (Darwin) notes
- Use `pbcopy` / `pbpaste` for clipboard (the codebase already wires this in `src/web/src/clipboard.ts` and CLI helpers).
- `find . -type f -name '*.ts'` works as on Linux.
- BSD-style `sed` differs from GNU; prefer `Edit`/`replace_content` tools rather than `sed -i`.
- `open http://127.0.0.1:17373` opens the local web UI.
- Native module `better-sqlite3` is rebuilt by pnpm post-install.
