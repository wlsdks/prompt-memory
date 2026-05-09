import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { normalizeCodexPayload } from "./codex.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, "fixtures/codex-user-prompt-submit.json"),
    "utf8",
  ),
) as Record<string, unknown>;

describe("normalizeCodexPayload", () => {
  it("normalizes a Codex UserPromptSubmit hook payload", () => {
    const event = normalizeCodexPayload(
      {
        ...fixture,
        session_id: " codex-session-123 ",
        turn_id: " turn-456 ",
        model: " gpt-5.5 ",
        prompt: "Review\u0000 this implementation.",
      },
      new Date("2026-05-01T12:00:00.000Z"),
    );

    expect(event).toMatchObject({
      tool: "codex",
      source_event: "UserPromptSubmit",
      prompt: "Review this implementation.",
      session_id: "codex-session-123",
      turn_id: "turn-456",
      cwd: "/Users/example/side-project/prompt-coach",
      transcript_path: "/Users/example/.codex/sessions/prompt-coach.jsonl",
      model: "gpt-5.5",
      created_at: "2026-05-01T12:00:00.000Z",
      received_at: "2026-05-01T12:00:00.000Z",
      adapter_version: "codex-v1",
      schema_version: 1,
    });
    expect(event.idempotency_key).toMatch(/^codex:codex-session-123:/);
  });

  it("rejects non-absolute Codex paths", () => {
    expect(() =>
      normalizeCodexPayload({
        ...fixture,
        cwd: "../relative-project",
      }),
    ).toThrow("Path must be absolute.");
  });
});
