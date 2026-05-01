import type {
  NormalizedPromptEvent,
  PromptAnalysisPreview,
  RedactionResult,
} from "../shared/schema.js";

export type StorePromptInput = {
  event: NormalizedPromptEvent;
  redaction: RedactionResult;
};

export type StorePromptResult = {
  id: string;
  duplicate: boolean;
};

export type PromptSummary = {
  id: string;
  tool: string;
  source_event: string;
  session_id: string;
  cwd: string;
  created_at: string;
  received_at: string;
  prompt_length: number;
  is_sensitive: boolean;
  excluded_from_analysis: boolean;
  redaction_policy: string;
  adapter_version: string;
  index_status: string;
  tags: string[];
  quality_gaps: string[];
};

export type PromptDetail = PromptSummary & {
  markdown: string;
  analysis?: PromptAnalysisPreview;
};

export type ListPromptsOptions = {
  limit?: number;
  cursor?: string;
  tool?: string;
  cwdPrefix?: string;
  isSensitive?: boolean;
  receivedFrom?: string;
  receivedTo?: string;
  tag?: string;
};

export type SearchPromptsOptions = Omit<ListPromptsOptions, "cursor">;

export type PromptListResult = {
  items: PromptSummary[];
  nextCursor?: string;
};

export type DeletePromptResult = {
  deleted: boolean;
};

export type DistributionBucket = {
  key: string;
  label: string;
  count: number;
  ratio: number;
};

export type MissingQualityItem = {
  key: string;
  label: string;
  missing: number;
  weak: number;
  total: number;
  rate: number;
};

export type QualityPattern = {
  project: string;
  item_key: string;
  label: string;
  count: number;
  total: number;
  message: string;
};

export type InstructionSuggestion = {
  scope: "global" | "project";
  project?: string;
  text: string;
  reason: string;
};

export type PromptQualityDashboard = {
  total_prompts: number;
  sensitive_prompts: number;
  sensitive_ratio: number;
  recent: {
    last_7_days: number;
    last_30_days: number;
  };
  distribution: {
    by_tool: DistributionBucket[];
    by_project: DistributionBucket[];
  };
  missing_items: MissingQualityItem[];
  patterns: QualityPattern[];
  instruction_suggestions: InstructionSuggestion[];
};

export type PromptStoragePort = {
  storePrompt(input: StorePromptInput): Promise<StorePromptResult>;
};

export type PromptReadStoragePort = {
  listPrompts(options?: ListPromptsOptions): PromptListResult;
  searchPrompts(
    query: string,
    options?: SearchPromptsOptions,
  ): PromptListResult;
  getPrompt(id: string): PromptDetail | undefined;
  deletePrompt(id: string): DeletePromptResult;
  getQualityDashboard(): PromptQualityDashboard;
};
