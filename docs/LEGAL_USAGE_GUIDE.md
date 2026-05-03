# Legal Usage Guide For Agent Judging

This is an engineering compliance note, not legal advice. It records the public
documentation reviewed on 2026-05-03 and the product boundary chosen for
`prompt-memory`.

## Reviewed Sources

- Anthropic Claude Code hooks reference:
  https://code.claude.com/docs/en/hooks
- Anthropic Claude Code SDK reference:
  https://platform.claude.com/docs/s/claude-code-sdk
- Anthropic Claude Code legal and compliance:
  https://code.claude.com/docs/en/legal-and-compliance
- OpenAI Codex CLI repository and docs entrypoint:
  https://github.com/openai/codex
- OpenAI Service Terms:
  https://openai.com/policies/service-terms/
- OpenAI Services Agreement:
  https://cdn.openai.com/osa/openai-services-agreement.pdf

## What The Docs Allow Us To Rely On

- Claude Code hooks include `UserPromptSubmit`, which runs before Claude
  processes a submitted prompt and can add context or block prompt processing.
- Claude Code documents SDK/CLI print mode and structured output formats, but
  Claude legal guidance distinguishes ordinary Claude Code use from third-party
  products routing requests through user credentials.
- Claude Code legal guidance says usage is subject to Anthropic terms and usage
  policy, and says third-party developers building products that interact with
  Claude capabilities should use permitted API-key or cloud-provider
  authentication instead of routing requests through Free/Pro/Max credentials on
  behalf of users.
- Codex CLI is documented by OpenAI as a local coding agent users install and
  run on their own computer.
- OpenAI terms require use according to applicable documentation, prohibit
  credential/key transfer and rate-limit circumvention, and make customers
  responsible for their inputs and outputs.

## Product Boundary

`prompt-memory` must stay local-first and provider-neutral:

- It does not extract, store, proxy, sell, or reuse Claude.ai OAuth tokens,
  Claude Code internal auth tokens, OpenAI/Codex session tokens, ChatGPT account
  tokens, or provider API keys.
- It does not make hidden background calls to Claude, Codex, OpenAI, Anthropic,
  or other external LLM providers.
- Local deterministic scoring remains the default.
- LLM judge behavior is opt-in and agent-mediated. `prompt-memory` can return a
  bounded, locally redacted prompt packet through MCP so the active
  user-controlled Claude Code, Codex, or Gemini CLI session can evaluate it.
- The active agent session can then call `record_agent_judgments` to store
  advisory judgment metadata. The stored result must not contain prompt bodies,
  raw absolute paths, tokens, or provider credentials.

## Why This Boundary Was Chosen

The risky design would be for `prompt-memory` to silently spawn provider CLIs or
route requests through a user's logged-in provider account as a third-party
service. That could blur the line between the user's ordinary use and a product
using provider credentials on the user's behalf.

The implemented design keeps the provider interaction in the user's already
active agent session:

1. The user explicitly asks Claude Code, Codex, or another MCP-capable agent to
   judge stored prompts.
2. The agent calls `prepare_agent_judge_batch`.
3. `prompt-memory` returns only bounded metadata and, when requested, locally
   redacted prompt bodies.
4. The active agent evaluates the redacted packet in its normal user-controlled
   session.
5. The agent calls `record_agent_judgments` with scores, confidence, risks, and
   suggestions.
6. `prompt-memory` stores only judgment metadata.

This keeps authentication, model choice, billing, plan restrictions, web search,
and provider policy enforcement inside the user's chosen agent tool rather than
inside `prompt-memory`.

## Implementation Rules

- Any future provider-call feature must be opt-in, documented, and reviewed
  against provider documentation before release.
- Do not add code that shells out to `claude`, `codex`, or another provider CLI
  for hidden evaluation by default.
- Do not ask users to paste provider tokens into `prompt-memory`.
- If a future hosted or team feature is added, it must not route requests
  through an individual user's local Claude/Codex credentials.
- Keep the MCP tool descriptions explicit: agent-judge packets may return
  redacted prompt bodies, while local score/archive tools must not return stored
  prompt bodies.
- Treat LLM judge results as advisory. Do not replace deterministic local scores
  or privacy-safe benchmark gates with an external judge result.

