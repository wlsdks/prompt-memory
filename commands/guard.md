---
description: Toggle the prompt-memory rewrite guard mode (off / context / ask / block-and-copy)
allowed-tools: Bash, AskUserQuestion
---

# Prompt-memory Rewrite Guard Picker

This command flips the `UserPromptSubmit` rewrite guard between four modes
without making the user remember CLI flags. Each mode controls what the hook
does when a captured prompt scores below the configured threshold.

## 1. Confirm the CLI is installed

```bash
command -v prompt-memory
```

If this returns nothing, stop and tell the user to install or rebuild the
CLI before continuing.

## 2. Read the user's choice via AskUserQuestion

Use `AskUserQuestion` with the following four options. Each option's `value`
is the literal mode name passed back to `setup`. Show the four options
verbatim — do not invent new modes. The descriptions explain what each
mode does so the user can choose without reading docs.

- **off** — Capture only. The hook does not coach or block. Pick this when
  you want quiet archiving.
- **context** — Soft. Adds an improved prompt as `additionalContext`
  alongside the user's submission. Claude sees both. Nothing is blocked.
- **ask** — Active. When a weak prompt clears the trigger gate
  (length ≥ 30, score < 60, not an acknowledgment), the hook tells
  Claude to call `AskUserQuestion` with one or two clarifying questions
  before answering.
- **block-and-copy** — Hard. Submitted prompts under the score threshold
  are blocked and an improved version is copied to the clipboard.

## 3. Apply the chosen mode

Re-run setup with the user's pick. This is the same command the user
would type by hand — passing `--no-service --skip-statusline` keeps the
local server and status-line untouched so the picker stays scoped to the
guard mode only:

```bash
prompt-memory setup --profile coach --rewrite-guard <chosen> --no-service --skip-statusline
```

`<chosen>` is the literal value returned by `AskUserQuestion` (`off`,
`context`, `ask`, or `block-and-copy`). The setup command is idempotent
on the hook side: it rewrites the existing `UserPromptSubmit` entries in
`~/.claude/settings.json` and the Codex `hooks.json` with the new mode.

## 4. Confirm the new state

Report the chosen mode back to the user in one line, plus the next
expected behaviour (e.g. "ask mode is on — your next weak prompt will
trigger AskUserQuestion before Claude answers"). Tell the user to
restart the active Claude Code or Codex session if the new hook behaviour
does not appear immediately, since hook config is read at session start.

Do not print prompt bodies, raw paths, tokens, or any captured text.
