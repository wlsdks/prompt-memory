import { describe, expect, it, vi } from "vitest";

import type { NormalizedPromptEvent } from "../shared/schema.js";
import { ingestPrompt } from "./ingest-flow.js";
import type { IngestPromptStorage } from "./ingest-flow.js";

function buildEvent(
  overrides: Partial<NormalizedPromptEvent> = {},
): NormalizedPromptEvent {
  return {
    tool: "claude-code",
    source_event: "UserPromptSubmit",
    prompt: "Refactor authentication",
    session_id: "sess-1",
    cwd: "/Users/me/code/proj",
    project_root: undefined,
    created_at: "2026-05-08T00:00:00.000Z",
    received_at: "2026-05-08T00:00:00.000Z",
    idempotency_key: "claude-code:sess-1:abc",
    adapter_version: "claude-code-v1",
    schema_version: 1,
    raw_event_hash: "hash",
    ...overrides,
  } as NormalizedPromptEvent;
}

function buildStorage(
  overrides: Partial<IngestPromptStorage> = {},
): IngestPromptStorage {
  return {
    storePrompt: vi.fn().mockResolvedValue({
      id: "prmt_1",
      duplicate: false,
    }),
    ...overrides,
  } as IngestPromptStorage;
}

describe("ingestPrompt", () => {
  it("stores the prompt when no policy or redaction blocks it", async () => {
    const storage = buildStorage();
    const result = await ingestPrompt(storage, buildEvent(), {
      redactionMode: "mask",
    });
    expect(result).toEqual({
      stored: true,
      id: "prmt_1",
      duplicate: false,
      sensitive: false,
    });
    expect(storage.storePrompt).toHaveBeenCalledTimes(1);
  });

  it("returns reason=project_policy when capture is disabled for the project", async () => {
    const storage = buildStorage({
      getProjectPolicyForEvent: vi.fn().mockReturnValue({
        capture_disabled: true,
      }),
    });
    const result = await ingestPrompt(storage, buildEvent(), {
      redactionMode: "mask",
    });
    expect(result).toEqual({ stored: false, reason: "project_policy" });
    expect(storage.storePrompt).not.toHaveBeenCalled();
  });

  it("returns reason=policy_lookup_failed when the project policy lookup throws", async () => {
    const storage = buildStorage({
      getProjectPolicyForEvent: vi.fn().mockImplementation(() => {
        throw new Error("db down");
      }),
    });
    const result = await ingestPrompt(storage, buildEvent(), {
      redactionMode: "mask",
    });
    expect(result).toEqual({
      stored: false,
      reason: "policy_lookup_failed",
    });
    expect(storage.storePrompt).not.toHaveBeenCalled();
  });

  it("rejects sensitive prompts when redactionMode is reject", async () => {
    const storage = buildStorage();
    const sensitive = "AKIA0123456789ABCDEF and password=secret123";
    const result = await ingestPrompt(
      storage,
      buildEvent({ prompt: sensitive }),
      { redactionMode: "reject" },
    );
    expect(result).toEqual({
      stored: false,
      reason: "redaction_rejected",
    });
    expect(storage.storePrompt).not.toHaveBeenCalled();
  });

  it("still stores sensitive prompts when redactionMode is mask", async () => {
    const storage = buildStorage();
    const sensitive = "AKIA0123456789ABCDEF and password=secret123";
    const result = await ingestPrompt(
      storage,
      buildEvent({ prompt: sensitive }),
      { redactionMode: "mask" },
    );
    expect(result.stored).toBe(true);
    if (result.stored) {
      expect(result.sensitive).toBe(true);
    }
    expect(storage.storePrompt).toHaveBeenCalledTimes(1);
  });

  it("propagates duplicate from storage", async () => {
    const storage = buildStorage({
      storePrompt: vi.fn().mockResolvedValue({
        id: "prmt_existing",
        duplicate: true,
      }),
    });
    const result = await ingestPrompt(storage, buildEvent(), {
      redactionMode: "mask",
    });
    expect(result).toEqual({
      stored: true,
      id: "prmt_existing",
      duplicate: true,
      sensitive: false,
    });
  });
});
