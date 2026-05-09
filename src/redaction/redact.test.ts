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

  it("masks npm publish access tokens", () => {
    const rawNpmToken = createFakeNpmToken();
    const result = redactPrompt(
      `npm publish keeps failing with token ${rawNpmToken}, what should I check?`,
      "mask",
    );

    expect(result.is_sensitive).toBe(true);
    expect(result.stored_text).toContain("[REDACTED:api_key]");
    expect(result.stored_text).not.toContain(rawNpmToken);
    expect(result.findings.map((finding) => finding.detector_type)).toContain(
      "api_key",
    );
  });

  describe("phone detector — narrow enough to avoid IPv4 / version / timestamp false positives", () => {
    it("does not mask IPv4 addresses as phone", () => {
      for (const sample of [
        "curl http://127.0.0.1:17373/api/v1/health",
        "the server bound to 192.168.1.1",
        "open http://10.0.0.1/admin",
        "The IP 255.255.255.255 is the broadcast address.",
      ]) {
        const result = redactPrompt(sample, "mask");
        expect(result.findings.map((f) => f.detector_type)).not.toContain(
          "phone",
        );
      }
    });

    it("does not mask version strings as phone", () => {
      for (const sample of [
        "Update to 0.1.0-beta.0 today.",
        "Compare 1.2.3 with 1.2.4.",
        "Node 20.20.0 vs 22.10.0",
      ]) {
        const result = redactPrompt(sample, "mask");
        expect(result.findings.map((f) => f.detector_type)).not.toContain(
          "phone",
        );
      }
    });

    it("does not mask ISO timestamps or date strings as phone", () => {
      for (const sample of [
        "Captured at 2026-05-09T10:21:38Z",
        "Effective from 2026-01-01 to 2026-12-31",
        "Window 12-34-56 is just a label, not a phone",
      ]) {
        const result = redactPrompt(sample, "mask");
        expect(result.findings.map((f) => f.detector_type)).not.toContain(
          "phone",
        );
      }
    });

    it("does not mask plain digit strings without separators as phone", () => {
      for (const sample of [
        "Order id 1234567890 in the queue",
        "session 12345678 expired",
      ]) {
        const result = redactPrompt(sample, "mask");
        expect(result.findings.map((f) => f.detector_type)).not.toContain(
          "phone",
        );
      }
    });

    it("still masks real phone numbers with separators", () => {
      for (const sample of [
        "Call +82-10-1234-5678 now.",
        "Reach out to +1 (415) 555-0123 anytime.",
        "Korean local format 010-1234-5678 here.",
        "US local 415-555-0123 with hyphens.",
        "US local 415.555.0123 with dots.",
        "(415) 555-0123 inside parens.",
        "+44 20 7946 0958 UK style",
      ]) {
        const result = redactPrompt(sample, "mask");
        expect(result.is_sensitive).toBe(true);
        expect(result.findings.map((f) => f.detector_type)).toContain("phone");
      }
    });
  });
});

function createFakeGoogleApiKey(): string {
  return ["AI", "za", "Sy", "A1234567890abcdefghijklmnopqrstuvwxyz"].join("");
}

function createFakeNpmToken(): string {
  return ["npm", "_", "0123456789ABCDEFabcdef0123456789ABCDef"].join("");
}
