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

For local development from a cloned repository, use the two-line bring-up:

```bash
pnpm install   # also runs `pnpm build` via the prepare lifecycle
pnpm setup     # alias for prompt-memory setup --profile coach --register-mcp --open-web
```

`pnpm setup` is the same one-command path the README recommends — it
installs the Claude Code and Codex hooks, registers the MCP server with
absolute paths so PATH ordering does not matter, installs the Claude
Code status line, and enables the local-server SessionStart hook. Use
`pnpm setup` when the user just wants "make it work"; only fall back to
the explicit `prompt-memory setup ...` invocations below when the user
wants a different profile or a dry-run preview.

For the lowest-friction setup with the explicit invocation, preview the
coach profile first:

```bash
prompt-memory setup --profile coach --register-mcp --dry-run
```

Explain the planned changes to the user. The setup may initialize
`~/.prompt-memory`, add Claude Code or Codex hooks, and install a local server
service where supported. The coach profile also installs low-friction rewrite
guidance and the Claude Code status line when Claude Code is detected. If an
existing Claude Code status line is already configured, prompt-memory chains it
instead of replacing it and restores it on uninstall where possible. With
`--register-mcp`, it also runs the detected `claude mcp add` or `codex mcp add`
command so this active agent can use prompt-memory tools.

If the user wants a Serena-like startup experience where the web workspace opens
beside Claude Code or Codex, explain that this is opt-in and preview:

```bash
prompt-memory setup --profile coach --register-mcp --open-web --dry-run
```

If the user approves, run:

```bash
prompt-memory setup --profile coach --register-mcp
```

If the user approved automatic web opening, include `--open-web` in the real
setup command. The hook opens the browser once per agent session id and fails
open without printing prompts, paths, or tokens.

After setup, keep the first success path short:

```bash
# ask the user to send one real Claude Code or Codex coding prompt, then:
prompt-memory coach
```

Use `doctor` only if the prompt does not appear:

```bash
prompt-memory doctor claude-code
prompt-memory doctor codex
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
prompt-memory statusline claude-code
```

Tell the user to restart Claude Code if the new status line does not appear.
