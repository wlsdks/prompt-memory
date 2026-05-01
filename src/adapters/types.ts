import type { z } from "zod";

import type {
  ClaudeCodeUserPromptSubmitPayloadSchema,
  CodexUserPromptSubmitPayloadSchema,
  NormalizedPromptEvent,
} from "../shared/schema.js";

export type AdapterName = "claude-code" | "codex";

export type ClaudeCodeUserPromptSubmitPayload = z.infer<
  typeof ClaudeCodeUserPromptSubmitPayloadSchema
>;

export type CodexUserPromptSubmitPayload = z.infer<
  typeof CodexUserPromptSubmitPayloadSchema
>;

export type PromptAdapter<TPayload> = {
  name: AdapterName;
  version: string;
  normalize(payload: TPayload): NormalizedPromptEvent;
};
