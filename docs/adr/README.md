# Architecture Decision Records

Lightweight ADRs for `prompt-memory`. Each file captures the context behind a
structural decision so a future architecture review does not have to
re-discover the same friction signals.

Format:

- `Status`: Proposed, Accepted, Superseded by NNNN, or Rejected.
- `Date`: ISO date the ADR was last updated.
- `Tracks`: optional pointer to the workstream that produced the ADR.
- Sections: Context, Friction signals, Considered options, Recommendation,
  Decision.

| Number                                                | Title                                                      | Status   |
| ----------------------------------------------------- | ---------------------------------------------------------- | -------- |
| [0001](./0001-mcp-per-tool-modules.md)                | MCP per-tool module migration                              | Proposed |
| [0002](./0002-storage-capability-registry.md)         | Storage capability registry                                | Proposed |
| [0003](./0003-export-import-dormant-in-solo-phase.md) | export and import are dormant in the solo-maintainer phase | Accepted |
| [0004](./0004-quarantine-spool-dormant.md)            | quarantine/ and spool/ are reserved-but-empty              | Accepted |
