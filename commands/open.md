---
description: Open the local prompt-coach archive
allowed-tools: Bash
---

# Open Prompt Memory

Check whether the local server is already configured:

```bash
prompt-coach service status || true
prompt-coach statusline claude-code || true
```

Open the local archive:

```text
http://127.0.0.1:17373
```

If the status line says the server is down, ask the user whether to start the
service:

```bash
prompt-coach service start
```

If service startup is unsupported on this platform, tell the user to run this in
a separate terminal because it stays in the foreground:

```bash
prompt-coach server
```
