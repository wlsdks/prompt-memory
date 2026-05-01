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
};

export type PromptListResponse = {
  items: PromptSummary[];
  next_cursor?: string;
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

export async function listPrompts(query: string): Promise<PromptListResponse> {
  await ensureSession();
  const params = new URLSearchParams({ limit: "50" });
  if (query.trim()) {
    params.set("q", query.trim());
  }

  const response = await fetch(`/api/v1/prompts?${params}`, {
    credentials: "same-origin",
  });
  const body = (await response.json()) as { data: PromptListResponse };
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
