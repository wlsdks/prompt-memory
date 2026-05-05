import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptMemory } from "../config/config.js";
import { readLastHookStatus } from "./hook-status.js";
import { runClaudeCodeHook, runCodexHook } from "./wrapper.js";

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
    const rawPrompt = "do not leak sk-proj-1234567890abcdef";
    const result = await runClaudeCodeHook({
      stdin: JSON.stringify({ prompt: rawPrompt }),
      dataDir: createTempDir(),
      postPayload: async () => {
        throw new Error("server down");
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(JSON.stringify(result)).not.toContain(rawPrompt);
  });

  it("records a failed last_ingest_status when the post throws so doctor can surface it", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    await runClaudeCodeHook({
      stdin: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "session-fail",
        cwd: "/repo",
        prompt: "any prompt",
      }),
      dataDir,
      postPayload: async () => {
        throw new Error("ECONNREFUSED");
      },
    });

    const status = readLastHookStatus(dataDir);
    expect(status?.ok).toBe(false);
    expect(status?.checked_at).toBeTruthy();
  });

  it("can block and copy a weak prompt when rewrite guard is enabled", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });
    const copied: string[] = [];

    const result = await runClaudeCodeHook({
      stdin: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "session-rewrite",
        cwd: "/repo",
        prompt: "fix this with sk-proj-1234567890abcdef",
      }),
      dataDir,
      rewriteGuard: {
        mode: "block-and-copy",
        minScore: 100,
        copyToClipboard: (text) => {
          copied.push(text);
          return true;
        },
      },
      postPayload: async () => ({ ok: true, status: 200 }),
    });

    const output = JSON.parse(result.stdout) as {
      decision: "block";
      reason: string;
    };

    expect(output.decision).toBe("block");
    expect(output.reason).toContain("Improved prompt:");
    expect(output.reason).not.toContain("sk-proj-1234567890abcdef");
    expect(copied).toHaveLength(1);
    expect(result.stderr).toBe("");
  });

  it("does not block when ingest returns a non-ok response", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    const result = await runClaudeCodeHook({
      stdin: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        session_id: "session-rewrite-non-ok",
        cwd: "/repo",
        prompt: "fix",
      }),
      dataDir,
      rewriteGuard: {
        mode: "block-and-copy",
        minScore: 100,
      },
      postPayload: async () => ({ ok: false, status: 500 }),
    });

    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
  });
});

describe("runCodexHook", () => {
  it("posts Codex hook payload to the Codex ingest route", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const posted: unknown[] = [];

    const result = await runCodexHook({
      stdin: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        prompt: "codex prompt",
      }),
      dataDir,
      postPayload: async (request) => {
        posted.push(request);
        return { ok: true, status: 200 };
      },
    });

    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    expect(posted[0]).toMatchObject({
      ingestToken: init.hookAuth.ingest_token,
      payload: { hook_event_name: "UserPromptSubmit", prompt: "codex prompt" },
      url: `http://127.0.0.1:${init.config.server.port}/api/v1/ingest/codex`,
    });
  });

  it("fails open with empty output without leaking Codex prompt text", async () => {
    const rawPrompt = "do not leak codex prompt sk-proj-1234567890abcdef";
    const result = await runCodexHook({
      stdin: JSON.stringify({ prompt: rawPrompt }),
      dataDir: createTempDir(),
      postPayload: async () => {
        throw new Error("server down");
      },
    });

    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    expect(JSON.stringify(result)).not.toContain(rawPrompt);
  });

  it("emits suppressOutput=true on Codex rewrite-guard context output so the body stays out of the user-visible chat", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    const result = await runCodexHook({
      stdin: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        prompt: "fix",
      }),
      dataDir,
      rewriteGuard: { mode: "context", minScore: 100 },
      postPayload: async () => ({ ok: true, status: 200 }),
    });

    const output = JSON.parse(result.stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
      suppressOutput?: boolean;
    };

    expect(output.suppressOutput).toBe(true);
    expect(output.hookSpecificOutput.hookEventName).toBe("UserPromptSubmit");
    expect(output.hookSpecificOutput.additionalContext.length).toBeGreaterThan(
      0,
    );
  });

  it("does not set suppressOutput on Claude Code rewrite-guard output (existing behavior)", async () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    const result = await runClaudeCodeHook({
      stdin: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        prompt: "fix",
      }),
      dataDir,
      rewriteGuard: { mode: "context", minScore: 100 },
      postPayload: async () => ({ ok: true, status: 200 }),
    });

    const output = JSON.parse(result.stdout) as {
      suppressOutput?: boolean;
    };

    expect(output.suppressOutput).toBeUndefined();
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-hook-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
