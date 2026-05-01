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
    ).toMatchObject([{ id: ids.beta }]);

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
          analysis: { analyzer: string; warnings: string[] };
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
    "gamma prompt",
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

async function storeClaudePrompt(
  storage: ReturnType<typeof createSqlitePromptStorage>,
  prompt: string,
  receivedAt: string,
) {
  const event = normalizeClaudeCodePayload(
    {
      session_id: `session-${receivedAt}`,
      transcript_path: "/Users/example/.claude/session.jsonl",
      cwd: "/Users/example/project",
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
