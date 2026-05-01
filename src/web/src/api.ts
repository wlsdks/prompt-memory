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
};

export type PromptDetail = PromptSummary & {
  markdown: string;
  analysis?: {
    summary: string;
    warnings: string[];
    suggestions: string[];
    analyzer: string;
    created_at: string;
  };
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
  receivedFrom?: string;
  receivedTo?: string;
};

export type SettingsResponse = {
  data_dir: string;
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
): Promise<PromptListResponse> {
  await ensureSession();
  const params = new URLSearchParams({ limit: "50" });
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

export async function getSettings(): Promise<SettingsResponse> {
  await ensureSession();
  const response = await fetch("/api/v1/settings", {
    credentials: "same-origin",
  });
  const body = (await response.json()) as { data: SettingsResponse };
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
