---
description: Show the prompt-memory side-pane buddy command
---

# prompt-memory:buddy

Use this when the user wants an always-on prompt score companion while working
inside Claude Code.

Claude Code cannot open a persistent right-side plugin panel from this command.
Instead, instruct the user to open a second terminal pane beside Claude Code and
run:

```sh
prompt-memory buddy
```

For a one-shot check inside this conversation, run:

```sh
prompt-memory buddy --once
```

For machine-readable output, run:

```sh
prompt-memory buddy --json
```

Also mention the optional Claude Code status line if they want a compact HUD:

```sh
prompt-memory install-statusline claude-code
prompt-memory statusline claude-code
```

Do not print raw prompt bodies, raw hook payloads, raw absolute paths, tokens,
or secrets. Explain that the buddy is local-only, reads the prompt-memory
archive, and never auto-submits improved prompts.
