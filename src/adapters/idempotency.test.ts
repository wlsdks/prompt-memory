import { describe, expect, it } from "vitest";

import { buildIdempotencyKey } from "./idempotency.js";

describe("buildIdempotencyKey", () => {
  it("returns a deterministic tool:sessionId:digest key", () => {
    const a = buildIdempotencyKey("claude-code", "session-1", [
      "/path",
      "UserPromptSubmit",
      "12",
    ]);
    const b = buildIdempotencyKey("claude-code", "session-1", [
      "/path",
      "UserPromptSubmit",
      "12",
    ]);
    expect(a).toBe(b);
    expect(a).toMatch(/^claude-code:session-1:[0-9a-f]{16}$/);
  });

  it("changes when any basis part changes", () => {
    const base = buildIdempotencyKey("codex", "s1", ["a", "b", "c"]);
    expect(buildIdempotencyKey("codex", "s1", ["a", "b", "d"])).not.toBe(base);
    expect(buildIdempotencyKey("codex", "s1", ["a", "x", "c"])).not.toBe(base);
    expect(buildIdempotencyKey("codex", "s2", ["a", "b", "c"])).not.toBe(base);
    expect(buildIdempotencyKey("claude-code", "s1", ["a", "b", "c"])).not.toBe(
      base,
    );
  });
});
