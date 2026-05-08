import { isAbsolute } from "node:path";

import type { ClaudeCodeUserPromptSubmitPayload } from "./types.js";
import { buildIdempotencyKey } from "./idempotency.js";
import { ClaudeCodeUserPromptSubmitPayloadSchema } from "../shared/schema.js";
import type { NormalizedPromptEvent } from "../shared/schema.js";
import { resolveHomePath } from "../storage/paths.js";

export const CLAUDE_CODE_ADAPTER_VERSION = "claude-code-v1";

export function normalizeClaudeCodePayload(
  rawPayload: unknown,
  receivedAt = new Date(),
): NormalizedPromptEvent {
  const payload = ClaudeCodeUserPromptSubmitPayloadSchema.parse(rawPayload);
  const prompt = normalizePrompt(payload.prompt);
  const cwd = canonicalizePath(payload.cwd);
  const transcriptPath = payload.transcript_path
    ? canonicalizePath(payload.transcript_path)
    : undefined;

  return {
    tool: "claude-code",
    source_event: payload.hook_event_name,
    prompt,
    session_id: normalizeField(payload.session_id),
    cwd,
    created_at: receivedAt.toISOString(),
    received_at: receivedAt.toISOString(),
    idempotency_key: createIdempotencyKey({ ...payload, prompt, cwd }),
    adapter_version: CLAUDE_CODE_ADAPTER_VERSION,
    schema_version: 1,
    transcript_path: transcriptPath,
    permission_mode: payload.permission_mode
      ? normalizeField(payload.permission_mode)
      : undefined,
  };
}

export function normalizePrompt(prompt: string): string {
  return prompt.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function normalizeField(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
}

export function canonicalizePath(path: string): string {
  const normalized = normalizeField(path);

  if (!normalized) {
    throw new Error("Path cannot be empty.");
  }

  const resolved = resolveHomePath(normalized);

  if (!isAbsolute(normalized) && !normalized.startsWith("~")) {
    throw new Error("Path must be absolute.");
  }

  return resolved;
}

function createIdempotencyKey(
  payload: ClaudeCodeUserPromptSubmitPayload,
): string {
  const sessionId = normalizeField(payload.session_id);
  return buildIdempotencyKey("claude-code", sessionId, [
    payload.transcript_path ?? payload.cwd,
    payload.hook_event_name,
    payload.prompt,
  ]);
}
