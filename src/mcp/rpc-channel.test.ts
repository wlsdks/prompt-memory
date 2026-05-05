import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";

import { createRpcChannel } from "./rpc-channel.js";

function captureWritable() {
  const lines: string[] = [];
  const stream = new PassThrough();
  stream.on("data", (chunk: Buffer) => {
    lines.push(chunk.toString("utf8"));
  });
  return { stream, lines };
}

describe("createRpcChannel", () => {
  it("emits a JSON-RPC request on sendRequest and resolves on a matching response", async () => {
    const { stream, lines } = captureWritable();
    const channel = createRpcChannel(stream);

    const pending = channel.sendRequest<{ ok: true }>(
      "elicitation/create",
      { message: "go" },
      { timeoutMs: 5_000 },
    );

    expect(channel.pendingCount()).toBe(1);
    const sent = JSON.parse(lines[0].trim()) as {
      id: string;
      method: string;
      params: { message: string };
    };
    expect(sent.method).toBe("elicitation/create");
    expect(sent.params.message).toBe("go");

    const fulfilled = channel.fulfillResponse({
      jsonrpc: "2.0",
      id: sent.id,
      result: { ok: true },
    });
    expect(fulfilled).toBe(true);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(channel.pendingCount()).toBe(0);
  });

  it("rejects sendRequest when a matching error envelope arrives", async () => {
    const { stream, lines } = captureWritable();
    const channel = createRpcChannel(stream);

    const pending = channel.sendRequest("elicitation/create", {});
    const sent = JSON.parse(lines[0].trim()) as { id: string };
    channel.fulfillResponse({
      jsonrpc: "2.0",
      id: sent.id,
      error: { code: -32600, message: "denied" },
    });

    await expect(pending).rejects.toThrow("denied");
  });

  it("rejects sendRequest after the timeout elapses", async () => {
    const { stream } = captureWritable();
    const channel = createRpcChannel(stream);

    const pending = channel.sendRequest(
      "elicitation/create",
      {},
      {
        timeoutMs: 25,
      },
    );
    await expect(pending).rejects.toThrow(/timed out/);
    expect(channel.pendingCount()).toBe(0);
  });

  it("ignores responses whose id does not match a pending request", () => {
    const { stream } = captureWritable();
    const channel = createRpcChannel(stream);
    expect(
      channel.fulfillResponse({
        jsonrpc: "2.0",
        id: "unknown-id",
        result: {},
      }),
    ).toBe(false);
  });

  it("isResponseEnvelope distinguishes requests from responses", () => {
    const { stream } = captureWritable();
    const channel = createRpcChannel(stream);
    expect(
      channel.isResponseEnvelope({
        jsonrpc: "2.0",
        id: "abc",
        result: {},
      }),
    ).toBe(true);
    expect(
      channel.isResponseEnvelope({
        jsonrpc: "2.0",
        id: "abc",
        method: "tools/call",
      }),
    ).toBe(false);
  });

  it("cancelAll rejects every pending request", async () => {
    const { stream } = captureWritable();
    const channel = createRpcChannel(stream);
    const pending = channel.sendRequest("elicitation/create", {});
    channel.cancelAll("shutdown");
    await expect(pending).rejects.toThrow("shutdown");
    expect(channel.pendingCount()).toBe(0);
  });
});
