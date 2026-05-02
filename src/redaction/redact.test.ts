import { describe, expect, it } from "vitest";

import { redactPrompt } from "./redact.js";

describe("redactPrompt", () => {
  it("masks explicit secret assignments", () => {
    const rawPassword = "super-secret-value";
    const rawToken = "abc123-local-token";
    const result = redactPrompt(
      `Use password=${rawPassword} and client_secret: "${rawToken}" for the local check.`,
      "mask",
    );

    expect(result.is_sensitive).toBe(true);
    expect(result.stored_text).toContain("[REDACTED:secret_assignment]");
    expect(result.stored_text).not.toContain(rawPassword);
    expect(result.stored_text).not.toContain(rawToken);
    expect(result.findings.map((finding) => finding.detector_type)).toContain(
      "secret_assignment",
    );
  });
});
