import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../adapters/claude-code.js";
import { initializePromptMemory } from "../config/config.js";
import { redactPrompt } from "../redaction/redact.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";
import { scorePromptTool } from "./score-tool.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("scorePromptTool", () => {
  it("scores direct prompt text without echoing the raw prompt", () => {
    const result = scorePromptTool({
      prompt:
        "Because export review is unclear, inspect src/web/src/App.tsx only, run pnpm test, and return a Markdown summary.",
    });
    const serialized = JSON.stringify(result);

    expect(result.source).toBe("text");
    expect(result.quality_score.value).toBeGreaterThanOrEqual(85);
    expect(result.privacy).toEqual({
      local_only: true,
      stores_input: false,
      external_calls: false,
      returns_prompt_body: false,
    });
    expect(serialized).not.toContain("src/web/src/App.tsx only");
  });

  it("scores the latest stored prompt by id without returning the prompt body", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-02T10:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-mcp",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Make this better",
      },
      new Date("2026-05-02T09:59:00.000Z"),
    );
    const stored = await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();

    const result = scorePromptTool({ latest: true }, { dataDir });
    const serialized = JSON.stringify(result);

    expect(result.source).toBe("latest");
    expect(result.prompt_id).toBe(stored.id);
    expect(result.quality_score.value).toBeLessThanOrEqual(20);
    expect(serialized).not.toContain("Make this better");
  });

  it("returns an actionable tool error for ambiguous input", () => {
    const result = scorePromptTool({});

    expect(result.is_error).toBe(true);
    expect(result.error_code).toBe("invalid_input");
    expect(result.message).toContain("Provide exactly one");
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-mcp-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
