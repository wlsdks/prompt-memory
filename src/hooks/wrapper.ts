import { readFileSync } from "node:fs";

import { loadHookAuth, loadPromptMemoryConfig } from "../config/config.js";
import {
  postHookPayload,
  type PostHookPayloadResult,
  type PostHookPayloadRequest,
} from "./post-to-server.js";
import { writeLastHookStatus } from "./hook-status.js";

export type HookRunResult = {
  exitCode: 0;
  stdout: "";
  stderr: "";
};

export type RunClaudeCodeHookOptions = {
  stdin: string;
  dataDir?: string;
  timeoutMs?: number;
  postPayload?: (
    request: PostHookPayloadRequest,
  ) => Promise<PostHookPayloadResult>;
};

export async function runClaudeCodeHook(
  options: RunClaudeCodeHookOptions,
): Promise<HookRunResult> {
  try {
    const payload = JSON.parse(options.stdin);
    const config = loadPromptMemoryConfig(options.dataDir);
    const hookAuth = loadHookAuth(options.dataDir);
    const postPayload = options.postPayload ?? postHookPayload;
    const url = `http://${config.server.host}:${config.server.port}/api/v1/ingest/claude-code`;

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
  } catch {
    // Hooks must fail open and must not leak prompt text to stdout/stderr.
  }

  return { exitCode: 0, stdout: "", stderr: "" };
}

export async function readStdin(): Promise<string> {
  return readFileSync(0, "utf8");
}
