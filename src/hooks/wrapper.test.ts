import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptMemory } from "../config/config.js";
import { runClaudeCodeHook } from "./wrapper.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("runClaudeCodeHook", () => {
  it("reads stdin, token file, and posts to local ingest without stdout/stderr", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const posted: unknown[] = [];

    const result = await runClaudeCodeHook({
      stdin: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        prompt: "secret",
      }),
      dataDir,
      postPayload: async (request) => {
        posted.push(request);
        return { ok: true, status: 200 };
      },
    });

    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      ingestToken: init.hookAuth.ingest_token,
      payload: { hook_event_name: "UserPromptSubmit", prompt: "secret" },
      url: `http://127.0.0.1:${init.config.server.port}/api/v1/ingest/claude-code`,
    });
  });

  it("fails open with empty output when config/token/server handling fails", async () => {
    const result = await runClaudeCodeHook({
      stdin: JSON.stringify({ prompt: "do not leak this prompt" }),
      dataDir: createTempDir(),
      postPayload: async () => {
        throw new Error("server down");
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-hook-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
