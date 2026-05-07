# prompt-memory Claude Rules

Claude Code must follow these repository rules in addition to `CLAUDE.md` and
`AGENTS.md`.

## Operational stage

- Pre-release. The maintainer is the only user; no published npm package and
  no third-party archives in the field.
- Backward-compatibility for archived data, settings, or external API
  consumers is **not** a constraint. Refactors, migrations, schema drops, and
  rename-only changes can be aggressive — focus on the cleanest end state
  rather than preserving every legacy column or wire-format field.
- Keep tests, lint, build, and `pnpm e2e:browser` green for every change so
  the maintainer's own dev environment stays usable. That is the only
  compatibility surface that matters today.
- Revisit this stance once an external collaborator joins or the package is
  published.

## Product Identity

- `prompt-memory` is an AI coding prompt memory and improvement workspace,
  local-first.
- It helps Claude Code/Codex users capture prompts locally, find them again,
  analyze weak prompt habits, and write better next requests.
- The product must never become a cloud-first prompt logger or an automatic
  prompt resubmitter.

## Architecture

- Read `docs/ARCHITECTURE.md` before structural changes.
- Keep entrypoints thin:
  - `src/cli`: Commander commands and terminal formatting
  - `src/server`: Fastify HTTP/auth/validation boundary
  - `src/hooks`: fail-open hook wrapper and status
  - `src/mcp`: MCP tool contracts, handlers, and stdio server
  - `src/web`: React UI and browser-only models
- In `src/mcp`, keep tool definitions/schemas in `score-tool-definitions.ts`,
  argument/result contracts in `score-tool-types.ts`, handler orchestration in
  `score-tool.ts`, and JSON-RPC routing in `server.ts`.
- Put reusable rules in:
  - `src/analysis`
  - `src/redaction`
  - `src/storage`
  - `src/shared`
- In `src/storage`, keep SQLite query/transaction assembly in `sqlite.ts`,
  schema/DDL and the migration orchestrator in `sqlite-migrations.ts`, row
  contracts in `sqlite-rows.ts`, and defensive JSON decoding in
  `sqlite-json.ts`.
- Use ESM-compatible imports. For type-only dependencies, use `import type`.
- Do not add new domain logic directly to large hub files unless the change is
  clearly part of that boundary.

## Naming and identifiers

A name is the spec. If the function does something the name does not promise,
rename instead of adding a comment.

- Functions are verbs: `buildClarifyingQuestions`, `applyClarifications`,
  `redactPrompt`, `extractPromptFacts`. Variables are nouns. Types are nouns in
  `PascalCase` (`PromptImprovement`, `ClarifyingAnswer`).
- Boolean variables and predicates use `is*`, `has*`, `should*`, `can*`. Prefer
  positive form (`isAnswered` over `isNotMissing`); avoid double negatives.
- Avoid bare abbreviations. Prefer `config` over `cfg`, `transaction` over
  `tx`, `directory` over `dir`. Domain-standard short names that already appear
  in the surrounding code (`url`, `id`, `db`, `mcp`, `tx` inside SQLite paths)
  are acceptable.
- Stay consistent with the repo's domain vocabulary: `prompt`, `axis`,
  `archive`, `improvement`, `draft`, `redaction`, `clarifying_questions`,
  `answers`. Do not invent synonyms — `question` and `clarification` are
  distinct concepts here.
- Plurals match shape. `prompts` is an array, `prompt` is a single value.
  `answersByAxis` for `Record<axis, string>`-shaped maps.
- File names use `kebab-case.ts`. Test files use `*.test.ts` colocated with
  the source. JSON keys in HTTP / MCP / CLI output use `snake_case` to match
  the existing wire format. TypeScript identifiers stay `lowerCamelCase`.
- Identifiers describe domain intent, not implementation. Prefer
  `applyClarifications` over `processAnswers`,
  `removeOriginalPromptSection` over `cleanString`.
- Negative names lie quickly. If a flag is named `disableX` but defaults to
  `false`, rename to `enableX` so the default reads naturally.

## Privacy

- Do not print raw prompt bodies, hook payloads, raw absolute paths, tokens,
  secrets, or instruction file bodies.
- Hook stdout is dangerous because it can become model context. Keep capture
  hooks quiet and fail-open.
- MCP and CLI outputs must be local-only and metadata-oriented unless the user
  explicitly asks for their own stored prompt content.
- Tests may use fake secrets only to verify redaction, and must assert those
  fake values are not retained in outputs.

## Verification

Run the relevant targeted tests first, then the release gate:

```sh
pnpm test
pnpm lint
pnpm format
pnpm build
pnpm pack:dry-run
git diff --check
```

For UI work, also run the browser E2E path and inspect the rendered screen.

## Git

- Do not push directly to `main`.
- Commit in focused units using Conventional Commits.
- Push the current branch and keep its pull request updated.
- In the solo-maintainer phase, merge only after Node 22/24 CI passes and unresolved conversations are clear.
- Re-enable one required approving review once an external collaborator or reviewer is available.
