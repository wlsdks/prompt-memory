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
  analysis?: {
    summary: string;
    warnings: string[];
    suggestions: string[];
    checklist: Array<{
      key: string;
      label: string;
      status: "good" | "weak" | "missing";
      reason: string;
      suggestion?: string;
    }>;
    tags: string[];
    analyzer: string;
    created_at: string;
  };
  improvement_drafts: PromptImprovementDraft[];
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
      sensitive_count: number;
    }>;
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

export type ProjectPolicyPatch = {
  alias?: string | null;
  capture_disabled?: boolean;
  analysis_disabled?: boolean;
  retention_candidate_days?: number | null;
  external_analysis_opt_in?: boolean;
  export_disabled?: boolean;
};

let csrfToken: string | undefined;

export async function ensureSession(): Promise<void> {
  if (csrfToken) {
    return;
  }

  const response = await fetch("/api/v1/session", {
    credentials: "same-origin",
  });
  const body = (await response.json()) as { data: { csrf_token: string } };
  csrfToken = body.data.csrf_token;
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

export async function getQualityDashboard(): Promise<QualityDashboard> {
  await ensureSession();
  const response = await fetch("/api/v1/quality", {
    credentials: "same-origin",
  });
  const body = (await response.json()) as { data: QualityDashboard };
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
    throw new Error("Project policy update failed");
  }

  const body = (await response.json()) as { data: ProjectSummary };
  return body.data;
}

export async function getPrompt(id: string): Promise<PromptDetail> {
  await ensureSession();
  const response = await fetch(`/api/v1/prompts/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Prompt not found");
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
    throw new Error("Delete failed");
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
    throw new Error("Prompt event failed");
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
    throw new Error("Improvement draft save failed");
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
    throw new Error("Bookmark failed");
  }
  const body = (await response.json()) as {
    data: { usefulness: PromptUsefulness };
  };
  return body.data.usefulness;
}

export async function getHealth(): Promise<{
  ok: boolean;
  version: string;
  data_dir: string;
}> {
  const response = await fetch("/api/v1/health", {
    credentials: "same-origin",
  });
  return response.json() as Promise<{
    ok: boolean;
    version: string;
    data_dir: string;
  }>;
}
