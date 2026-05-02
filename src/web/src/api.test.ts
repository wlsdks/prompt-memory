import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnonymizedExportPayload, ExportJob } from "./api.js";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
});

describe("web api export client", () => {
  it("creates anonymized export previews with csrf and returns raw-free job data", async () => {
    const job: ExportJob = {
      id: "exp_abcdef123456",
      preset: "anonymized_review",
      status: "previewed",
      prompt_id_hashes: ["ph_abcdef123456"],
      project_policy_versions: { proj_abcdef123456: 1 },
      redaction_version: "mask-v1",
      counts: {
        prompt_count: 1,
        sensitive_count: 1,
        included_fields: ["masked_prompt", "tags"],
        excluded_fields: ["cwd", "stable_prompt_id"],
        residual_identifier_counts: { path: 1 },
        small_set_warning: true,
      },
      expires_at: "2026-05-03T12:00:00.000Z",
      created_at: "2026-05-02T12:00:00.000Z",
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { csrf_token: "csrf-1" } }))
      .mockResolvedValueOnce(jsonResponse({ data: job }));
    const { createExportPreview } = await import("./api.js");

    const preview = await createExportPreview("anonymized_review");

    expect(preview).toEqual(job);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/exports/preview", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": "csrf-1",
      },
      body: JSON.stringify({ preset: "anonymized_review" }),
    });
    expect(JSON.stringify(preview)).not.toContain("prmt_");
    expect(JSON.stringify(preview)).not.toContain("/Users/example");
    expect(JSON.stringify(preview)).not.toContain("sk-proj");
  });

  it("executes anonymized export jobs by job id", async () => {
    const payload: AnonymizedExportPayload = {
      job_id: "exp_abcdef123456",
      preset: "anonymized_review",
      redaction_version: "mask-v1",
      generated_at: "2026-05-02T12:01:00.000Z",
      count: 1,
      items: [
        {
          anonymous_id: "anon_abcdef123456",
          tool: "claude-code",
          coarse_date: "2026-05-02",
          project_alias: "prompt-memory",
          prompt: "Fix [REDACTED:path] with [REDACTED:api_key]",
          tags: ["backend"],
          quality_gaps: ["검증 기준"],
        },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { csrf_token: "csrf-1" } }))
      .mockResolvedValueOnce(jsonResponse({ data: payload }));
    const { executeExportJob } = await import("./api.js");

    const exported = await executeExportJob("exp_abcdef123456");

    expect(exported).toEqual(payload);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/exports", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": "csrf-1",
      },
      body: JSON.stringify({ job_id: "exp_abcdef123456" }),
    });
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}
