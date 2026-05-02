---
description: Set up prompt-memory capture and optional Claude Code status line
allowed-tools: Bash, Read, AskUserQuestion
---

# Set Up Prompt Memory

First check that the CLI is installed:

```bash
command -v prompt-memory
```

If this returns nothing, stop and tell the user to install the CLI first. After
the npm package is published, the normal install path is:

```bash
npm install -g prompt-memory
```

For local development from a cloned repository, use:

```bash
pnpm install
pnpm build
```

Run a safe preview first:

```bash
prompt-memory setup --dry-run
```

Explain the planned changes to the user. The setup may initialize
`~/.prompt-memory`, add Claude Code or Codex hooks, and install a local server
service where supported.

If the user approves, run:

```bash
prompt-memory setup
```

Then ask whether they want a small Claude Code status line indicator. It can
replace an existing Claude Code `statusLine` setting, so do not install it
without explicit approval.

Preview the status line setting:

```bash
prompt-memory install-statusline claude-code --dry-run
```

If approved, install it:

```bash
prompt-memory install-statusline claude-code
```

Verify the result:

```bash
prompt-memory doctor claude-code
prompt-memory statusline claude-code
```

Tell the user to restart Claude Code if the new status line does not appear.
