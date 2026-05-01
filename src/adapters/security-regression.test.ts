import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "./claude-code.js";
import { normalizeCodexPayload } from "./codex.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const claudeFixture = readFixture(
  "fixtures/claude-code-user-prompt-submit.json",
);
const codexFixture = readFixture("fixtures/codex-user-prompt-submit.json");

describe("adapter security regressions", () => {
  it("does not retain upstream auth/session tokens from hook payloads", () => {
    const claudeEvent = normalizeClaudeCodePayload({
      ...claudeFixture,
      claude_ai_oauth_token: "claude-oauth-token-should-not-persist",
      claude_code_internal_auth_token:
        "claude-internal-token-should-not-persist",
      prompt: "normal prompt",
    });
    const codexEvent = normalizeCodexPayload({
      ...codexFixture,
      openai_session_token: "openai-session-token-should-not-persist",
      chatgpt_account_cookie: "chatgpt-cookie-should-not-persist",
      prompt: "normal prompt",
    });

    const serialized = JSON.stringify([claudeEvent, codexEvent]);

    expect(serialized).not.toContain("claude-oauth-token-should-not-persist");
    expect(serialized).not.toContain(
      "claude-internal-token-should-not-persist",
    );
    expect(serialized).not.toContain("openai-session-token-should-not-persist");
    expect(serialized).not.toContain("chatgpt-cookie-should-not-persist");
  });
});

function readFixture(relativePath: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(resolve(__dirname, relativePath), "utf8"),
  ) as Record<string, unknown>;
}
