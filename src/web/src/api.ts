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
  analysis?: {
    redaction_notice?: string;
    checklist: Array<{
      key: string;
      label: string;
      status: "good" | "weak" | "missing";
      reason: string;
      suggestion?: string;
    }>;
    tags: string[];
    quality_score: PromptQualityScore;
    analyzer: string;
    created_at: string;
  };
  improvement_drafts: PromptImprovementDraft[];
  judge_score?: PromptJudgeScore;
};

export type PromptJudgeScore = {
  id: string;
  prompt_id: string;
  judge_tool: "claude" | "codex";
  score: number;
  reason: string;
  created_at: string;
};

export type PromptImprovementDraft = {
  id: string;
  prompt_id: string;
  draft_text: string;
  analyzer: string;
  changed_sections: PromptQualityGap[];
  safety_notes: string[];
  is_sensitive: boolean;
  redaction_policy: "mask";
  created_at: string;
  copied_at?: string;
  accepted_at?: string;
};

export type PromptUsefulness = {
  copied_count: number;
  last_copied_at?: string;
  bookmarked: boolean;
  bookmarked_at?: string;
};

export type PromptListResponse = {
  items: PromptSummary[];
  next_cursor?: string;
};

export type PromptFilters = {
  query?: string;
  tool?: string;
  cwdPrefix?: string;
  importJobId?: string;
  isSensitive?: "all" | "true" | "false";
  tag?: string;
  focus?: "saved" | "reused" | "duplicated" | "quality-gap";
  qualityGap?: PromptQualityGap;
  receivedFrom?: string;
  receivedTo?: string;
};

export type PromptQualityGap =
  | "goal_clarity"
  | "background_context"
  | "scope_limits"
  | "output_format"
  | "verification_criteria";

export type PromptQualityScoreBand =
  | "excellent"
  | "good"
  | "needs_work"
  | "weak";

export type PromptQualityScore = {
  value: number;
  max: 100;
  band: PromptQualityScoreBand;
  breakdown: Array<{
    key: PromptQualityGap;
    weight: number;
    earned: number;
  }>;
};

export type QualityDashboard = {
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
  missing_items: Array<{
    key: string;
    label: string;
    missing: number;
    weak: number;
    total: number;
    rate: number;
  }>;
  patterns: Array<{
    project: string;
    item_key: string;
    label: string;
    count: number;
    total: number;
    message: string;
  }>;
  instruction_suggestions: Array<{
    scope: "global" | "project";
    project?: string;
    text: string;
    reason: string;
  }>;
  useful_prompts: Array<{
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
  }>;
  duplicate_prompt_groups: Array<{
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
  }>;
  project_profiles: Array<{
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
  }>;
};

export type DistributionBucket = {
  key: string;
  label: string;
  count: number;
  ratio: number;
};

export type ArchivePromptScoreSummary = {
  id: string;
  tool: string;
  project: string;
  received_at: string;
  quality_score: number;
  quality_score_band: PromptQualityScoreBand;
  quality_gaps: string[];
  tags: string[];
  is_sensitive: boolean;
};

export type ArchiveScoreReport = {
  generated_at: string;
  archive_score: {
    average: number;
    max: 100;
    band: PromptQualityScoreBand;
    scored_prompts: number;
    total_prompts: number;
  };
  distribution: Record<PromptQualityScoreBand, number>;
  top_gaps: Array<{
    label: string;
    count: number;
    rate: number;
  }>;
  practice_plan: Array<{
    priority: number;
    label: string;
    prompt_rule: string;
    reason: string;
    count: number;
    rate: number;
  }>;
  next_prompt_template: string;
  low_score_prompts: ArchivePromptScoreSummary[];
  filters: {
    tool?: string;
    project?: string;
    received_from?: string;
    received_to?: string;
    max_prompts: number;
  };
  has_more: boolean;
  privacy: {
    local_only: true;
    external_calls: false;
    returns_prompt_bodies: false;
    returns_raw_paths: false;
  };
};

