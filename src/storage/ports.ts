import type {
  NormalizedPromptEvent,
  PromptAnalysisPreview,
  PromptQualityCriterion,
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
  snippet: string;
  prompt_length: number;
  is_sensitive: boolean;
  excluded_from_analysis: boolean;
  redaction_policy: string;
  adapter_version: string;
  index_status: string;
  tags: string[];
  quality_gaps: string[];
  usefulness: PromptUsefulness;
  duplicate_count: number;
};

export type PromptDetail = PromptSummary & {
  markdown: string;
  analysis?: PromptAnalysisPreview;
};

export type PromptUsefulness = {
  copied_count: number;
  last_copied_at?: string;
  bookmarked: boolean;
  bookmarked_at?: string;
};

export type PromptUsageEventType = "prompt_copied";

export type PromptUsageResult = {
  recorded: boolean;
  usefulness: PromptUsefulness;
};

export type PromptBookmarkResult = {
  updated: boolean;
  usefulness: PromptUsefulness;
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
  focus?: PromptFocusFilter;
  qualityGap?: PromptQualityCriterion;
};

export type SearchPromptsOptions = Omit<ListPromptsOptions, "cursor">;

export type PromptFocusFilter =
  | "saved"
  | "reused"
  | "duplicated"
  | "quality-gap";

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

export type UsefulPrompt = {
  id: string;
  tool: string;
  cwd: string;
  received_at: string;
  copied_count: number;
  last_copied_at?: string;
  bookmarked: boolean;
  bookmarked_at?: string;
  tags: string[];
  quality_gaps: string[];
};

export type DuplicatePromptGroup = {
  group_id: string;
  count: number;
  latest_received_at: string;
  projects: string[];
  prompts: Array<{
    id: string;
    tool: string;
    cwd: string;
    received_at: string;
    tags: string[];
    quality_gaps: string[];
  }>;
};

export type ProjectQualityProfile = {
  key: string;
  label: string;
  prompt_count: number;
  quality_gap_count: number;
  quality_gap_rate: number;
  sensitive_count: number;
  copied_count: number;
  bookmarked_count: number;
  latest_received_at: string;
  top_gap?: {
    key: string;
    label: string;
    count: number;
  };
};

export type PromptQualityDashboard = {
  total_prompts: number;
  sensitive_prompts: number;
  sensitive_ratio: number;
  recent: {
    last_7_days: number;
    last_30_days: number;
  };
  trend: {
    daily: Array<{
      date: string;
      prompt_count: number;
      quality_gap_count: number;
      quality_gap_rate: number;
      sensitive_count: number;
    }>;
  };
  distribution: {
    by_tool: DistributionBucket[];
    by_project: DistributionBucket[];
  };
  missing_items: MissingQualityItem[];
  patterns: QualityPattern[];
  instruction_suggestions: InstructionSuggestion[];
  useful_prompts: UsefulPrompt[];
  duplicate_prompt_groups: DuplicatePromptGroup[];
  project_profiles: ProjectQualityProfile[];
};

export type ProjectPolicy = {
  capture_disabled: boolean;
  analysis_disabled: boolean;
  retention_candidate_days?: number;
  external_analysis_opt_in: boolean;
  export_disabled: boolean;
  version: number;
  updated_at?: string;
};

export type ProjectSummary = {
  project_id: string;
  label: string;
  alias?: string;
  path_kind: "project_root" | "cwd";
  prompt_count: number;
  latest_ingest?: string;
  sensitive_count: number;
  quality_gap_rate: number;
  copied_count: number;
  bookmarked_count: number;
  policy: ProjectPolicy;
};

export type ProjectListResult = {
  items: ProjectSummary[];
};

export type ProjectPolicyPatch = {
  alias?: string | null;
  capture_disabled?: boolean;
  analysis_disabled?: boolean;
  retention_candidate_days?: number | null;
  external_analysis_opt_in?: boolean;
  export_disabled?: boolean;
};

export type ProjectPolicyActor = "cli" | "web" | "system";

export type ImportJobStatus =
  | "pending"
  | "dry_run_completed"
  | "running"
  | "completed"
  | "failed"
  | "canceled";

export type ImportJob = {
  id: string;
  source_type: string;
  source_path_hash: string;
  dry_run: boolean;
  status: ImportJobStatus;
  started_at: string;
  completed_at?: string;
  project_policy_version?: number;
  summary: unknown;
};

export type CreateImportJobInput = {
  source_type: string;
  source_path_hash: string;
  dry_run: boolean;
  status: ImportJobStatus;
  project_policy_version?: number;
  summary: unknown;
};

export type ImportJobListResult = {
  items: ImportJob[];
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
  recordPromptUsage(id: string, type: PromptUsageEventType): PromptUsageResult;
  setPromptBookmark(id: string, bookmarked: boolean): PromptBookmarkResult;
};

export type ProjectPolicyStoragePort = {
  listProjects(): ProjectListResult;
  updateProjectPolicy(
    projectId: string,
    patch: ProjectPolicyPatch,
    actor: ProjectPolicyActor,
  ): ProjectSummary | undefined;
  getProjectPolicyForEvent(event: {
    cwd: string;
    project_root?: string | null;
  }): ProjectPolicy | undefined;
};

export type ImportJobStoragePort = {
  createImportJob(input: CreateImportJobInput): ImportJob;
  getImportJob(id: string): ImportJob | undefined;
  listImportJobs(options?: { limit?: number }): ImportJobListResult;
};
