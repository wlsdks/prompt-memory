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

  it("masks absolute filesystem paths in prompt bodies", () => {
    const rawPath = "/Users/example/private-project/src/secret.ts";
    const result = redactPrompt(`Open ${rawPath} and inspect it.`, "mask");

    expect(result.stored_text).toContain("[REDACTED:path]");
    expect(result.stored_text).not.toContain(rawPath);
    expect(result.findings.map((finding) => finding.detector_type)).toContain(
      "path",
    );
  });

  it("masks Google and Gemini API key values", () => {
    const rawGoogleKey = createFakeGoogleApiKey();
    const result = redactPrompt(
      `Set GEMINI_API_KEY=${rawGoogleKey} before running the model smoke.`,
      "mask",
    );

    expect(result.is_sensitive).toBe(true);
    expect(result.stored_text).toContain("[REDACTED:api_key]");
    expect(result.stored_text).not.toContain(rawGoogleKey);
    expect(result.findings.map((finding) => finding.detector_type)).toContain(
      "api_key",
    );
  });
});

function createFakeGoogleApiKey(): string {
  return ["AI", "za", "Sy", "A1234567890abcdefghijklmnopqrstuvwxyz"].join("");
}
