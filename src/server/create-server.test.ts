import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptCoach } from "../config/config.js";
import { createServer } from "./create-server.js";
import type {
  ExportJob,
  ProjectInstructionReview,
  PromptDetail,
  PromptStoragePort,
} from "../storage/ports.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const claudeFixture = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      "../adapters/fixtures/claude-code-user-prompt-submit.json",
    ),
    "utf8",
  ),
) as Record<string, unknown>;
const codexFixture = JSON.parse(
  readFileSync(
    resolve(__dirname, "../adapters/fixtures/codex-user-prompt-submit.json"),
    "utf8",
  ),
) as Record<string, unknown>;

const persistedDataDirs: string[] = [];

afterEach(() => {
  while (persistedDataDirs.length > 0) {
    const dir = persistedDataDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createPersistedTestDataDir(): string {
  const dataDir = join(tmpdir(), `prompt-coach-server-${randomUUID()}`);
  mkdirSync(dataDir, { recursive: true });
  initializePromptCoach({ dataDir });
  persistedDataDirs.push(dataDir);
  return dataDir;
}

describe("createServer P2 ingest boundary", () => {
  it("returns health without auth", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { host: "127.0.0.1:17373" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      version: "0.1.0-beta.0",
    });
  });

  it("does not expose the local data directory through health", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { host: "127.0.0.1:17373" },
    });
    const body = response.json() as Record<string, unknown>;

    expect(body).not.toHaveProperty("data_dir");
    expect(JSON.stringify(body)).not.toContain("/Users");
    expect(JSON.stringify(body)).not.toContain("/home");
    expect(JSON.stringify(body)).not.toContain("/tmp");
  });

  it("returns an empty favicon response for browser probes", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/favicon.ico",
      headers: { host: "127.0.0.1:17373" },
    });

    expect(response.statusCode).toBe(204);
  });

  it("issues local web sessions and requires csrf for cookie delete", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage });

    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = session.headers["set-cookie"];
    const csrfToken = session.json<{ data: { csrf_token: string } }>().data
      .csrf_token;

    expect(session.statusCode).toBe(200);
    expect(cookie).toContain("prompt_coach_session=");
    expect(csrfToken).toBeTypeOf("string");

    const noCsrf = await server.inject({
      method: "DELETE",
      url: "/api/v1/prompts/prmt_20260501_100000_abcdefabcdef",
      headers: {
        host: "127.0.0.1:17373",
        cookie: String(cookie),
      },
    });
    expect(noCsrf.statusCode).toBe(403);

    const deleted = await server.inject({
      method: "DELETE",
      url: "/api/v1/prompts/prmt_20260501_100000_abcdefabcdef",
      headers: {
        host: "127.0.0.1:17373",
        cookie: String(cookie),
        "x-csrf-token": csrfToken,
      },
    });
    expect(deleted.statusCode).toBe(200);
  });

  it("returns browser-safe settings without exposing secrets", async () => {
    const server = createTestServer({
      excludedProjectRoots: ["/Users/example/private-project"],
    });
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/settings",
      headers: {
        host: "127.0.0.1:17373",
        cookie: String(session.headers["set-cookie"]),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        data_dir: "/tmp/prompt-coach-test",
        redaction_mode: "mask",
        server: {
          host: "127.0.0.1",
          port: 17373,
        },
        excluded_project_roots: ["/Users/example/private-project"],
        auto_judge: {
          enabled: false,
          tool: "claude",
          daily_limit: 50,
          per_minute_limit: 5,
        },
      },
    });
    expect(response.body).not.toContain("app-token");
    expect(response.body).not.toContain("ingest-token");
    expect(response.body).not.toContain("web-session-secret");
  });

  it("updates auto_judge settings via PATCH and persists between GETs", async () => {
    const dataDir = createPersistedTestDataDir();
    const server = createTestServer({ dataDir });
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = String(session.headers["set-cookie"]);
    const csrfToken = String(
      (session.json() as { data: { csrf_token: string } }).data.csrf_token,
    );

    const noCsrf = await server.inject({
      method: "PATCH",
      url: "/api/v1/settings/auto-judge",
      headers: { host: "127.0.0.1:17373", cookie },
      payload: { enabled: true },
    });
    expect(noCsrf.statusCode).toBe(403);

    const patched = await server.inject({
      method: "PATCH",
      url: "/api/v1/settings/auto-judge",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { enabled: true, tool: "codex", per_minute_limit: 1 },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toEqual({
      data: {
        enabled: true,
        tool: "codex",
        daily_limit: 50,
        per_minute_limit: 1,
      },
    });

    const reload = await server.inject({
      method: "GET",
      url: "/api/v1/settings",
      headers: { host: "127.0.0.1:17373", cookie },
    });
    expect(
      (reload.json() as { data: { auto_judge: unknown } }).data.auto_judge,
    ).toEqual({
      enabled: true,
      tool: "codex",
      daily_limit: 50,
      per_minute_limit: 1,
    });
  });

  it("rejects auto_judge patches with out-of-range fields", async () => {
    const dataDir = createPersistedTestDataDir();
    const server = createTestServer({ dataDir });
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = String(session.headers["set-cookie"]);
    const csrfToken = String(
      (session.json() as { data: { csrf_token: string } }).data.csrf_token,
    );

    const tooHigh = await server.inject({
      method: "PATCH",
      url: "/api/v1/settings/auto-judge",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { daily_limit: 99_999 },
    });
    expect(tooHigh.statusCode).toBe(422);
  });

  it("returns browser-safe projects without exposing raw paths or tokens", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/projects",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        items: [
          {
            project_id: "proj_memory",
            label: "prompt-coach",
            alias: "workbench",
            path_kind: "project_root",
            prompt_count: 2,
            latest_ingest: "2026-05-02T09:00:00.000Z",
            sensitive_count: 1,
            quality_gap_rate: 0.5,
            copied_count: 1,
            bookmarked_count: 1,
            policy: {
              capture_disabled: false,
              analysis_disabled: false,
              export_disabled: false,
              external_analysis_opt_in: false,
              version: 1,
            },
          },
        ],
      },
    });
    expect(response.body).not.toContain("/Users/example/private-project");
    expect(response.body).not.toContain("app-token");
    expect(response.body).not.toContain("ingest-token");
    expect(response.body).not.toContain("web-session-secret");
  });

  it("requires app access and csrf before updating project policy", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage });
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = String(session.headers["set-cookie"]);
    const csrfToken = session.json<{ data: { csrf_token: string } }>().data
      .csrf_token;

    const ingestToken = await server.inject({
      method: "PATCH",
      url: "/api/v1/projects/proj_memory/policy",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: { capture_disabled: true },
    });
    expect(ingestToken.statusCode).toBe(401);

    const noCsrf = await server.inject({
      method: "PATCH",
      url: "/api/v1/projects/proj_memory/policy",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
      },
      payload: { capture_disabled: true },
    });
    expect(noCsrf.statusCode).toBe(403);

    const updated = await server.inject({
      method: "PATCH",
      url: "/api/v1/projects/proj_memory/policy",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { capture_disabled: true, alias: "local-only" },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      data: {
        project_id: "proj_memory",
        alias: "local-only",
        policy: {
          capture_disabled: true,
          version: 2,
        },
      },
    });
    expect(storage.policyUpdates).toEqual([
      {
        projectId: "proj_memory",
        patch: { capture_disabled: true, alias: "local-only" },
        actor: "web",
      },
    ]);
    expect(updated.body).not.toContain("/Users/example/private-project");
  });

  it("analyzes project instruction files behind csrf without exposing raw bodies or paths", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage });
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = String(session.headers["set-cookie"]);
    const csrfToken = session.json<{ data: { csrf_token: string } }>().data
      .csrf_token;

    const noCsrf = await server.inject({
      method: "POST",
      url: "/api/v1/projects/proj_memory/instructions/analyze",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
      },
    });
    expect(noCsrf.statusCode).toBe(403);

    const analyzed = await server.inject({
      method: "POST",
      url: "/api/v1/projects/proj_memory/instructions/analyze",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
    });

    expect(analyzed.statusCode).toBe(200);
    expect(analyzed.json()).toMatchObject({
      data: {
        analyzer: "local-project-instructions-v1",
        files_found: 1,
        score: { value: 80, max: 100, band: "good" },
        privacy: {
          local_only: true,
          returns_file_bodies: false,
          returns_raw_paths: false,
        },
      },
    });
    expect(analyzed.body).not.toContain("/Users/example/private-project");
    expect(analyzed.body).not.toContain("Do not leak this file body");
  });

  it("requires csrf for anonymized export preview and executes by job id", async () => {
    const storage = createMemoryStorage();
    storage.promptDetails = [
      {
        id: "prmt_20260502_120000_abcdefabcdef",
        tool: "claude-code",
        source_event: "UserPromptSubmit",
        session_id: "session-1",
        cwd: "/Users/example/private-project",
        created_at: "2026-05-02T12:00:00.000Z",
        received_at: "2026-05-02T12:00:00.000Z",
        snippet: "Fix [REDACTED:api_key]",
        prompt_length: 24,
        is_sensitive: true,
        excluded_from_analysis: false,
        redaction_policy: "mask",
        adapter_version: "claude-code-v1",
        index_status: "indexed",
        tags: ["backend"],
        quality_gaps: ["Verification criteria"],
        usefulness: { copied_count: 0, bookmarked: false },
        duplicate_count: 0,
        markdown:
          "Fix /Users/example/private-project/src/secret.ts with [REDACTED:api_key]",
        analysis: undefined,
        improvement_drafts: [],
      },
    ];
    const server = createTestServer({ storage });
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = String(session.headers["set-cookie"]);
    const csrfToken = session.json<{ data: { csrf_token: string } }>().data
      .csrf_token;

    const noCsrf = await server.inject({
      method: "POST",
      url: "/api/v1/exports/preview",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
      },
      payload: { preset: "anonymized_review" },
    });
    expect(noCsrf.statusCode).toBe(403);

    const preview = await server.inject({
      method: "POST",
      url: "/api/v1/exports/preview",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { preset: "anonymized_review" },
    });
    const previewBody = preview.json<{ data: ExportJob }>();

    expect(preview.statusCode).toBe(200);
    expect(previewBody.data).toMatchObject({
      id: expect.stringMatching(/^exp_/),
      preset: "anonymized_review",
      counts: {
        prompt_count: 1,
        sensitive_count: 1,
      },
    });
    expect(preview.body).not.toContain("prmt_20260502_120000_abcdefabcdef");
    expect(preview.body).not.toContain("/Users/example/private-project");

    const executed = await server.inject({
      method: "POST",
      url: "/api/v1/exports",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { job_id: previewBody.data.id },
    });

    expect(executed.statusCode).toBe(200);
    expect(executed.json()).toMatchObject({
      data: {
        job_id: previewBody.data.id,
        count: 1,
        items: [
          {
            anonymous_id: expect.stringMatching(/^anon_/),
            prompt: expect.stringContaining("[REDACTED:path]"),
          },
        ],
      },
    });
    expect(executed.body).not.toContain("prmt_20260502_120000_abcdefabcdef");
    expect(executed.body).not.toContain("/Users/example/private-project");
  });

  it("serves built web assets with csp and spa fallback", async () => {
    const server = createTestServer({
      webAssets: {
        "index.html":
          '<html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>',
        "assets/app.js": "console.log('web')",
      },
    });

    const root = await server.inject({
      method: "GET",
      url: "/",
      headers: { host: "127.0.0.1:17373" },
    });
    expect(root.statusCode).toBe(200);
    expect(root.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    expect(root.body).toContain('<div id="root"></div>');

    const fallback = await server.inject({
      method: "GET",
      url: "/prompts/prmt_20260501_100000_abcdefabcdef",
      headers: { host: "127.0.0.1:17373" },
    });
    expect(fallback.statusCode).toBe(200);
    expect(fallback.body).toContain('<div id="root"></div>');

    for (const path of [
      "/dashboard",
      "/coach",
      "/practice",
      "/scores",
      "/benchmark",
      "/insights",
      "/projects",
      "/mcp",
      "/exports",
      "/settings",
    ]) {
      const route = await server.inject({
        method: "GET",
        url: path,
        headers: { host: "127.0.0.1:17373" },
      });
      expect(route.statusCode).toBe(200);
      expect(route.body).toContain('<div id="root"></div>');
    }

    const asset = await server.inject({
      method: "GET",
      url: "/assets/app.js",
      headers: { host: "127.0.0.1:17373" },
    });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers["content-type"]).toContain("text/javascript");
    expect(asset.body).toContain("console.log");
  });

  it("rejects unauthenticated ingest with RFC 7807 problem response", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: { host: "127.0.0.1:17373" },
      payload: claudeFixture,
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      status: 401,
      title: "Unauthorized",
    });
  });

  it("rejects wrong ingest token", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer wrong",
      },
      payload: claudeFixture,
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 415 (not 500) when the request content-type is unsupported", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
        "content-type": "application/xml",
      },
      payload: "<xml/>",
    });

    expect(response.statusCode).toBe(415);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      status: 415,
      title: "Unsupported Media Type",
    });
  });

  it("accepts case-insensitive loopback Host header (RFC 3986 §3.2.2)", async () => {
    const server = createTestServer();

    for (const host of [
      "127.0.0.1:17373",
      "localhost:17373",
      "LOCALHOST:17373",
      "Localhost:17373",
    ]) {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/health",
        headers: { host },
      });
      expect(response.statusCode, `host="${host}"`).toBe(200);
    }
  });

  it("returns RFC 7807 404 for unknown routes", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/this-route-does-not-exist",
      headers: { host: "127.0.0.1:17373" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      status: 404,
      title: "Not Found",
    });
  });

  it("returns 400 (not 500) when the JSON body is malformed", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
        "content-type": "application/json",
      },
      payload: "this is not json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(
      "application/problem+json",
    );
    expect(response.json()).toMatchObject({
      status: 400,
      title: "Bad Request",
    });
  });

  it("normalizes, redacts, and stores a valid Claude Code fixture", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: {
        ...claudeFixture,
        prompt: "Use bearer abc.def.ghi and email test@example.com",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        id: "stored-1",
        stored: true,
        duplicate: false,
        redacted: true,
      },
    });
    expect(storage.events).toHaveLength(1);
    expect(storage.events[0]?.event.tool).toBe("claude-code");
    expect(storage.events[0]?.event.cwd).toBe(
      "/Users/example/side-project/prompt-coach",
    );
    expect(storage.events[0]?.redaction.stored_text).toContain(
      "[REDACTED:email]",
    );
    expect(storage.events[0]?.redaction.stored_text).not.toContain(
      "test@example.com",
    );
  });

  it("normalizes, redacts, and stores a valid Codex fixture", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/codex",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: {
        ...codexFixture,
        prompt: "Review this and keep api key sk-proj-1234567890abcdef safe",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        id: "stored-1",
        stored: true,
        duplicate: false,
        redacted: true,
      },
    });
    expect(storage.events).toHaveLength(1);
    expect(storage.events[0]?.event).toMatchObject({
      tool: "codex",
      source_event: "UserPromptSubmit",
      session_id: "codex-session-123",
      turn_id: "turn-456",
      cwd: "/Users/example/side-project/prompt-coach",
      transcript_path: "/Users/example/.codex/sessions/prompt-coach.jsonl",
      model: "gpt-5.5",
      adapter_version: "codex-v1",
    });
    expect(storage.events[0]?.redaction.stored_text).toContain(
      "[REDACTED:api_key]",
    );
    expect(storage.events[0]?.redaction.stored_text).not.toContain(
      "sk-proj-1234567890abcdef",
    );
  });

  it("rejects empty prompts before storage", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: { ...claudeFixture, prompt: "   " },
    });

    expect(response.statusCode).toBe(422);
    expect(storage.events).toHaveLength(0);
  });

  it("does not call storage in reject mode when sensitive content is found", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage, redactionMode: "reject" });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: { ...claudeFixture, prompt: "token sk-proj-1234567890abcdef" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: { stored: false, redacted: true },
    });
    expect(storage.events).toHaveLength(0);
  });

  it("does not call storage for excluded capture paths", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({
      storage,
      excludedProjectRoots: ["/Users/example/side-project"],
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: claudeFixture,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: { stored: false, excluded: true },
    });
    expect(storage.events).toHaveLength(0);
  });

  it("excludes capture paths even when the configured root has a trailing slash", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({
      storage,
      // User added a path with a trailing slash — natural copy/paste from a
      // shell prompt. Without normalization the matcher would silently fail.
      excludedProjectRoots: ["/Users/example/side-project/"],
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: claudeFixture,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: { stored: false, excluded: true },
    });
    expect(storage.events).toHaveLength(0);
  });

  it("does not call storage when project policy disables capture", async () => {
    const storage = createMemoryStorage();
    storage.policyForIngest = {
      capture_disabled: true,
      analysis_disabled: false,
      export_disabled: false,
      external_analysis_opt_in: false,
      version: 1,
    };
    const server = createTestServer({ storage });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: claudeFixture,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: { stored: false, excluded: true, reason: "project_policy" },
    });
    expect(storage.events).toHaveLength(0);
  });

  it("fails open without storing when project policy lookup fails", async () => {
    const storage = createMemoryStorage();
    storage.failPolicyLookup = true;
    const server = createTestServer({ storage });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: claudeFixture,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: {
        stored: false,
        excluded: true,
        reason: "policy_lookup_failed",
      },
    });
    expect(storage.events).toHaveLength(0);
  });

  it("rejects invalid host and cross-origin browser requests", async () => {
    const server = createTestServer();

    const invalidHost = await server.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { host: "evil.example" },
    });
    expect(invalidHost.statusCode).toBe(400);

    const crossOrigin = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        origin: "https://evil.example",
        authorization: "Bearer ingest-token",
      },
      payload: claudeFixture,
    });
    expect(crossOrigin.statusCode).toBe(403);
    expect(crossOrigin.headers["access-control-allow-origin"]).toBeUndefined();

    const crossSiteFetch = await server.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: {
        host: "127.0.0.1:17373",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(crossSiteFetch.statusCode).toBe(403);
  });

  it("enforces prompt length limits before storage", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage, maxPromptLength: 10 });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: { ...claudeFixture, prompt: "this prompt is too long" },
    });

    expect(response.statusCode).toBe(413);
    expect(storage.events).toHaveLength(0);
  });

  it("enforces body size and query length limits", async () => {
    const server = createTestServer({
      maxBodyBytes: 80,
      maxQueryLength: 5,
    });

    const oversizedBody = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        ...claudeFixture,
        prompt: "this payload is intentionally too large",
      }),
    });

    expect(oversizedBody.statusCode).toBe(413);

    const oversizedQuery = await server.inject({
      method: "GET",
      url: "/api/v1/health?abcdef",
      headers: { host: "127.0.0.1:17373" },
    });

    expect(oversizedQuery.statusCode).toBe(414);
  });

  it("rate limits ingest before storing repeated requests", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({
      storage,
      rateLimit: { max: 1, windowMs: 60_000 },
    });

    const request = {
      method: "POST" as const,
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: claudeFixture,
    };

    const first = await server.inject(request);
    const second = await server.inject(request);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(storage.events).toHaveLength(1);
  });

  it("normalizes safe control characters and rejected values are not echoed", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage });

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: {
        ...claudeFixture,
        session_id: " session-with-null\u0000 ",
        prompt: "hello\u0000world",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(storage.events[0]?.event.session_id).toBe("session-with-null");
    expect(storage.events[0]?.event.prompt).toBe("helloworld");

    const invalid = await server.inject({
      method: "POST",
      url: "/api/v1/ingest/claude-code",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer ingest-token",
      },
      payload: {
        ...claudeFixture,
        cwd: "../secret-project",
        prompt: "do not echo sk-proj-1234567890abcdef",
      },
    });

    expect(invalid.statusCode).toBe(422);
    expect(invalid.body).not.toContain("sk-proj-1234567890abcdef");
    expect(invalid.body).not.toContain("../secret-project");
  });

  it("dry-runs uploaded JSONL without retaining raw secrets or paths", async () => {
    const server = createTestServer();
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = String(session.headers["set-cookie"]);
    const csrfToken = session.json<{ data: { csrf_token: string } }>().data
      .csrf_token;
    const rawSecret = "sk-proj-import-dryrun-1234567890";
    const rawPath = "/Users/example/private-project/src/secret.ts";
    const content = `${JSON.stringify({
      hook_event_name: "UserPromptSubmit",
      session_id: "upload-session-1",
      cwd: "/Users/example/private-project",
      prompt: `Fix ${rawPath} with token ${rawSecret}.`,
    })}\n`;

    const noCsrf = await server.inject({
      method: "POST",
      url: "/api/v1/import/dry-run",
      headers: { host: "127.0.0.1:17373", cookie },
      payload: { source_type: "manual-jsonl", content },
    });
    expect(noCsrf.statusCode).toBe(403);

    const ok = await server.inject({
      method: "POST",
      url: "/api/v1/import/dry-run",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { source_type: "manual-jsonl", content },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).not.toContain(rawSecret);
    expect(ok.body).not.toContain(rawPath);
    const body = ok.json<{
      data: { prompt_candidates: number; sensitive_prompt_count: number };
    }>().data;
    expect(body.prompt_candidates).toBe(1);
    expect(body.sensitive_prompt_count).toBe(1);
  });

  it("records coach feedback with CSRF and aggregates the summary", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage });
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = String(session.headers["set-cookie"]);
    const csrfToken = session.json<{ data: { csrf_token: string } }>().data
      .csrf_token;

    const noCsrf = await server.inject({
      method: "POST",
      url: "/api/v1/prompts/prmt_20260504_100000_aabbccddeeff/coach-feedback",
      headers: { host: "127.0.0.1:17373", cookie },
      payload: { rating: "helpful" },
    });
    expect(noCsrf.statusCode).toBe(403);

    const helpful = await server.inject({
      method: "POST",
      url: "/api/v1/prompts/prmt_20260504_100000_aabbccddeeff/coach-feedback",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { rating: "helpful" },
    });
    expect(helpful.statusCode).toBe(200);
    expect(helpful.json<{ data: { rating: string } }>().data.rating).toBe(
      "helpful",
    );

    const wrong = await server.inject({
      method: "POST",
      url: "/api/v1/prompts/prmt_20260504_100000_aabbccddeeff/coach-feedback",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { rating: "wrong" },
    });
    expect(wrong.statusCode).toBe(200);

    const summary = await server.inject({
      method: "GET",
      url: "/api/v1/coach-feedback/summary",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(summary.statusCode).toBe(200);
    expect(
      summary.json<{
        data: { total: number; helpful: number; helpful_ratio: number };
      }>().data,
    ).toMatchObject({ total: 2, helpful: 1, helpful_ratio: 0.5 });
  });

  it("rejects coach feedback with an unsupported rating", async () => {
    const storage = createMemoryStorage();
    const server = createTestServer({ storage });
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = String(session.headers["set-cookie"]);
    const csrfToken = session.json<{ data: { csrf_token: string } }>().data
      .csrf_token;

    const bad = await server.inject({
      method: "POST",
      url: "/api/v1/prompts/prmt_20260504_100000_aabbccddeeff/coach-feedback",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { rating: "amazing" },
    });

    expect(bad.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("rejects import dry-run uploads with an unsupported source_type", async () => {
    const server = createTestServer();
    const session = await server.inject({
      method: "GET",
      url: "/api/v1/session",
      headers: { host: "127.0.0.1:17373" },
    });
    const cookie = String(session.headers["set-cookie"]);
    const csrfToken = session.json<{ data: { csrf_token: string } }>().data
      .csrf_token;

    const bad = await server.inject({
      method: "POST",
      url: "/api/v1/import/dry-run",
      headers: {
        host: "127.0.0.1:17373",
        cookie,
        "x-csrf-token": csrfToken,
      },
      payload: { source_type: "not-a-source", content: "{}" },
    });

    expect(bad.statusCode).toBeGreaterThanOrEqual(400);
  });
});

type TestServerOptions = {
  storage?: ReturnType<typeof createMemoryStorage>;
  redactionMode?: "mask" | "raw" | "reject";
  excludedProjectRoots?: string[];
  maxPromptLength?: number;
  maxBodyBytes?: number;
  maxQueryLength?: number;
  rateLimit?: { max: number; windowMs: number };
  webAssets?: Record<string, string>;
  dataDir?: string;
  autoJudge?: {
    enabled: boolean;
    tool: "claude" | "codex";
    daily_limit: number;
    per_minute_limit: number;
  };
};

function createTestServer(options: TestServerOptions = {}) {
  return createServer({
    dataDir: options.dataDir ?? "/tmp/prompt-coach-test",
    autoJudge: options.autoJudge,
    auth: {
      appToken: "app-token",
      ingestToken: "ingest-token",
      webSessionSecret: "web-session-secret",
    },
    redactionMode: options.redactionMode ?? "mask",
    excludedProjectRoots: options.excludedProjectRoots ?? [],
    maxPromptLength: options.maxPromptLength ?? 10_000,
    maxBodyBytes: options.maxBodyBytes,
    maxQueryLength: options.maxQueryLength,
    rateLimit: options.rateLimit,
    webAssets: options.webAssets,
    storage: options.storage ?? createMemoryStorage(),
  });
}

function createMemoryStorage() {
  const events: Array<Parameters<PromptStoragePort["storePrompt"]>[0]> = [];
  const policyUpdates: Array<{
    projectId: string;
    patch: Record<string, unknown>;
    actor: "cli" | "web" | "system";
  }> = [];
  const exportJobs = new Map<string, ExportJob>();
  const instructionReviews = new Map<string, ProjectInstructionReview>();
  const coachFeedback: Array<{
    id: string;
    prompt_id: string;
    rating: "helpful" | "not_helpful" | "wrong";
    created_at: string;
  }> = [];

  return {
    events,
    policyUpdates,
    promptDetails: [] as PromptDetail[],
    exportJobs,
    instructionReviews,
    policyForIngest: undefined as
      | {
          capture_disabled: boolean;
          analysis_disabled: boolean;
          export_disabled: boolean;
          external_analysis_opt_in: boolean;
          version: number;
        }
      | undefined,
    failPolicyLookup: false,
    async storePrompt(input: Parameters<PromptStoragePort["storePrompt"]>[0]) {
      events.push(input);
      return {
        id: "stored-1",
        duplicate: false,
      };
    },
    listProjects() {
      return {
        items: [
          {
            project_id: "proj_memory",
            label: "prompt-coach",
            alias: "workbench",
            path_kind: "project_root" as const,
            prompt_count: 2,
            latest_ingest: "2026-05-02T09:00:00.000Z",
            sensitive_count: 1,
            quality_gap_rate: 0.5,
            copied_count: 1,
            bookmarked_count: 1,
            policy: {
              capture_disabled: false,
              analysis_disabled: false,
              export_disabled: false,
              external_analysis_opt_in: false,
              version: 1,
            },
          },
        ],
      };
    },
    updateProjectPolicy(
      projectId: string,
      patch: Record<string, unknown>,
      actor: "cli" | "web" | "system",
    ) {
      policyUpdates.push({ projectId, patch, actor });
      return {
        project_id: projectId,
        label: "prompt-coach",
        alias: typeof patch.alias === "string" ? patch.alias : "workbench",
        path_kind: "project_root" as const,
        prompt_count: 2,
        latest_ingest: "2026-05-02T09:00:00.000Z",
        sensitive_count: 1,
        quality_gap_rate: 0.5,
        copied_count: 1,
        bookmarked_count: 1,
        policy: {
          capture_disabled: patch.capture_disabled === true,
          analysis_disabled: false,
          export_disabled: false,
          external_analysis_opt_in: false,
          version: 2,
        },
      };
    },
    getProjectPolicyForEvent() {
      if (this.failPolicyLookup) {
        throw new Error("lookup failed");
      }
      return this.policyForIngest;
    },
    getProjectInstructionReview(projectId: string) {
      return instructionReviews.get(projectId);
    },
    analyzeProjectInstructions(projectId: string) {
      const review: ProjectInstructionReview = {
        generated_at: "2026-05-03T00:00:00.000Z",
        analyzer: "local-project-instructions-v1",
        score: { value: 80, max: 100, band: "good" },
        files_found: 1,
        files: [
          {
            file_name: "AGENTS.md",
            bytes: 100,
            modified_at: "2026-05-03T00:00:00.000Z",
            content_hash: "abcdef1234567890",
            truncated: false,
          },
        ],
        checklist: [],
        suggestions: ["Add exact verification commands."],
        privacy: {
          local_only: true,
          external_calls: false,
          stores_file_bodies: false,
          returns_file_bodies: false,
          returns_raw_paths: false,
        },
      };
      instructionReviews.set(projectId, review);
      return review;
    },
    listPrompts() {
      return {
        items: this.promptDetails.map(
          ({ markdown, analysis, improvement_drafts, ...summary }) => summary,
        ),
      };
    },
    searchPrompts() {
      return this.listPrompts();
    },
    getPrompt(id: string) {
      return this.promptDetails.find((prompt) => prompt.id === id);
    },
    deletePrompt() {
      return { deleted: true };
    },
    getQualityDashboard() {
      return {
        total_prompts: 0,
        sensitive_prompts: 0,
        sensitive_ratio: 0,
        recent: { last_7_days: 0, last_30_days: 0 },
        trend: { daily: [] },
        distribution: { by_tool: [], by_project: [] },
        missing_items: [],
        patterns: [],
        instruction_suggestions: [],
        useful_prompts: [],
        duplicate_prompt_groups: [],
        project_profiles: [],
      };
    },
    recordPromptUsage() {
      return {
        recorded: false,
        usefulness: { copied_count: 0, bookmarked: false },
      };
    },
    setPromptBookmark() {
      return {
        updated: false,
        usefulness: { copied_count: 0, bookmarked: false },
      };
    },
    recordCoachFeedback(promptId: string, rating: string) {
      const id = `cfb_${coachFeedback.length + 1}`;
      const entry = {
        id,
        prompt_id: promptId,
        rating: rating as "helpful" | "not_helpful" | "wrong",
        created_at: "2026-05-04T00:00:00.000Z",
      };
      coachFeedback.push(entry);
      return entry;
    },
    getCoachFeedbackSummary() {
      const helpful = coachFeedback.filter(
        (e) => e.rating === "helpful",
      ).length;
      const not_helpful = coachFeedback.filter(
        (e) => e.rating === "not_helpful",
      ).length;
      const wrong = coachFeedback.filter((e) => e.rating === "wrong").length;
      const total = coachFeedback.length;
      return {
        total,
        helpful,
        not_helpful,
        wrong,
        helpful_ratio: total > 0 ? Number((helpful / total).toFixed(4)) : 0,
      };
    },
    createExportJob(input: {
      preset: ExportJob["preset"];
      status: ExportJob["status"];
      prompt_id_hashes: string[];
      project_policy_versions: Record<string, number>;
      redaction_version: string;
      counts: ExportJob["counts"];
      expires_at: string;
    }) {
      const job: ExportJob = {
        id: `exp_${exportJobs.size + 1}`,
        preset: input.preset,
        status: input.status,
        prompt_id_hashes: input.prompt_id_hashes,
        project_policy_versions: input.project_policy_versions,
        redaction_version: input.redaction_version,
        counts: input.counts,
        expires_at: input.expires_at,
        created_at: "2026-05-02T12:00:00.000Z",
      };
      exportJobs.set(job.id, job);
      return job;
    },
    getExportJob(id: string) {
      return exportJobs.get(id);
    },
    updateExportJobStatus(id: string, status: ExportJob["status"]) {
      const job = exportJobs.get(id);
      if (!job) {
        return undefined;
      }
      const updated = { ...job, status };
      exportJobs.set(id, updated);
      return updated;
    },
  } satisfies PromptStoragePort & {
    events: Array<Parameters<PromptStoragePort["storePrompt"]>[0]>;
    policyUpdates: Array<{
      projectId: string;
      patch: Record<string, unknown>;
      actor: "cli" | "web" | "system";
    }>;
    promptDetails: PromptDetail[];
    exportJobs: Map<string, ExportJob>;
    instructionReviews: Map<string, ProjectInstructionReview>;
    policyForIngest:
      | {
          capture_disabled: boolean;
          analysis_disabled: boolean;
          export_disabled: boolean;
          external_analysis_opt_in: boolean;
          version: number;
        }
      | undefined;
    failPolicyLookup: boolean;
  };
}