export type SettingsResponse = {
  data_dir: string;
  excluded_project_roots: string[];
  redaction_mode: string;
  server: {
    host: string;
    port: number;
  };
  last_ingest_status?: {
    ok: boolean;
    status?: number;
    checked_at: string;
  };
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

export type ProjectInstructionReview = {
  generated_at: string;
  analyzer: string;
  score: {
    value: number;
    max: 100;
    band: PromptQualityScoreBand;
  };
  files_found: number;
  files: Array<{
    file_name: string;
    bytes: number;
    modified_at: string;
    content_hash: string;
    truncated: boolean;
  }>;
  checklist: Array<{
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
  }>;
  suggestions: string[];
  privacy: {
    local_only: true;
    external_calls: false;
    stores_file_bodies: false;
    returns_file_bodies: false;
    returns_raw_paths: false;
  };
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

export type ProjectPolicyPatch = {
  alias?: string | null;
  capture_disabled?: boolean;
  analysis_disabled?: boolean;
  retention_candidate_days?: number | null;
  external_analysis_opt_in?: boolean;
  export_disabled?: boolean;
};

export type ExportPreset =
  | "personal_backup"
  | "anonymized_review"
  | "issue_report_attachment";

export type ImportSourceType =
  | "official-hook"
  | "claude-transcript-best-effort"
  | "codex-transcript-best-effort"
  | "manual-jsonl";

export type ImportDryRunResult = {
  dry_run: true;
  source_type: ImportSourceType;
  source_path_hash: string;
  records_read: number;
  prompt_candidates: number;
  sensitive_prompt_count: number;
  parse_errors: number;
  skipped_records: {
    assistant_or_tool: number;
    empty_prompt: number;
    unsupported_record: number;
    too_large: number;
  };
  samples: Array<{
    record_offset: number;
    session_id?: string;
    turn_id?: string;
    cwd_label?: string;
    prompt_preview: string;
    is_sensitive: boolean;
  }>;
};

export type ExportJob = {
  id: string;
  preset: ExportPreset;
  status: "previewed" | "completed" | "invalid";
  prompt_id_hashes: string[];
  project_policy_versions: Record<string, number>;
  redaction_version: string;
  counts: {
    prompt_count: number;
    sensitive_count: number;
    included_fields: string[];
    excluded_fields: string[];
    residual_identifier_counts: Record<string, number>;
    small_set_warning: boolean;
  };
  expires_at: string;
  created_at: string;
};

export type AnonymizedExportPayload = {
  job_id: string;
  preset: ExportPreset;
  redaction_version: string;
  generated_at: string;
  count: number;
  items: Array<{
    anonymous_id: string;
    tool: string;
    coarse_date: string;
    project_alias: string;
    prompt: string;
    tags: string[];
    quality_gaps: string[];
  }>;
};

let csrfToken: string | undefined;
let sessionPromise: Promise<void> | undefined;

export async function ensureSession(): Promise<void> {
  if (csrfToken) {
    return;
  }

  sessionPromise ??= fetch("/api/v1/session", {
    credentials: "same-origin",
  })
    .then(async (response) => {
      const body = (await response.json()) as { data: { csrf_token: string } };
      csrfToken = body.data.csrf_token;
    })
    .finally(() => {
      sessionPromise = undefined;
    });

  await sessionPromise;
}

export async function listPrompts(
  filters: PromptFilters,
  cursor?: string,
): Promise<PromptListResponse> {
  await ensureSession();
  const params = new URLSearchParams({ limit: "50" });
  if (cursor && !filters.query?.trim()) {
    params.set("cursor", cursor);
  }
  if (filters.query?.trim()) {
    params.set("q", filters.query.trim());
  }
  if (filters.tool) {
    params.set("tool", filters.tool);
  }
  if (filters.cwdPrefix?.trim()) {
    params.set("cwd_prefix", filters.cwdPrefix.trim());
  }
  if (filters.importJobId?.trim()) {
    params.set("import_job_id", filters.importJobId.trim());
  }
  if (filters.isSensitive && filters.isSensitive !== "all") {
    params.set("is_sensitive", filters.isSensitive);
  }
  if (filters.tag) {
    params.set("tag", filters.tag);
  }
  if (filters.focus) {
    params.set("focus", filters.focus);
  }
  if (filters.qualityGap) {
    params.set("quality_gap", filters.qualityGap);
  }
  if (filters.receivedFrom) {
    params.set("from", `${filters.receivedFrom}T00:00:00.000Z`);
  }
  if (filters.receivedTo) {
    params.set("to", `${filters.receivedTo}T23:59:59.999Z`);
  }

  const response = await fetch(`/api/v1/prompts?${params}`, {
    credentials: "same-origin",
  });
  const body = (await response.json()) as { data: PromptListResponse };
  return body.data;
}

export async function getQualityDashboard(
  options: { trendDays?: number } = {},
): Promise<QualityDashboard> {
  await ensureSession();
  const url = options.trendDays
    ? `/api/v1/quality?trend_days=${options.trendDays}`
    : "/api/v1/quality";
  const response = await fetch(url, {
    credentials: "same-origin",
  });
  const body = (await response.json()) as { data: QualityDashboard };
  return body.data;
}

export async function getArchiveScoreReport(): Promise<ArchiveScoreReport> {
  await ensureSession();
  const response = await fetch("/api/v1/score?limit=200&low_score_limit=8", {
    credentials: "same-origin",
  });
  const body = (await response.json()) as { data: ArchiveScoreReport };
  return body.data;
}

export async function getSettings(): Promise<SettingsResponse> {
  await ensureSession();
  const response = await fetch("/api/v1/settings", {
    credentials: "same-origin",
  });
  const body = (await response.json()) as { data: SettingsResponse };
  return body.data;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await ensureSession();
  const response = await fetch("/api/v1/projects", {
    credentials: "same-origin",
  });
  const body = (await response.json()) as {
    data: { items: ProjectSummary[] };
  };
  return body.data.items;
}

async function failApi(response: Response, label: string): Promise<never> {
  let detail = "";
  try {
    const body = (await response.json()) as {
      detail?: string;
      title?: string;
    };
    detail = body.detail || body.title || "";
  } catch {
    // body may not be JSON, that is fine.
  }
  const suffix = detail ? `: ${detail}` : "";
  throw new Error(`${label} (${response.status})${suffix}`);
}

export async function updateProjectPolicy(
  projectId: string,
  patch: ProjectPolicyPatch,
): Promise<ProjectSummary> {
  await ensureSession();
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/policy`,
    {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken ?? "",
      },
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    await failApi(response, "Project policy update failed");
  }

  const body = (await response.json()) as { data: ProjectSummary };
  return body.data;
}

export async function analyzeProjectInstructions(
  projectId: string,
): Promise<ProjectInstructionReview> {
  await ensureSession();
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/instructions/analyze`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "x-csrf-token": csrfToken ?? "",
      },
    },
  );

  if (!response.ok) {
    await failApi(response, "Project instruction analysis failed");
  }

  const body = (await response.json()) as { data: ProjectInstructionReview };
  return body.data;
}

