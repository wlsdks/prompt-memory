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
    expect(cookie).toContain("prompt_memory_session=");
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
};

function createTestServer(options: TestServerOptions = {}) {
  return createServer({
    dataDir: "/tmp/prompt-memory-test",
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

  return {
    events,
    async storePrompt(input: Parameters<PromptStoragePort["storePrompt"]>[0]) {
      events.push(input);
      return {
        id: "stored-1",
        duplicate: false,
      };
    },
    listPrompts() {
      return { items: [] };
    },
    searchPrompts() {
      return { items: [] };
    },
    getPrompt() {
      return undefined;
    },
    deletePrompt() {
      return { deleted: true };
    },
  } satisfies PromptStoragePort & {
    events: Array<Parameters<PromptStoragePort["storePrompt"]>[0]>;
  };
}
