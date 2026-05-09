# Product Thesis (Owner Intent)

The owner's stated intent for `prompt-coach`, captured 2026-05-05:

> "사람들이 어느 순간부터 귀찮아서 그냥 해! 작업해! 이런 것만 하고 사고 과정이 사라졌다. 그걸 고치고 싶다."

Translated: AI coding users have started skipping the *thinking step* — they just type "just do it / fix it" instead of stating goal, context, constraints, expected behavior, and verification. `prompt-coach` exists to **reintroduce that thinking step** without slowing the user down.

## How that intent maps to the product
- **Capture** every coding prompt locally so users can review their own pattern, not just the result.
- **Score (0–100)** with a deterministic rubric whose axes correspond to the missing thinking steps: target, context, constraints, output format, verification.
- **Coach** (`improve`, `coach_prompt`, `prepare_agent_rewrite`) shows a redacted, copy-ready improved draft so the user *sees* what their request was missing — instead of silently auto-rewriting.
- **Habits / archive score** surface recurring weak patterns (e.g. "verification step missing 8 of last 10 prompts").
- **Project instructions review** pushes the same discipline onto `CLAUDE.md` / `AGENTS.md`.
- **Practice workspace** lets users rehearse improved requests without storing draft text.

## Design implications when changing this codebase
- Coaching surfaces must teach, not replace. Keep approval-required, copy-based flows. Never auto-submit a rewrite.
- The score rubric and improve hints are the *user-visible thinking checklist*. Changes that weaken any of the five axes (target / context / constraints / output / verification) work against the product thesis.
- Friction must stay low: hook fail-open, sub-second scoring, status line + buddy + statusline HUD exist so the thinking step lands in the user's existing flow rather than another tab.
- Avoid features that let the user skip thinking (e.g. silent auto-rewrite-and-resubmit). They directly contradict the thesis.

## What this is *not*
- Not a cloud prompt manager.
- Not an automatic prompt resubmitter.
- Not a generic prompt library.
- Not a hidden LLM proxy.
