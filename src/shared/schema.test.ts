import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ClaudeCodeUserPromptSubmitPayloadSchema,
  CodexUserPromptSubmitPayloadSchema,
  NormalizedPromptEventSchema,
  RedactionResultSchema,
  StoredPromptSchema,
} from "./schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("shared schemas", () => {
  it("validates adapter fixtures", () => {
    const claudeFixture = readFixture(
      "../adapters/fixtures/claude-code-user-prompt-submit.json",
    );
    const codexFixture = readFixture(
      "../adapters/fixtures/codex-user-prompt-submit.json",
    );

    expect(() =>
      ClaudeCodeUserPromptSubmitPayloadSchema.parse(claudeFixture),
    ).not.toThrow();
    expect(() =>
      CodexUserPromptSubmitPayloadSchema.parse(codexFixture),
    ).not.toThrow();
  });

  it("validates core contracts", () => {
    expect(() =>
      NormalizedPromptEventSchema.parse({
        tool: "claude-code",
        source_event: "UserPromptSubmit",
        prompt: "Please implement P1.",
        session_id: "session-1",
        cwd: "/tmp/project",
        created_at: "2026-05-01T00:00:00.000Z",
        received_at: "2026-05-01T00:00:01.000Z",
        idempotency_key: "claude-code:session-1:turn-1",
        adapter_version: "claude-code-v1",
        schema_version: 1,
      }),
    ).not.toThrow();

    expect(() =>
      StoredPromptSchema.parse({
        id: "prmt_20260501_000001_abcdef",
        tool: "claude-code",
        source_event: "UserPromptSubmit",
        session_id: "session-1",
        cwd: "/tmp/project",
        created_at: "2026-05-01T00:00:00.000Z",
        received_at: "2026-05-01T00:00:01.000Z",
        markdown_path: "/tmp/project/prompt.md",
        stored_content_hash: "hmac-sha256:abc",
        prompt_length: 20,
        is_sensitive: false,
        excluded_from_analysis: false,
        redaction_policy: "mask",
        adapter_version: "claude-code-v1",
        index_status: "indexed",
      }),
    ).not.toThrow();

    expect(() =>
      RedactionResultSchema.parse({
        policy: "mask",
        stored_text: "token [REDACTED:api_key]",
        is_sensitive: true,
        findings: [
          {
            detector_type: "api_key",
            range_start: 6,
            range_end: 20,
            replacement: "[REDACTED:api_key]",
          },
        ],
      }),
    ).not.toThrow();
  });
});

function readFixture(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(__dirname, relativePath), "utf8"));
}
