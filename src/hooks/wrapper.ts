import { readFileSync } from "node:fs";

import { loadHookAuth, loadPromptMemoryConfig } from "../config/config.js";
import {
  postHookPayload,
  type PostHookPayloadResult,
  type PostHookPayloadRequest,
} from "./post-to-server.js";
import { writeLastHookStatus } from "./hook-status.js";
import {
  createPromptRewriteGuardOutput,
  type PromptRewriteGuardMode,
} from "./rewrite-guard.js";

export type HookRunResult = {
  exitCode: 0;
  stdout: string;
  stderr: "";
};

export type RunClaudeCodeHookOptions = {
  stdin: string;
  dataDir?: string;
  timeoutMs?: number;
  rewriteGuard?: {
    mode?: PromptRewriteGuardMode;
    minScore?: number;
    language?: "en" | "ko";
    copyToClipboard?: (text: string) => boolean;
    suppressOutput?: boolean;
  };
  postPayload?: (
    request: PostHookPayloadRequest,
  ) => Promise<PostHookPayloadResult>;
};

export async function runClaudeCodeHook(
  options: RunClaudeCodeHookOptions,
): Promise<HookRunResult> {
  return runPromptMemoryHook(options, "claude-code");
}

export async function runCodexHook(
  options: RunClaudeCodeHookOptions,
): Promise<HookRunResult> {
  return runPromptMemoryHook(options, "codex");
}

async function runPromptMemoryHook(
  options: RunClaudeCodeHookOptions,
  tool: "claude-code" | "codex",
): Promise<HookRunResult> {
  let stdout = "";
  try {
    const payload = JSON.parse(options.stdin);
    const config = loadPromptMemoryConfig(options.dataDir);
    const hookAuth = loadHookAuth(options.dataDir);
    const postPayload = options.postPayload ?? postHookPayload;
    const url = `http://${config.server.host}:${config.server.port}/api/v1/ingest/${tool}`;

    const result = await postPayload({
      url,
      ingestToken: hookAuth.ingest_token,
      payload,
      timeoutMs: options.timeoutMs ?? 750,
    });
    writeLastHookStatus(options.dataDir, {
      ok: result.ok,
      status: result.status,
      checked_at: new Date().toISOString(),
    });

    if (result.ok) {
      const rewriteOutput = createPromptRewriteGuardOutput(payload, {
        ...options.rewriteGuard,
        now: new Date(),
        // Codex renders hook stdout (additionalContext / block reason) directly
        // in the user-visible chat. Setting `suppressOutput: true` keeps the
        // guidance available to the model while hiding it from the user, which
        // is the same effective behavior Claude Code already gives by default.
        suppressOutput:
          options.rewriteGuard?.suppressOutput ?? tool === "codex",
      });
      stdout = rewriteOutput ? `${JSON.stringify(rewriteOutput)}\n` : "";
    }
  } catch {
    // Hooks must fail open and must not leak prompt text to stdout/stderr.
    // Record the failure so doctor can surface "Last ingest: failed" with a
    // next-step hint instead of going silent on transport/parse errors.
    try {
      writeLastHookStatus(options.dataDir, {
        ok: false,
        checked_at: new Date().toISOString(),
      });
    } catch {
      // status write may fail if data dir is unavailable; stay fail-open.
    }
  }

  return { exitCode: 0, stdout, stderr: "" };
}

export async function readStdin(): Promise<string> {
  return readFileSync(0, "utf8");
}
