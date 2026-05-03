---
description: Set up prompt-memory capture or the one-command coach profile
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

For the lowest-friction setup, preview the coach profile first:

```bash
prompt-memory setup --profile coach --register-mcp --dry-run
```

Explain the planned changes to the user. The setup may initialize
`~/.prompt-memory`, add Claude Code or Codex hooks, and install a local server
service where supported. The coach profile also installs low-friction rewrite
guidance and the Claude Code status line when Claude Code is detected. With
`--register-mcp`, it also runs the detected `claude mcp add` or `codex mcp add`
command so this active agent can use prompt-memory tools.

If the user approves, run:

```bash
prompt-memory setup --profile coach --register-mcp
```

If MCP registration fails or the user chooses not to use `--register-mcp`,
provide the manual command:

```bash
claude mcp add --transport stdio prompt-memory -- prompt-memory mcp
```

Use the default capture-only profile only when the user wants passive recording
without prompt coaching:

```bash
prompt-memory setup
```

Verify the result:

```bash
prompt-memory doctor claude-code
prompt-memory statusline claude-code
```

Tell the user to restart Claude Code if the new status line does not appear.
