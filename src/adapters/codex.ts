import type { CodexUserPromptSubmitPayload } from "./types.js";
import {
  canonicalizePath,
  normalizeField,
  normalizePrompt,
} from "./claude-code.js";
import { buildIdempotencyKey } from "./idempotency.js";
import { CodexUserPromptSubmitPayloadSchema } from "../shared/schema.js";
import type { NormalizedPromptEvent } from "../shared/schema.js";

export const CODEX_ADAPTER_VERSION = "codex-v1";

export function normalizeCodexPayload(
  rawPayload: unknown,
  receivedAt = new Date(),
): NormalizedPromptEvent {
  const payload = CodexUserPromptSubmitPayloadSchema.parse(rawPayload);
  const prompt = normalizePrompt(payload.prompt);
  const cwd = canonicalizePath(payload.cwd);
  const transcriptPath = payload.transcript_path
    ? canonicalizePath(payload.transcript_path)
    : undefined;

  return {
    tool: "codex",
    source_event: payload.hook_event_name,
    prompt,
    session_id: normalizeField(payload.session_id),
    cwd,
    created_at: receivedAt.toISOString(),
    received_at: receivedAt.toISOString(),
    idempotency_key: createIdempotencyKey({
      ...payload,
      prompt,
      cwd,
      transcript_path: transcriptPath,
    }),
    adapter_version: CODEX_ADAPTER_VERSION,
    schema_version: 1,
    turn_id: payload.turn_id ? normalizeField(payload.turn_id) : undefined,
    transcript_path: transcriptPath,
    model: payload.model ? normalizeField(payload.model) : undefined,
  };
}

function createIdempotencyKey(payload: CodexUserPromptSubmitPayload): string {
  const sessionId = normalizeField(payload.session_id);
  return buildIdempotencyKey("codex", sessionId, [
    payload.turn_id ? normalizeField(payload.turn_id) : "",
    payload.transcript_path ?? payload.cwd,
    payload.hook_event_name,
    payload.prompt,
  ]);
}
