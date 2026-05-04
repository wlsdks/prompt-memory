import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnonymizedExportPayload, ExportJob } from "./api.js";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
});

describe("web api export client", () => {
  it("shares an in-flight csrf session request across parallel API calls", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/session") {
        await Promise.resolve();
        return jsonResponse({ data: { csrf_token: "csrf-1" } });
      }

      if (url === "/api/v1/settings") {
        return jsonResponse({
          data: {
            data_dir: "/Users/example/.prompt-memory",
            excluded_project_roots: [],
            redaction_mode: "mask",
            server: { host: "127.0.0.1", port: 17373 },
          },
        });
      }

      if (url === "/api/v1/quality") {
        return jsonResponse({ data: { total_prompts: 0 } });
      }

      if (url === "/api/v1/score?limit=200&low_score_limit=8") {
        return jsonResponse({ data: { low_score_prompts: [] } });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    const { getArchiveScoreReport, getQualityDashboard, getSettings } =
      await import("./api.js");

    await Promise.all([
      getSettings(),
      getQualityDashboard(),
      getArchiveScoreReport(),
    ]);

    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/v1/session"),
    ).toHaveLength(1);
  });

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
          quality_gaps: ["Verification criteria"],
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

  it("posts coach feedback with CSRF for a specific prompt id", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { csrf_token: "csrf-1" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            id: "cfb_abcdef",
            prompt_id: "prmt_xyz",
            rating: "helpful",
            created_at: "2026-05-04T00:00:00.000Z",
          },
        }),
      );
    const { sendCoachFeedback } = await import("./api.js");

    const result = await sendCoachFeedback({
      promptId: "prmt_xyz",
      rating: "helpful",
    });

    expect(result.rating).toBe("helpful");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/prompts/prmt_xyz/coach-feedback",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": "csrf-1",
        },
        body: JSON.stringify({ rating: "helpful" }),
      },
    );
  });

  it("posts the import dry-run upload with CSRF and returns the raw-free summary", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { csrf_token: "csrf-1" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            dry_run: true,
            source_type: "manual-jsonl",
            source_path_hash: "path_aabbccdd",
            records_read: 1,
            prompt_candidates: 1,
            sensitive_prompt_count: 1,
            parse_errors: 0,
            skipped_records: {
              assistant_or_tool: 0,
              empty_prompt: 0,
              unsupported_record: 0,
              too_large: 0,
            },
            samples: [],
          },
        }),
      );
    const { previewImportDryRun } = await import("./api.js");

    const result = await previewImportDryRun({
      sourceType: "manual-jsonl",
      content: "line1\n",
    });

    expect(result).toMatchObject({
      dry_run: true,
      source_type: "manual-jsonl",
      prompt_candidates: 1,
      sensitive_prompt_count: 1,
    });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/import/dry-run", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": "csrf-1",
      },
      body: JSON.stringify({
        source_type: "manual-jsonl",
        content: "line1\n",
      }),
    });
  });

  it("includes the HTTP status and detail in error messages", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { csrf_token: "csrf-1" } }))
      .mockResolvedValueOnce(
        errorResponse(403, { detail: "Forbidden by policy" }),
      );
    const { deletePrompt } = await import("./api.js");

    await expect(deletePrompt("prmt_x")).rejects.toThrow(
      /Delete failed \(403\): Forbidden by policy/,
    );
  });

  it("still surfaces the status when the error body is not JSON", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { csrf_token: "csrf-1" } }))
      .mockResolvedValueOnce(errorResponse(500, undefined));
    const { deletePrompt } = await import("./api.js");

    await expect(deletePrompt("prmt_y")).rejects.toThrow(
      /Delete failed \(500\)/,
    );
  });

  it("analyzes project instruction files with csrf", async () => {
    const review = {
      generated_at: "2026-05-03T00:00:00.000Z",
      analyzer: "local-project-instructions-v1",
      score: { value: 80, max: 100, band: "good" },
      files_found: 1,
      files: [],
      checklist: [],
      suggestions: [],
      privacy: {
        local_only: true,
        external_calls: false,
        stores_file_bodies: false,
        returns_file_bodies: false,
        returns_raw_paths: false,
      },
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { csrf_token: "csrf-1" } }))
      .mockResolvedValueOnce(jsonResponse({ data: review }));
    const { analyzeProjectInstructions } = await import("./api.js");

    const result = await analyzeProjectInstructions("proj_abcdef123456");

    expect(result).toEqual(review);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/projects/proj_abcdef123456/instructions/analyze",
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "x-csrf-token": "csrf-1",
        },
      },
    );
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function errorResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    json: async () => {
      if (body === undefined) {
        throw new Error("not json");
      }
      return body;
    },
  } as unknown as Response;
}
