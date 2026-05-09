# 0004 — quarantine/ and spool/ are reserved-but-empty under the data dir

- Status: Accepted
- Date: 2026-05-09
- Tracks: 2026-05-09 usability audit, candidate #3

## Context

`initializePromptCoach` creates two subdirectories under the prompt-coach
data root and records them in `config.json`:

- `~/.prompt-coach/quarantine/`
- `~/.prompt-coach/spool/`

A 2026-05-09 audit of the maintainer's real archive (482 captured prompts,
1.8M Markdown archive) found these directories empty and never written to:

```
prompts/    482 files (active markdown archive)
quarantine/ 0 files
spool/      0 files
```

A grep across `src/` confirms no code path beyond `initializePromptCoach`
and `getPromptCoachPaths` references either directory. They are created,
exported through the config, and never used.

## Friction signals

- A reader of the storage layout sees three peer dirs and assumes all three
  are equally load-bearing. Two of them are decorative.
- A future contributor adding storage code might either reinvent these
  buckets (because the existing ones are not signposted as reserved) or
  reuse them in a way that contradicts their original intent (because no
  intent is recorded).
- A trimming pass might delete them as dead code without noticing they were
  reserved for a use case.

## Considered options

### Option A — delete the directories and the config entries

Aggressive. Removes the friction at the cost of any future use case.
Cheap to undo (re-add when the use case appears). Not chosen because the
intended use cases below are credible and the storage cost is zero.

### Option B — keep the directories, document intent, treat as dormant

Mark them as **reserved-but-empty** in this ADR; keep the existing
mkdir/config behavior. New PRs that want to put data into either dir must
update this ADR (or supersede it) so the intent is recorded the moment
they wake up. Chosen.

### Option C — gate the directories behind a feature flag

Over-engineered for a directory that costs zero. Rejected.

## Intended uses

The directories are reserved for the following near-future use cases. This
ADR does not commit to building them — it commits to _not_ repurposing the
directories for unrelated buckets while they are empty.

### `quarantine/`

Holds Markdown archive entries whose redaction confidence is low or whose
detector flagged them as borderline secrets. The intent is:

- The capture path writes the entry to `prompts/<date>/<id>.md` as today
  _and_ a redacted-but-quarantined copy to `quarantine/<id>.md` when
  confidence is below a threshold. The user can then review the
  quarantine bucket separately before allowing the entry into search /
  scoring.
- `prompt-coach doctor` would surface a non-zero quarantine count as a
  next step.

When this lands, the change set is:

- Detector confidence threshold + write path in `src/redaction/`.
- A `prompts.quarantined_at` column or a sidecar table in
  `src/storage/sqlite-migrations.ts`.
- A `quarantine list / release` CLI command.

### `spool/`

Holds prompt payloads that the hook tried to send while the local server
was down. The intent is:

- When `127.0.0.1:17373` is unreachable, the Claude Code / Codex hook
  writes the redacted payload to `spool/<timestamp>-<id>.json` instead of
  losing it.
- `prompt-coach server` (or a small drainer in `src/hooks/`) replays
  the spool on next startup and ingests the entries in order.

When this lands, the change set is:

- A `spool` write path in the hook fail-open branch (`src/hooks/`).
- A drain hook in the server boot path or in `prompt-coach service start`.
- A `spool size` line in `prompt-coach doctor`.

## Decision

Treat `quarantine/` and `spool/` as **reserved-but-empty** under the data
dir. Specifically:

- Continue creating both directories during `initializePromptCoach` and
  exporting the paths from `getPromptCoachPaths` and `config.json`.
- Do not write to them from any other code path, and do not introduce
  unrelated use cases for them.
- Any PR that begins writing to either directory must reference this
  ADR and either update the "Intended uses" section above or supersede
  this ADR with a follow-up that captures the actual contract.

## Consequences

- Future audits that flag empty directories now have a written reason
  for keeping them.
- Reviewers can reject PRs that repurpose either directory for an
  unrelated bucket.
- The decision is cheap to revisit: the directories cost zero on disk
  while empty, and the wake-up plan above tells the next contributor
  exactly what to wire up.

## Wake-up checklist

When implementing one of the intended uses:

- Update or supersede this ADR before the first write path lands.
- Add a doctor next-step or a buddy line that surfaces non-zero counts —
  silent buckets defeat the purpose.
- Decide retention (does old quarantine / spool age out, or is it
  manual?) and document it where retention policy already lives.
