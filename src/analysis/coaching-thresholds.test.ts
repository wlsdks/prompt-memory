import { describe, expect, it } from "vitest";

import {
  DEFAULT_MIN_SCORE,
  evaluatePromptCoaching,
} from "./coaching-thresholds.js";

const NOW = new Date("2026-05-08T00:00:00.000Z");

describe("DEFAULT_MIN_SCORE", () => {
  it("is the threshold both the rewrite-guard hook and pc-claude/pc-codex wrapper used to define independently", () => {
    expect(DEFAULT_MIN_SCORE).toBe(80);
  });
});

describe("evaluatePromptCoaching", () => {
  it("returns empty_prompt without calling analyze when the prompt is blank", () => {
    const result = evaluatePromptCoaching("   \n\t", { now: NOW });
    expect(result).toEqual({
      needed: false,
      reason: "empty_prompt",
      score: 0,
    });
  });

  it("returns above_threshold when the prompt scores at or above minScore and does not produce an improvement", () => {
    const strongPrompt =
      "Refactor the authentication module to support OAuth 2.0 across the legacy /v1/login endpoint and the new /v2/session endpoint. " +
      "Background: we currently store session tokens server-side in Redis with a 24-hour TTL; we need to keep that flow for legacy clients while issuing OAuth tokens for new clients. " +
      "Scope: only changes inside src/server/auth and src/storage/sessions; do not touch billing or Stripe integration. " +
      "Output format: a single PR that updates the route handlers, adds typed config for the OAuth issuer, and includes a migration note in docs/AUTH.md. " +
      "Verification: existing session-cookie tests pass, new OAuth integration tests cover refresh-token rotation, and `pnpm test` is green.";

    const result = evaluatePromptCoaching(strongPrompt, {
      minScore: 1,
      now: NOW,
    });
    expect(result.needed).toBe(false);
    if (!result.needed) {
      expect(result.reason).toBe("above_threshold");
      expect(result.score).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns needed=true with analysis + improvement when the prompt scores below minScore", () => {
    const weakPrompt = "fix the bug";
    const result = evaluatePromptCoaching(weakPrompt, {
      minScore: 100,
      now: NOW,
      language: "en",
    });
    expect(result.needed).toBe(true);
    if (result.needed) {
      expect(result.score).toBeLessThan(100);
      expect(result.analysis.quality_score.value).toBe(result.score);
      expect(result.improvement.improved_prompt).toBeTypeOf("string");
      expect(result.language).toBe("en");
    }
  });

  it("auto-detects language from the prompt when not explicitly provided", () => {
    const koreanWeakPrompt = "버그 고쳐줘";
    const result = evaluatePromptCoaching(koreanWeakPrompt, {
      minScore: 100,
      now: NOW,
    });
    expect(result.needed).toBe(true);
    if (result.needed) {
      expect(result.language).toBe("ko");
    }
  });

  it("uses DEFAULT_MIN_SCORE when minScore is not provided", () => {
    const weakPrompt = "fix the bug";
    const withDefault = evaluatePromptCoaching(weakPrompt, { now: NOW });
    const withExplicit = evaluatePromptCoaching(weakPrompt, {
      now: NOW,
      minScore: DEFAULT_MIN_SCORE,
    });
    expect(withDefault).toMatchObject({
      needed: withExplicit.needed,
      score: withExplicit.score,
    });
  });
});
