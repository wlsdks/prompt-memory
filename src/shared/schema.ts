import { z } from "zod";

export const ToolNameSchema = z.enum([
  "claude-code",
  "codex",
  "manual",
  "unknown",
]);

export const RedactionPolicySchema = z.enum(["mask", "raw", "reject"]);

export const IndexStatusSchema = z.enum([
  "indexed",
  "missing_file",
  "hash_mismatch",
  "corrupt_frontmatter",
]);

export const JsonRecordSchema = z.record(z.string(), z.unknown());

export const NormalizedPromptEventSchema = z.object({
  tool: ToolNameSchema,
  source_event: z.string().min(1),
  prompt: z.string(),
  session_id: z.string().min(1),
  cwd: z.string().min(1),
  created_at: z.string().min(1),
  received_at: z.string().min(1),
  idempotency_key: z.string().min(1),
  raw_event_hash: z.string().min(1).optional(),
  adapter_version: z.string().min(1),
  schema_version: z.number().int().positive(),

  turn_id: z.string().min(1).optional(),
  transcript_path: z.string().min(1).optional(),
  project_root: z.string().min(1).optional(),
  git_branch: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  permission_mode: z.string().min(1).optional(),
  agent_id: z.string().min(1).optional(),
  agent_type: z.string().min(1).optional(),
  raw_metadata: JsonRecordSchema.optional(),
});

export const StoredPromptSchema = z.object({
  id: z.string().min(1),
  tool: ToolNameSchema,
  source_event: z.string().min(1),
  project_id: z.string().min(1).optional(),
  session_id: z.string().min(1),
  turn_id: z.string().min(1).optional(),
  cwd: z.string().min(1),
  project_root: z.string().min(1).optional(),
  git_branch: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  permission_mode: z.string().min(1).optional(),
  created_at: z.string().min(1),
  received_at: z.string().min(1),
  markdown_path: z.string().min(1),
  stored_content_hash: z.string().min(1),
  raw_content_hash: z.string().min(1).optional(),
  prompt_length: z.number().int().nonnegative(),
  is_sensitive: z.boolean(),
  excluded_from_analysis: z.boolean(),
  redaction_policy: RedactionPolicySchema,
  adapter_version: z.string().min(1),
  index_status: IndexStatusSchema,
});

export const RedactionResultSchema = z.object({
  policy: RedactionPolicySchema,
  stored_text: z.string(),
  is_sensitive: z.boolean(),
  findings: z.array(
    z.object({
      detector_type: z.string().min(1),
      range_start: z.number().int().nonnegative(),
      range_end: z.number().int().nonnegative(),
      replacement: z.string().optional(),
    }),
  ),
});

export const PromptQualityCriterionSchema = z.enum([
  "goal_clarity",
  "background_context",
  "scope_limits",
  "output_format",
  "verification_criteria",
]);

export const PromptQualityStatusSchema = z.enum(["good", "weak", "missing"]);

export const PromptTagSchema = z.enum([
  "bugfix",
  "refactor",
  "docs",
  "test",
  "ui",
  "backend",
  "security",
  "db",
  "release",
  "ops",
]);

export const PromptQualityChecklistItemSchema = z.object({
  key: PromptQualityCriterionSchema,
  label: z.string().min(1),
  status: PromptQualityStatusSchema,
  reason: z.string().min(1),
  suggestion: z.string().min(1).optional(),
});

export const PromptAnalysisPreviewSchema = z.object({
  summary: z.string(),
  warnings: z.array(z.string()),
  suggestions: z.array(z.string()),
  checklist: z.array(PromptQualityChecklistItemSchema),
  tags: z.array(PromptTagSchema),
  analyzer: z.string().min(1),
  created_at: z.string().min(1),
});

export const ClaudeCodeUserPromptSubmitPayloadSchema = z.object({
  session_id: z.string().min(1),
  transcript_path: z.string().min(1).optional(),
  cwd: z.string().min(1),
  permission_mode: z.string().min(1).optional(),
  hook_event_name: z.literal("UserPromptSubmit"),
  prompt: z.string(),
});

export const CodexUserPromptSubmitPayloadSchema = z.object({
  session_id: z.string().min(1),
  turn_id: z.string().min(1).optional(),
  transcript_path: z.string().min(1).optional(),
  cwd: z.string().min(1),
  hook_event_name: z.literal("UserPromptSubmit"),
  model: z.string().min(1).optional(),
  prompt: z.string(),
});

export type ToolName = z.infer<typeof ToolNameSchema>;
export type RedactionPolicy = z.infer<typeof RedactionPolicySchema>;
export type NormalizedPromptEvent = z.infer<typeof NormalizedPromptEventSchema>;
export type StoredPrompt = z.infer<typeof StoredPromptSchema>;
export type RedactionResult = z.infer<typeof RedactionResultSchema>;
export type PromptQualityCriterion = z.infer<
  typeof PromptQualityCriterionSchema
>;
export type PromptQualityStatus = z.infer<typeof PromptQualityStatusSchema>;
export type PromptTag = z.infer<typeof PromptTagSchema>;
export type PromptQualityChecklistItem = z.infer<
  typeof PromptQualityChecklistItemSchema
>;
export type PromptAnalysisPreview = z.infer<typeof PromptAnalysisPreviewSchema>;
