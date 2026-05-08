import { describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "./claude-code.js";

const basePayload = {
  session_id: "session-1",
  transcript_path: "/Users/example/.claude/session.jsonl",
  cwd: "/Users/example/project",
  permission_mode: "default",
  hook_event_name: "UserPromptSubmit",
} as const;

describe("normalizeClaudeCodePayload idempotency_key", () => {
  it("differs when two prompts in the same session share the same length but differ in content", () => {
    const a = normalizeClaudeCodePayload({
      ...basePayload,
      prompt: "Add caching",
    });
    const b = normalizeClaudeCodePayload({
      ...basePayload,
      prompt: "Refactor x!",
    });

    expect(a.prompt.length).toBe(b.prompt.length);
    expect(a.idempotency_key).not.toBe(b.idempotency_key);
  });

  it("matches for identical session_id + prompt content (true duplicate)", () => {
    const a = normalizeClaudeCodePayload({ ...basePayload, prompt: "Same" });
    const b = normalizeClaudeCodePayload({ ...basePayload, prompt: "Same" });
    expect(a.idempotency_key).toBe(b.idempotency_key);
  });
});
