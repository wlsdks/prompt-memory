import { describe, expect, it } from "vitest";

import { createPromptId } from "./ids.js";

describe("createPromptId", () => {
  it("is deterministic when time and randomness are provided", () => {
    const id = createPromptId({
      now: new Date("2026-05-01T10:30:00.000Z"),
      random: Uint8Array.from([0xab, 0x12, 0xcd]),
    });

    expect(id).toBe("prmt_20260501_103000_ab12cd");
  });
});
