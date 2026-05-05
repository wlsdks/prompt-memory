import type { Writable } from "node:stream";

export type RpcId = string;

export type RpcResponseEnvelope =
  | { jsonrpc: "2.0"; id: RpcId; result: unknown }
  | {
      jsonrpc: "2.0";
      id: RpcId;
      error: { code: number; message: string; data?: unknown };
    };

export type RpcChannel = {
  sendRequest<T>(
    method: string,
    params: unknown,
    options?: { timeoutMs?: number },
  ): Promise<T>;
  fulfillResponse(envelope: RpcResponseEnvelope): boolean;
  isResponseEnvelope(value: unknown): value is RpcResponseEnvelope;
  pendingCount(): number;
  cancelAll(reason?: string): void;
};

const DEFAULT_TIMEOUT_MS = 60_000;

type PendingEntry = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeoutHandle?: ReturnType<typeof setTimeout>;
};

export function createRpcChannel(output: Writable): RpcChannel {
  const pending = new Map<RpcId, PendingEntry>();
  let nextId = 1;

  function sendRequest<T>(
    method: string,
    params: unknown,
    options?: { timeoutMs?: number },
  ): Promise<T> {
    const id = `pm-server-${nextId++}`;
    return new Promise<T>((resolve, reject) => {
      const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const timeoutHandle = setTimeout(() => {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        entry.reject(
          new Error(
            `server request '${method}' timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);
      pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeoutHandle,
      });
      const envelope = {
        jsonrpc: "2.0" as const,
        id,
        method,
        params,
      };
      try {
        output.write(`${JSON.stringify(envelope)}\n`);
      } catch (error) {
        const entry = pending.get(id);
        if (entry?.timeoutHandle) clearTimeout(entry.timeoutHandle);
        pending.delete(id);
        reject(
          error instanceof Error
            ? error
            : new Error("failed to write server request"),
        );
      }
    });
  }

  function fulfillResponse(envelope: RpcResponseEnvelope): boolean {
    const entry = pending.get(envelope.id);
    if (!entry) return false;
    pending.delete(envelope.id);
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
    if ("error" in envelope) {
      entry.reject(
        new Error(envelope.error.message || "remote error from client"),
      );
    } else {
      entry.resolve(envelope.result);
    }
    return true;
  }

  function isResponseEnvelope(value: unknown): value is RpcResponseEnvelope {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    if (candidate.jsonrpc !== "2.0") return false;
    if (typeof candidate.id !== "string") return false;
    if (typeof (candidate as Record<string, unknown>).method !== "undefined") {
      return false;
    }
    return "result" in candidate || "error" in candidate;
  }

  function pendingCount(): number {
    return pending.size;
  }

  function cancelAll(reason = "channel closed"): void {
    for (const [id, entry] of pending.entries()) {
      if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
      entry.reject(new Error(reason));
      pending.delete(id);
    }
  }

  return {
    sendRequest,
    fulfillResponse,
    isResponseEnvelope,
    pendingCount,
    cancelAll,
  };
}
