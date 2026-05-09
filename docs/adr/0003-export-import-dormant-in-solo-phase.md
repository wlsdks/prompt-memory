# 0003 — export and import are dormant in the solo-maintainer phase

- Status: Accepted
- Date: 2026-05-09
- Tracks: 2026-05-09 usability audit, candidate #5

## Context

`prompt-coach` ships two surfaces whose usage today is effectively zero
because there is no second user:

- **`prompt-coach export`** (and the `/api/v1/exports` HTTP route) produces
  anonymized prompt bundles intended for sharing with another developer or
  archiving outside the local archive.
- **`prompt-coach import`** (and the `/api/v1/import/dry-run` HTTP route)
  ingests prompt transcripts from another archive — for migration or restore.

The maintainer is the only user, runs no second machine, and exports nothing
to anyone. The 2026-05-09 inventory reviewed every feature for "do I actually
use this?" and put both of these in the **動力 의심** column: the code path
is intact, but no situation has triggered it, and there is no road on which
it will be triggered without an external collaborator.

`.claude/rules/prompt-coach.md` already states that the project is in a
**pre-release, solo-maintainer phase** and that backward-compatibility for
archived data, settings, and external API consumers is not a constraint.
This ADR extends that stance to feature _prioritization_, not just
data-format flexibility.

## Friction signals

- Adding a flag, preset, or column to `export` costs review and test surface
  but ships zero observed value.
- The `import` codepath has its own JSON contract, dry-run preview, and CLI
  affordance — every one of which would have to evolve along with `export`
  if the formats diverge. None of that has been exercised against real
  external data.
- The 2026-05-09 audit produced an explicit list of "next priorities," and
  these two surfaces did not make it onto that list.

## Decision

Treat `export` and `import` (CLI commands, HTTP routes, MCP affordances if
any) as **dormant** until at least one of the following is true:

1. A second user (or a second host belonging to the maintainer) joins the
   archive.
2. An external collaborator opens an issue or PR that depends on the
   feature.
3. The package is published to npm and a real-world download produces a
   migration request.

While dormant:

- **Maintain only.** Keep the existing CLI, HTTP, and MCP entry points
  working. Tests, lint, and `pnpm pack:dry-run` must stay green.
- **No new features, presets, formats, or flags.** A reviewer should send
  back any PR that adds capability to `export` or `import` without
  satisfying one of the wake-up conditions above, even if the change is
  small.
- **Bug fixes are still allowed.** Privacy or data-corruption fixes are
  not gated by this ADR.
- **Refactors are allowed only as part of a larger refactor that already
  touches the area.** Do not refactor `export` or `import` standalone.

## Consequences

- Future audits should not propose new export presets, alternate formats,
  cross-host sync, etc., as next-priority work. They are explicitly
  off-track until the wake-up conditions are satisfied.
- The buddy / coach / score / improve / hook surfaces — the ones the
  maintainer actually uses every day — keep priority for invention budget.
- When a wake-up condition is satisfied, this ADR should be revisited and
  superseded, not silently ignored.

## Wake-up checklist

When the time comes, the next ADR should answer:

- Which formats does the new caller actually need (CSV / JSONL / SQLite
  dump)?
- Does anonymization need to evolve (project labels, branch names, file
  paths) for that caller?
- Does `import` need to round-trip what `export` writes, or are the two
  asymmetric (e.g., import accepts other tools' transcripts but export
  only ships our own)?

Until that ADR is written, the answer to "should we add X to export?" is
"no, see ADR-0003."