export type CoachFeedbackRating = "helpful" | "not_helpful" | "wrong";

export type CoachFeedbackEntry = {
  id: string;
  prompt_id: string;
  rating: CoachFeedbackRating;
  created_at: string;
};

export type CoachFeedbackSummary = {
  total: number;
  helpful: number;
  not_helpful: number;
  wrong: number;
  helpful_ratio: number;
};

export async function getCoachFeedbackSummary(): Promise<CoachFeedbackSummary> {
  await ensureSession();
  const response = await fetch("/api/v1/coach-feedback/summary", {
    credentials: "same-origin",
  });
  if (!response.ok) {
    await failApi(response, "Coach feedback summary failed");
  }
  const body = (await response.json()) as { data: CoachFeedbackSummary };
  return body.data;
}

export async function sendCoachFeedback(input: {
  promptId: string;
  rating: CoachFeedbackRating;
}): Promise<CoachFeedbackEntry> {
  await ensureSession();
  const response = await fetch(
    `/api/v1/prompts/${encodeURIComponent(input.promptId)}/coach-feedback`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken ?? "",
      },
      body: JSON.stringify({ rating: input.rating }),
    },
  );

  if (!response.ok) {
    await failApi(response, "Coach feedback failed");
  }

  const body = (await response.json()) as { data: CoachFeedbackEntry };
  return body.data;
}

