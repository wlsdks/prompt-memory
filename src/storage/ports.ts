import type {
  NormalizedPromptEvent,
  PromptAnalysisPreview,
  PromptQualityCriterion,
  PromptQualityScoreBand,
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
  quality_score: number;
  quality_score_band: PromptQualityScoreBand;
  usefulness: PromptUsefulness;
  duplicate_count: number;
};

export type PromptDetail = PromptSummary & {
  markdown: string;
  analysis?: PromptAnalysisPreview;
  improvement_drafts: PromptImprovementDraft[];
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
  importJobId?: string;
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
  average_quality_score: number;
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

export type ProjectInstructionChecklistItem = {
  key:
    | "project_context"
    | "agent_workflow"
    | "verification"
    | "privacy_safety"
    | "collaboration_output";
  label: string;
  status: "good" | "weak" | "missing";
  weight: number;
  earned: number;
  suggestion?: string;
};

export type ProjectInstructionFileSnapshot = {
  file_name: string;
  bytes: number;
  modified_at: string;
  content_hash: string;
  truncated: boolean;
};

export type ProjectInstructionReview = {
  generated_at: string;
  analyzer: string;
  score: {
    value: number;
    max: 100;
    band: PromptQualityScoreBand;
  };
  files: ProjectInstructionFileSnapshot[];
  files_found: number;
  checklist: ProjectInstructionChecklistItem[];
  suggestions: string[];
  privacy: {
    local_only: true;
    external_calls: false;
    stores_file_bodies: false;
    returns_file_bodies: false;
    returns_raw_paths: false;
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
      average_quality_score: number;
      sensitive_count: number;
    }>;
  };
  quality_score: {
    average: number;
    max: 100;
    band: PromptQualityScoreBand;
    scored_prompts: number;
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
  instruction_review?: ProjectInstructionReview;
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

export type ImportRecordStatus = "imported" | "duplicate" | "skipped" | "error";

export type ImportRecord = {
  job_id: string;
  record_key: string;
  record_offset?: number;
  status: ImportRecordStatus;
  prompt_id?: string;
  error_code?: string;
};

export type CreateImportJobInput = {
  source_type: string;
  source_path_hash: string;
  dry_run: boolean;
  status: ImportJobStatus;
  project_policy_version?: number;
  summary: unknown;
};

export type CreateImportRecordInput = {
  job_id: string;
  record_key: string;
  record_offset?: number;
  status: ImportRecordStatus;
  prompt_id?: string;
  error_code?: string;
};

export type ImportJobListResult = {
  items: ImportJob[];
};

export type ExportPreset =
  | "personal_backup"
  | "anonymized_review"
  | "issue_report_attachment";

export type ExportJobStatus = "previewed" | "completed" | "invalid";

export type ExportPreviewCounts = {
  prompt_count: number;
  sensitive_count: number;
  included_fields: string[];
  excluded_fields: string[];
  residual_identifier_counts: Record<string, number>;
  small_set_warning: boolean;
};

export type ExportJob = {
  id: string;
  preset: ExportPreset;
  status: ExportJobStatus;
  prompt_id_hashes: string[];
  project_policy_versions: Record<string, number>;
  redaction_version: string;
  counts: ExportPreviewCounts;
  expires_at: string;
  created_at: string;
};

export type CreateExportJobInput = {
  preset: ExportPreset;
  status: ExportJobStatus;
  prompt_id_hashes: string[];
  project_policy_versions: Record<string, number>;
  redaction_version: string;
  counts: ExportPreviewCounts;
  expires_at: string;
};

export type PromptImprovementDraft = {
  id: string;
  prompt_id: string;
  draft_text: string;
  analyzer: string;
  changed_sections: PromptQualityCriterion[];
  safety_notes: string[];
  is_sensitive: boolean;
  redaction_policy: "mask";
  created_at: string;
  copied_at?: string;
  accepted_at?: string;
};

export type CreatePromptImprovementDraftInput = {
  draft_text: string;
  analyzer: string;
  changed_sections?: PromptQualityCriterion[];
  safety_notes?: string[];
  copied?: boolean;
  accepted?: boolean;
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
  createPromptImprovementDraft(
    promptId: string,
    input: CreatePromptImprovementDraftInput,
  ): PromptImprovementDraft | undefined;
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

export type ProjectInstructionStoragePort = {
  getProjectInstructionReview(
    projectId: string,
  ): ProjectInstructionReview | undefined;
  analyzeProjectInstructions(
    projectId: string,
  ): ProjectInstructionReview | undefined;
};

export type ImportJobStoragePort = {
  createImportJob(input: CreateImportJobInput): ImportJob;
  completeImportJob(
    id: string,
    status: ImportJobStatus,
    summary: unknown,
  ): ImportJob | undefined;
  createImportRecord(input: CreateImportRecordInput): ImportRecord;
  getImportJob(id: string): ImportJob | undefined;
  listImportJobs(options?: { limit?: number }): ImportJobListResult;
  listImportRecords(jobId: string): ImportRecord[];
};

export type ExportJobStoragePort = {
  createExportJob(input: CreateExportJobInput): ExportJob;
  getExportJob(id: string): ExportJob | undefined;
  updateExportJobStatus(
    id: string,
    status: ExportJobStatus,
  ): ExportJob | undefined;
};
