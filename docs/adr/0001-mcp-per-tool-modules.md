# 0001 — MCP Per-Tool Module Migration

- Status: Proposed
- Date: 2026-05-08
- Tracks: Track A1 from the 2026-05-08 multi-track improvement pass

## Context

`src/mcp` currently hosts twelve agent-facing tools that follow two different
file layouts:

- **Split layout** (the older one): `src/mcp/score-tool-definitions.ts` owns
  the JSON schema and tool name; `src/mcp/score-tool-types.ts` owns the
  TypeScript argument/result contract; `src/mcp/score-tool.ts` owns the
  handler orchestration; `src/mcp/server.ts` owns JSON-RPC dispatch via
  `PROMPT_COACH_MCP_TOOL_HANDLERS`. The same axis applies to
  `agent-judge-tool-*` and `agent-rewrite-tool-*`.

  Tools currently in this layout: `get_prompt_coach_status`, `score_prompt`,
  `improve_prompt`, `score_prompt_archive`, `review_project_instructions`,
  `coach_prompt`, `prepare_agent_judge_batch`, `record_agent_judgments`,
  `prepare_agent_rewrite`, `record_agent_rewrite` (10 tools).

- **Per-tool layout** (the newer one): `src/mcp/apply-clarifications-tool.ts`,
  `src/mcp/record-clarifications-tool.ts`,
  `src/mcp/ask-clarifying-questions-tool.ts` each colocate the schema, the
  TypeScript contract, and the handler in a single tool-shaped module.

Adding a new tool currently requires the contributor to know that:

1. The handler must be added to (or registered through)
   `PROMPT_COACH_MCP_TOOL_HANDLERS` in `src/mcp/server.ts`.
2. The tool definition must live in a `*-tool-definitions.ts` file or in the
   per-tool module.
3. The TypeScript contract must live in a `*-tool-types.ts` file or in the
   per-tool module.
4. The handler implementation must live in a `*-tool.ts` file or the per-tool
   module.

The split layout was a deliberate decision recorded in
`docs/ARCHITECTURE.md`, which describes the four axes (definition, type,
handler, transport routing) as load-bearing privacy and review boundaries.
The per-tool layout emerged because the newer tools are smaller and the
overhead of three companion files was not paying off; nothing in the existing
ARCHITECTURE.md text forbids it.

## Friction signals

- Cross-cut on add: every new tool in the split layout touches four files.
- Drift between layouts: a future contributor sees both styles and has to
  decide which convention to follow each time. There is no rule recorded.
- Review surface: `server.ts` carries an implicit registry whose entries can
  silently fall out of sync with the tool definitions if a rename happens.

## Considered options

### Option A — keep the split layout for the legacy tools, document the rule

Codify in `docs/ARCHITECTURE.md` that:

- Tools whose handler exceeds ~150 lines or whose schema is large stay in the
  split layout.
- New tools default to the per-tool layout.
- A small `tool registry` module (or an exported list per file) is the single
  enforcement point for `server.ts` to discover handlers.

Pros: no churn, clarifies the existing decision, removes ambiguity for new
tools.

Cons: split-vs-per-tool stays as a permanent fork in the conventions; the
`PROMPT_COACH_MCP_TOOL_HANDLERS` literal in `server.ts` remains a manual
list.

### Option B — migrate everything to per-tool modules

Move every tool into a single module that exports `{ definition, handler }`
(plus a small `Args`/`Result` type), and have `server.ts` register them via a
generated array. Delete `score-tool-definitions.ts`, `score-tool-types.ts`,
and `score-tool.ts` once their tools have been split out.

Pros: single convention; adding a tool is a one-file diff plus one registry
line; review surface is clearly the per-tool module.

Cons: real engineering churn for ten tools. The privacy review surface that
ARCHITECTURE.md cites benefits from a definitions file the privacy fixture
can grep. We would need to keep the privacy regression and audit grep
patterns working.

### Option C — registry pattern with helper, files unchanged

Introduce `src/mcp/registry.ts` that exposes
`registerTool({ definition, handler })` and have each tool module call it on
import. `server.ts` imports the registry instead of the literal handler map.
The split layout can stay where it is; the change is purely the dispatch
indirection.

Pros: removes the manual `PROMPT_COACH_MCP_TOOL_HANDLERS` list. Keeps the
existing privacy review surface intact. No wholesale rewrite.

Cons: side-effectful module imports; some teams treat that as an anti-pattern
because the import order matters. We already do this in places, but it should
be called out.

## Recommendation

Adopt **Option A in the short term, Option C in the medium term**. Option A
removes the ambiguity for contributors today with no churn. Option C
addresses the manual handler list without touching the legacy tools. Option B
is held in reserve and only worth doing if the per-tool style ends up needing
shared helpers that the split layout cannot reuse.

## Decision

Not yet made. This ADR exists so the next architecture review does not have
to re-discover the friction. Until a decision is made:

- New MCP tools should follow the per-tool layout
  (`src/mcp/<tool-name>-tool.ts`).
- Existing split-layout tools stay where they are.
- Any change that touches both layouts in the same PR should reference this
  ADR in the PR description.
