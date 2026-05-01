import { createServer as createHttpServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { postHookPayload } from "./post-to-server.js";

const servers: Array<ReturnType<typeof createHttpServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  servers.length = 0;
});

describe("postHookPayload", () => {
  it("posts hook JSON with ingest token", async () => {
    const received: { headers?: unknown; body?: unknown } = {};
    const server = createHttpServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk.toString("utf8");
      });
      request.on("end", () => {
        received.headers = request.headers;
        received.body = JSON.parse(body);
        response.writeHead(200).end();
      });
    });
    servers.push(server);
    await listen(server);
    const port = (server.address() as AddressInfo).port;

    const result = await postHookPayload({
      url: `http://127.0.0.1:${port}/api/v1/ingest/claude-code`,
      ingestToken: "ingest-token",
      payload: { prompt: "hello" },
      timeoutMs: 1_000,
    });

    expect(result.ok).toBe(true);
    expect(received.headers).toMatchObject({
      authorization: "Bearer ingest-token",
      "content-type": "application/json",
    });
    expect(received.body).toEqual({ prompt: "hello" });
  });

  it("fails closed internally but returns non-throwing result when server is down", async () => {
    const result = await postHookPayload({
      url: "http://127.0.0.1:9/api/v1/ingest/claude-code",
      ingestToken: "ingest-token",
      payload: { prompt: "hello" },
      timeoutMs: 25,
    });

    expect(result.ok).toBe(false);
  });
});

function listen(server: ReturnType<typeof createHttpServer>): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
}
