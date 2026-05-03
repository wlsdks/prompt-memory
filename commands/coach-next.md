---
description: Generate the next better Claude Code or Codex request template
allowed-tools: Bash
---

# Coach Next Request

Prefer the MCP tool when it is available:

```text
prompt-memory:score_prompt_archive max_prompts=200 low_score_limit=5
```

Use the returned `practice_plan` and `next_prompt_template` to produce one
approval-ready next request template. The template should push the user to
include goal, context, scope, output, and verification.

If MCP is not configured, run:

```bash
prompt-memory score --json --limit 200 --low-score-limit 5
```

Do not include raw prompt bodies, raw hook payloads, raw absolute paths, tokens,
or secrets. The output should be a reusable template, not a command that
auto-submits anything.
