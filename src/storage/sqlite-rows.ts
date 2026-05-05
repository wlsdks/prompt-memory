export type PromptRow = {
  id: string;
  idempotency_key: string;
  stored_content_hash: string;
  tool: string;
  source_event: string;
  session_id: string;
  cwd: string;
  created_at: string;
  received_at: string;
  markdown_path: string;
  markdown_schema_version: number;
  prompt_length: number;
  is_sensitive: number;
  excluded_from_analysis: number;
  redaction_policy: string;
  adapter_version: string;
  index_status: string;
};

export type PromptAnalysisRow = {
  warnings_json: string | null;
  checklist_json: string | null;
  tags_json: string | null;
  analyzer: string;
  created_at: string;
};

export type PromptQualityRow = {
  prompt_id: string;
  received_at: string;
  is_sensitive: number;
  cwd: string;
  project_root: string | null;
  checklist_json: string | null;
  tags_json: string | null;
};

export type PromptUsefulnessRow = {
  copied_count: number;
  last_copied_at: string | null;
  bookmarked_at: string | null;
};

export type UsefulPromptRow = PromptRow & PromptUsefulnessRow;

export type PromptSignalRow = {
  checklist_json: string | null;
  tags_json: string | null;
};

export type PromptWithSignalRow = PromptRow & PromptSignalRow;

export type ProjectPolicyRow = {
  project_key: string;
  display_alias: string | null;
  capture_disabled: number;
  analysis_disabled: number;
  retention_candidate_days: number | null;
  external_analysis_opt_in: number;
  export_disabled: number;
  version: number;
  updated_at: string;
};

export type ProjectPromptRow = {
  id: string;
  cwd: string;
  project_root: string | null;
  received_at: string;
  is_sensitive: number;
  checklist_json: string | null;
  copied_count: number;
  bookmarked_count: number;
};

export type ProjectInstructionReviewRow = {
  project_key: string;
  generated_at: string;
  analyzer: string;
  score: number;
  score_band: string;
  files_found: number;
  files_json: string;
  checklist_json: string;
  suggestions_json: string;
  privacy_json: string;
};

export type ImportJobRow = {
  id: string;
  source_type: string;
  source_path_hash: string;
  dry_run: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  project_policy_version: number | null;
  summary_json: string;
};

export type ImportRecordRow = {
  job_id: string;
  record_key: string;
  record_offset: number | null;
  status: string;
  prompt_id: string | null;
  error_code: string | null;
};

export type ExportJobRow = {
  id: string;
  preset: string;
  status: string;
  prompt_id_hashes_json: string;
  project_policy_versions_json: string;
  redaction_version: string;
  counts_json: string;
  expires_at: string;
  created_at: string;
};

export type PromptImprovementDraftRow = {
  id: string;
  prompt_id: string;
  draft_text: string;
  analyzer: string;
  changed_sections_json: string | null;
  safety_notes_json: string | null;
  is_sensitive: number;
  redaction_policy: string;
  created_at: string;
  copied_at: string | null;
  accepted_at: string | null;
};

export type AgentPromptJudgmentRow = {
  id: string;
  prompt_id: string;
  provider: string;
  judge_model: string | null;
  score: number;
  confidence: number;
  summary: string;
  strengths_json: string | null;
  risks_json: string | null;
  suggestions_json: string | null;
  created_at: string;
};

export type RebuildPromptRow = {
  id: string;
  markdown_path: string;
  received_at: string;
};
