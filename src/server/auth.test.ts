import { describe, expect, it } from "vitest";

import { createWebSession } from "./auth.js";

describe("createWebSession", () => {
  it("keeps the cookie Max-Age and the payload expiresAt in sync", () => {
    const before = Date.now();
    const { cookie } = createWebSession("test-secret");
    const after = Date.now();

    const maxAgeMatch = /Max-Age=(\d+)/.exec(cookie);
    expect(maxAgeMatch).not.toBeNull();
    const maxAgeSeconds = Number(maxAgeMatch?.[1] ?? "");

    const tokenMatch = /prompt_memory_session=([^.;]+)\./.exec(cookie);
    expect(tokenMatch).not.toBeNull();
    const payload = JSON.parse(
      Buffer.from(tokenMatch?.[1] ?? "", "base64url").toString("utf8"),
    ) as { expiresAt: number };

    const ttlMs = payload.expiresAt - before;
    expect(ttlMs).toBeGreaterThan(maxAgeSeconds * 1000 - 1000);
    expect(ttlMs).toBeLessThanOrEqual(maxAgeSeconds * 1000 + (after - before));
  });
});
