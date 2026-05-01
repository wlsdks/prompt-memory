import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createServer } from "./create-server.js";
import type { PromptStoragePort } from "../storage/ports.js";

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

describe("createServer P2 ingest boundary", () => {
  it("returns health without auth", async () => {
    const server = createTestServer();

    const response = await server.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { host: "127.0.0.1:17373" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, version: "0.0.0" });
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
      "/Users/example/side-project/prompt-memory",
    );
    expect(storage.events[0]?.redaction.stored_text).toContain(
      "[REDACTED:email]",
    );
    expect(storage.events[0]?.redaction.stored_text).not.toContain(
      "test@example.com",
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
});

type TestServerOptions = {
  storage?: ReturnType<typeof createMemoryStorage>;
  redactionMode?: "mask" | "raw" | "reject";
  excludedProjectRoots?: string[];
  maxPromptLength?: number;
};

function createTestServer(options: TestServerOptions = {}) {
  return createServer({
    dataDir: "/tmp/prompt-memory-test",
    auth: {
      appToken: "app-token",
      ingestToken: "ingest-token",
    },
    redactionMode: options.redactionMode ?? "mask",
    excludedProjectRoots: options.excludedProjectRoots ?? [],
    maxPromptLength: options.maxPromptLength ?? 10_000,
    storage: options.storage ?? createMemoryStorage(),
  });
}

function createMemoryStorage() {
  const events: Array<Parameters<PromptStoragePort["storePrompt"]>[0]> = [];

  return {
    events,
    async storePrompt(input: Parameters<PromptStoragePort["storePrompt"]>[0]) {
      events.push(input);
      return {
        id: "stored-1",
        duplicate: false,
      };
    },
  } satisfies PromptStoragePort & {
    events: Array<Parameters<PromptStoragePort["storePrompt"]>[0]>;
  };
}
