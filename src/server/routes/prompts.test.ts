import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { initializePromptMemory } from "../../config/config.js";
import { redactPrompt } from "../../redaction/redact.js";
import { createServer } from "../create-server.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("prompt read/delete API", () => {
  it("requires app auth and returns cursor-paginated prompts", async () => {
    const { server, ids } = await createPromptApiFixture();

    const unauthenticated = await server.inject({
      method: "GET",
      url: "/api/v1/prompts",
      headers: { host: "127.0.0.1:17373" },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const firstPage = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?limit=2",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(firstPage.statusCode).toBe(200);
    const firstBody = firstPage.json<{
      data: { items: Array<{ id: string }>; next_cursor?: string };
    }>().data;
    expect(firstBody.items.map((item) => item.id)).toEqual([
      ids.gamma,
      ids.beta,
    ]);
    expect(firstBody.next_cursor).toBeTypeOf("string");

    const secondPage = await server.inject({
      method: "GET",
      url: `/api/v1/prompts?limit=2&cursor=${encodeURIComponent(firstBody.next_cursor!)}`,
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(
      secondPage
        .json<{ data: { items: Array<{ id: string }> } }>()
        .data.items.map((item) => item.id),
    ).toEqual([ids.alpha]);
  });

  it("searches, shows, and deletes prompts", async () => {
    const { server, ids } = await createPromptApiFixture();

    const search = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?q=beta",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(search.statusCode).toBe(200);
    expect(
      search.json<{ data: { items: Array<{ id: string }> } }>().data.items,
    ).toMatchObject([{ id: ids.beta, snippet: "beta prompt" }]);

    const detail = await server.inject({
      method: "GET",
      url: `/api/v1/prompts/${ids.beta}`,
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(detail.statusCode).toBe(200);
    expect(
      detail.json<{
        data: {
          id: string;
          markdown: string;
          analysis: {
            analyzer: string;
            warnings: string[];
            checklist: Array<{ key: string; status: string }>;
            tags: string[];
          };
        };
      }>().data,
    ).toMatchObject({
      id: ids.beta,
      markdown: expect.stringContaining("beta prompt"),
      analysis: {
        analyzer: "local-rules-v1",
        warnings: expect.arrayContaining([
          "작업 대상이나 배경 맥락이 부족합니다.",
        ]),
        checklist: expect.arrayContaining([
          expect.objectContaining({
            key: "verification_criteria",
            status: "missing",
          }),
        ]),
        tags: [],
      },
    });

    const crossOriginDelete = await server.inject({
      method: "DELETE",
      url: `/api/v1/prompts/${ids.beta}`,
      headers: {
        host: "127.0.0.1:17373",
        origin: "https://evil.example",
        authorization: "Bearer app-token",
      },
    });
    expect(crossOriginDelete.statusCode).toBe(403);

    const deleted = await server.inject({
      method: "DELETE",
      url: `/api/v1/prompts/${ids.beta}`,
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ data: { deleted: true } });

    const missing = await server.inject({
      method: "GET",
      url: `/api/v1/prompts/${ids.beta}`,
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("returns the prompt quality dashboard and supports tag filters", async () => {
    const { server, ids } = await createPromptApiFixture();

    const dashboard = await server.inject({
      method: "GET",
      url: "/api/v1/quality",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(dashboard.statusCode).toBe(200);
    expect(
      dashboard.json<{
        data: {
          total_prompts: number;
          missing_items: Array<{ key: string; missing: number }>;
          instruction_suggestions: Array<{ text: string }>;
          project_profiles: Array<{
            key: string;
            prompt_count: number;
            quality_gap_rate: number;
          }>;
          duplicate_prompt_groups: Array<{
            count: number;
            prompts: Array<{ id: string }>;
          }>;
        };
      }>().data,
    ).toMatchObject({
      total_prompts: 3,
      missing_items: expect.arrayContaining([
        expect.objectContaining({ key: "verification_criteria" }),
      ]),
      instruction_suggestions: expect.any(Array),
      project_profiles: expect.arrayContaining([
        expect.objectContaining({
          key: "/Users/example/project",
          prompt_count: 3,
        }),
      ]),
      duplicate_prompt_groups: expect.any(Array),
    });
    expect(JSON.stringify(dashboard.json())).not.toContain("alpha prompt");

    const tagged = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?tag=test",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(tagged.statusCode).toBe(200);
    expect(
      tagged.json<{ data: { items: Array<{ id: string; tags: string[] }> } }>()
        .data.items,
    ).toEqual([
      expect.objectContaining({
        id: ids.gamma,
        tags: expect.arrayContaining(["test"]),
      }),
    ]);
  });

  it("records copy events and bookmark state for local usefulness signals", async () => {
    const { server, ids } = await createPromptApiFixture();

    const copied = await server.inject({
      method: "POST",
      url: `/api/v1/prompts/${ids.gamma}/events`,
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
      payload: {
        type: "prompt_copied",
      },
    });
    expect(copied.statusCode).toBe(200);
    expect(copied.json()).toMatchObject({
      data: {
        recorded: true,
        usefulness: {
          copied_count: 1,
          bookmarked: false,
        },
      },
    });

    const bookmark = await server.inject({
      method: "PUT",
      url: `/api/v1/prompts/${ids.gamma}/bookmark`,
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
      payload: {
        bookmarked: true,
      },
    });
    expect(bookmark.statusCode).toBe(200);
    expect(bookmark.json()).toMatchObject({
      data: {
        updated: true,
        usefulness: {
          copied_count: 1,
          bookmarked: true,
        },
      },
    });

    const detail = await server.inject({
      method: "GET",
      url: `/api/v1/prompts/${ids.gamma}`,
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(detail.statusCode).toBe(200);
    expect(
      detail.json<{
        data: { usefulness: { copied_count: number; bookmarked: boolean } };
      }>().data.usefulness,
    ).toMatchObject({
      copied_count: 1,
      bookmarked: true,
    });

    const dashboard = await server.inject({
      method: "GET",
      url: "/api/v1/quality",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(
      dashboard.json<{
        data: {
          useful_prompts: Array<{
            id: string;
            copied_count: number;
            bookmarked: boolean;
          }>;
        };
      }>().data.useful_prompts,
    ).toEqual([
      expect.objectContaining({
        id: ids.gamma,
        copied_count: 1,
        bookmarked: true,
      }),
    ]);
  });

  it("returns exact duplicate prompt groups without prompt bodies", async () => {
    const { server, ids } = await createDuplicatePromptApiFixture();

    const dashboard = await server.inject({
      method: "GET",
      url: "/api/v1/quality",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(dashboard.statusCode).toBe(200);
    const body = dashboard.json<{
      data: {
        duplicate_prompt_groups: Array<{
          count: number;
          prompts: Array<{ id: string }>;
        }>;
      };
    }>().data;
    expect(body.duplicate_prompt_groups).toEqual([
      expect.objectContaining({
        count: 2,
        prompts: expect.arrayContaining([
          expect.objectContaining({ id: ids.alpha }),
          expect.objectContaining({ id: ids.beta }),
        ]),
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain("alpha prompt");

    const list = await server.inject({
      method: "GET",
      url: "/api/v1/prompts",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(
      list
        .json<{
          data: { items: Array<{ id: string; duplicate_count: number }> };
        }>()
        .data.items.find((item) => item.id === ids.alpha),
    ).toMatchObject({ duplicate_count: 2 });
  });

  it("filters prompts by focus query", async () => {
    const { server, ids } = await createDuplicatePromptApiFixture();

    const duplicated = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?focus=duplicated",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(duplicated.statusCode).toBe(200);
    expect(
      duplicated
        .json<{ data: { items: Array<{ id: string }> } }>()
        .data.items.map((item) => item.id),
    ).toEqual([ids.beta, ids.alpha]);

    const invalid = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?focus=unknown",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(invalid.statusCode).toBe(422);
  });

  it("filters prompts by quality gap query", async () => {
    const { server, ids } = await createPromptApiFixture();

    const verificationGap = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?quality_gap=verification_criteria",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(verificationGap.statusCode).toBe(200);
    expect(
      verificationGap
        .json<{ data: { items: Array<{ id: string }> } }>()
        .data.items.map((item) => item.id),
    ).toEqual([ids.beta, ids.alpha]);

    const searchWithGap = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?q=alpha&quality_gap=verification_criteria",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(searchWithGap.statusCode).toBe(200);
    expect(
      searchWithGap
        .json<{ data: { items: Array<{ id: string }> } }>()
        .data.items.map((item) => item.id),
    ).toEqual([ids.alpha]);

    const invalid = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?quality_gap=unknown",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(invalid.statusCode).toBe(422);
  });

  it("filters prompts by reused focus query", async () => {
    const { server, ids } = await createReusedPromptApiFixture();

    const reused = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?focus=reused",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(reused.statusCode).toBe(200);
    expect(
      reused
        .json<{ data: { items: Array<{ id: string }> } }>()
        .data.items.map((item) => item.id),
    ).toEqual([ids.gamma, ids.beta]);

    const searched = await server.inject({
      method: "GET",
      url: "/api/v1/prompts?q=beta&focus=reused",
      headers: {
        host: "127.0.0.1:17373",
        authorization: "Bearer app-token",
      },
    });
    expect(searched.statusCode).toBe(200);
    expect(
      searched
        .json<{ data: { items: Array<{ id: string }> } }>()
        .data.items.map((item) => item.id),
    ).toEqual([ids.beta]);
  });
});

async function createPromptApiFixture() {
  const dataDir = createTempDir();
  initializePromptMemory({ dataDir });
  const storage = createSqlitePromptStorage({
    dataDir,
    hmacSecret: "test-secret",
    now: nextDate([
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T10:01:00.000Z",
      "2026-05-01T10:02:00.000Z",
    ]),
  });
  const alpha = await storeClaudePrompt(
    storage,
    "alpha prompt",
    "2026-05-01T10:00:00.000Z",
  );
  const beta = await storeClaudePrompt(
    storage,
    "beta prompt",
    "2026-05-01T10:01:00.000Z",
  );
  const gamma = await storeClaudePrompt(
    storage,
    "Update src/server/routes/prompts.ts and run pnpm test.",
    "2026-05-01T10:02:00.000Z",
  );
  const server = createServer({
    dataDir,
    auth: {
      appToken: "app-token",
      ingestToken: "ingest-token",
      webSessionSecret: "web-session-secret",
    },
    storage,
    redactionMode: "mask",
  });

  return {
    server,
    ids: {
      alpha: alpha.id,
      beta: beta.id,
      gamma: gamma.id,
    },
  };
}

async function createDuplicatePromptApiFixture() {
  const dataDir = createTempDir();
  initializePromptMemory({ dataDir });
  const storage = createSqlitePromptStorage({
    dataDir,
    hmacSecret: "test-secret",
    now: nextDate([
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T10:01:00.000Z",
      "2026-05-01T10:02:00.000Z",
    ]),
  });
  const duplicatePrompt =
    "Refactor duplicate prompt flow. 검증 기준: pnpm test. 출력 형식: 요약.";
  const alpha = await storeClaudePrompt(
    storage,
    duplicatePrompt,
    "2026-05-01T10:00:00.000Z",
    "/Users/example/project-a",
  );
  const beta = await storeClaudePrompt(
    storage,
    duplicatePrompt,
    "2026-05-01T10:01:00.000Z",
    "/Users/example/project-b",
  );
  const gamma = await storeClaudePrompt(
    storage,
    "Unique prompt",
    "2026-05-01T10:02:00.000Z",
    "/Users/example/project-c",
  );
  const server = createServer({
    dataDir,
    auth: {
      appToken: "app-token",
      ingestToken: "ingest-token",
      webSessionSecret: "web-session-secret",
    },
    storage,
    redactionMode: "mask",
  });

  return {
    server,
    ids: {
      alpha: alpha.id,
      beta: beta.id,
      gamma: gamma.id,
    },
  };
}

async function createReusedPromptApiFixture() {
  const dataDir = createTempDir();
  initializePromptMemory({ dataDir });
  const storage = createSqlitePromptStorage({
    dataDir,
    hmacSecret: "test-secret",
    now: nextDate([
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T10:01:00.000Z",
      "2026-05-01T10:02:00.000Z",
    ]),
  });
  const alpha = await storeClaudePrompt(
    storage,
    "alpha prompt",
    "2026-05-01T10:00:00.000Z",
  );
  const beta = await storeClaudePrompt(
    storage,
    "beta prompt",
    "2026-05-01T10:01:00.000Z",
  );
  const gamma = await storeClaudePrompt(
    storage,
    "gamma prompt",
    "2026-05-01T10:02:00.000Z",
  );
  storage.recordPromptUsage(beta.id, "prompt_copied");
  storage.setPromptBookmark(gamma.id, true);
  const server = createServer({
    dataDir,
    auth: {
      appToken: "app-token",
      ingestToken: "ingest-token",
      webSessionSecret: "web-session-secret",
    },
    storage,
    redactionMode: "mask",
  });

  return {
    server,
    ids: {
      alpha: alpha.id,
      beta: beta.id,
      gamma: gamma.id,
    },
  };
}

async function storeClaudePrompt(
  storage: ReturnType<typeof createSqlitePromptStorage>,
  prompt: string,
  receivedAt: string,
  cwd = "/Users/example/project",
) {
  const event = normalizeClaudeCodePayload(
    {
      session_id: `session-${receivedAt}`,
      transcript_path: "/Users/example/.claude/session.jsonl",
      cwd,
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt,
    },
    new Date(receivedAt),
  );

  return storage.storePrompt({
    event,
    redaction: redactPrompt(event.prompt, "mask"),
  });
}

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-api-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function nextDate(values: string[]): () => Date {
  let index = 0;

  return () => new Date(values[index++] ?? values.at(-1)!);
}
