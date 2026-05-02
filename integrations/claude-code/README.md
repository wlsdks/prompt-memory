# Claude Code Integration

Claude Code currently exposes prompt capture through hooks configured in
settings files. The recommended install path is:

```sh
prompt-memory setup
```

or, for only Claude Code:

```sh
prompt-memory install-hook claude-code
```

The installer writes an absolute command into `~/.claude/settings.json`, creates
a backup before changing an existing file, and keeps the hook fail-open.

`settings.example.json` is a portable example for users who prefer manual
configuration. It expects `prompt-memory` to be available on `PATH`; the
installer is more reliable because it records the exact Node and CLI path.