export async function previewImportDryRun(input: {
  sourceType: ImportSourceType;
  content: string;
}): Promise<ImportDryRunResult> {
  await ensureSession();
  const response = await fetch("/api/v1/import/dry-run", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken ?? "",
    },
    body: JSON.stringify({
      source_type: input.sourceType,
      content: input.content,
    }),
  });

  if (!response.ok) {
    await failApi(response, "Import dry-run failed");
  }

  const body = (await response.json()) as { data: ImportDryRunResult };
  return body.data;
}

export async function createExportPreview(
  preset: ExportPreset,
): Promise<ExportJob> {
  await ensureSession();
  const response = await fetch("/api/v1/exports/preview", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken ?? "",
    },
    body: JSON.stringify({ preset }),
  });

  if (!response.ok) {
    await failApi(response, "Export preview failed");
  }

  const body = (await response.json()) as { data: ExportJob };
  return body.data;
}

export async function executeExportJob(
  jobId: string,
): Promise<AnonymizedExportPayload> {
  await ensureSession();
  const response = await fetch("/api/v1/exports", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken ?? "",
    },
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!response.ok) {
    await failApi(response, "Export job execution failed");
  }

  const body = (await response.json()) as { data: AnonymizedExportPayload };
  return body.data;
}

export async function getPrompt(id: string): Promise<PromptDetail> {
  await ensureSession();
  const response = await fetch(`/api/v1/prompts/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  });

  if (!response.ok) {
    await failApi(response, "Prompt not found");
  }

  const body = (await response.json()) as { data: PromptDetail };
  return body.data;
}

export async function deletePrompt(id: string): Promise<void> {
  await ensureSession();
  const response = await fetch(`/api/v1/prompts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: {
      "x-csrf-token": csrfToken ?? "",
    },
  });

  if (!response.ok) {
    await failApi(response, "Delete failed");
  }
}

export async function recordPromptCopied(
  id: string,
): Promise<PromptUsefulness> {
  await ensureSession();
  const response = await fetch(
    `/api/v1/prompts/${encodeURIComponent(id)}/events`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken ?? "",
      },
      body: JSON.stringify({ type: "prompt_copied" }),
    },
  );
  if (!response.ok) {
    await failApi(response, "Prompt event failed");
  }
  const body = (await response.json()) as {
    data: { usefulness: PromptUsefulness };
  };
  return body.data.usefulness;
}

export async function savePromptImprovementDraft(
  id: string,
  draft: {
    draft_text: string;
    analyzer: string;
    changed_sections: PromptQualityGap[];
    safety_notes: string[];
    copied?: boolean;
  },
): Promise<PromptImprovementDraft> {
  await ensureSession();
  const response = await fetch(
    `/api/v1/prompts/${encodeURIComponent(id)}/improvements`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken ?? "",
      },
      body: JSON.stringify(draft),
    },
  );
  if (!response.ok) {
    await failApi(response, "Improvement draft save failed");
  }
  const body = (await response.json()) as { data: PromptImprovementDraft };
  return body.data;
}

export async function setPromptBookmark(
  id: string,
  bookmarked: boolean,
): Promise<PromptUsefulness> {
  await ensureSession();
  const response = await fetch(
    `/api/v1/prompts/${encodeURIComponent(id)}/bookmark`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken ?? "",
      },
      body: JSON.stringify({ bookmarked }),
    },
  );
  if (!response.ok) {
    await failApi(response, "Bookmark failed");
  }
  const body = (await response.json()) as {
    data: { usefulness: PromptUsefulness };
  };
  return body.data.usefulness;
}

export async function getHealth(): Promise<{
  ok: boolean;
  version: string;
}> {
  const response = await fetch("/api/v1/health", {
    credentials: "same-origin",
  });
  return response.json() as Promise<{
    ok: boolean;
    version: string;
  }>;
}
