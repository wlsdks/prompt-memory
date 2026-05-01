import { describe, expect, it } from "vitest";

import { createStoredContentHash } from "./hashing.js";

describe("createStoredContentHash", () => {
  it("does not expose raw prompt content", () => {
    const rawPrompt = "secret prompt with api key sk-test";
    const hash = createStoredContentHash(rawPrompt, "test-secret");

    expect(hash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(hash).not.toContain(rawPrompt);
    expect(hash).not.toContain("sk-test");
  });
});
