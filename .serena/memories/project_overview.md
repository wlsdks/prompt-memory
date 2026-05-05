# prompt-memory — Project Overview

## What it is
`prompt-memory` is an **AI coding prompt memory and improvement workspace, local-first**. It is a developer tool that records prompts entered into AI coding tools such as Claude Code and Codex, stores them locally, helps users find them again, analyzes weak prompting patterns, and helps users write better follow-up requests.

## Core values
- Local-first by default; nothing leaves the user's machine.
- Explicit setup before modifying tool configuration.
- Fail-open hooks so prompt capture never blocks the underlying AI tool.
- Markdown is the human-readable source of truth; SQLite is a rebuildable index.
- Redaction is applied before persistent storage.
- No hidden external LLM calls. Optional MCP agent rewrite/judge flows return redacted packets to the active user-controlled CLI session only.

## Primary users
- Developers using Claude Code or Codex repeatedly during coding work.
- Power users who want to understand and improve their prompt habits.

## Status
- Public beta candidate (`v0.1.0-beta.0`).
- Claude Code: MVP path. Codex: beta adapter.
- Linux x64 + Node 22/24 are the primary CI targets; macOS/arm64/Windows still need release smoke validation.

## Key docs
- `docs/PRD.md`, `docs/PRD_PHASE2.md`
- `docs/ARCHITECTURE.md`, `docs/TECH_SPEC.md`, `docs/IMPLEMENTATION_PLAN.md`
- `CLAUDE.md`, `AGENTS.md`, `.claude/rules/prompt-memory.md`
- `DESIGN.md`
