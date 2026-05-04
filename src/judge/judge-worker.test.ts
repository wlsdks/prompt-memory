import { describe, expect, it, vi } from "vitest";

import {
  createJudgeWorker,
  type JudgeWorkerSettings,
  type JudgeWorkerStorage,
} from "./judge-worker.js";
import type { JudgeOutcome } from "./auto-judge.js";

type RecordedJudgeInput = {
  promptId: string;
  judgeTool: "claude" | "codex";
  score: number;
  reason: string;
};

function createFakeStorage(
  options: {
    pending?: string[];
    prompts?: Record<string, string>;
  } = {},
) {
  const pending = [...(options.pending ?? [])];
  const prompts = options.prompts ?? {};
  const recorded: RecordedJudgeInput[] = [];

  const storage: JudgeWorkerStorage = {
    listPromptIdsNeedingJudge: vi.fn((limit: number) =>
      pending.splice(0, limit),
    ),
    getPrompt: vi.fn((id: string) => {
      const body = prompts[id];
      return body
        ? ({
            id,
            tool: "claude-code",
            source_event: "UserPromptSubmit",
            session_id: "sess",
            cwd: "/cwd",
            created_at: "2026-05-04T10:00:00.000Z",
            received_at: "2026-05-04T10:00:00.000Z",
            snippet: body.slice(0, 80),
            prompt_length: body.length,
            is_sensitive: false,
            excluded_from_analysis: false,
            redaction_policy: "mask",
            adapter_version: "1",
            index_status: "indexed",
            tags: [],
            quality_gaps: [],
            quality_score: 70,
            quality_score_band: "good",
            usefulness: {
              copied_count: 0,
              bookmarked: false,
            },
            duplicate_count: 1,
            markdown: body,
            improvement_drafts: [],
          } as unknown as ReturnType<typeof storage.getPrompt>)
        : undefined;
    }),
    recordJudgeScore: vi.fn((input) => {
      recorded.push(input);
      return {
        id: `jdg_${recorded.length}`,
        prompt_id: input.promptId,
        judge_tool: input.judgeTool,
        score: input.score,
        reason: input.reason,
        created_at: "2026-05-04T10:00:00.000Z",
      };
    }),
    getLatestJudgeScore: vi.fn(() => undefined),
  };

  return { storage, recorded };
}

const baseSettings: JudgeWorkerSettings = {
  enabled: true,
  tool: "claude",
  daily_limit: 50,
  per_minute_limit: 5,
};

describe("createJudgeWorker", () => {
  it("skips entirely when auto_judge is disabled", async () => {
    const { storage, recorded } = createFakeStorage({
      pending: ["prmt_a"],
      prompts: { prmt_a: "body" },
    });
    const judge = vi.fn();

    const worker = createJudgeWorker({
      storage,
      getSettings: () => ({ ...baseSettings, enabled: false }),
      runJudge: judge,
    });

    const result = await worker.runOnce();

    expect(result).toEqual({ judged: 0, skipped: 0, reason: "disabled" });
    expect(judge).not.toHaveBeenCalled();
    expect(recorded).toEqual([]);
    expect(storage.listPromptIdsNeedingJudge).not.toHaveBeenCalled();
  });

  it("judges pending prompts and records the score against the prompt id", async () => {
    const { storage, recorded } = createFakeStorage({
      pending: ["prmt_a", "prmt_b"],
      prompts: { prmt_a: "first body", prmt_b: "second body" },
    });
    const judge = vi.fn(
      (input: { redactedPrompt: string }): JudgeOutcome => ({
        kind: "ok",
        score: 80,
        reason: `judged ${input.redactedPrompt.slice(0, 5)}`,
      }),
    );

    const worker = createJudgeWorker({
      storage,
      getSettings: () => baseSettings,
      runJudge: judge,
    });

    const result = await worker.runOnce();

    expect(result).toMatchObject({
      judged: 2,
      skipped: 0,
      reason: "completed",
    });
    expect(recorded).toEqual([
      {
        promptId: "prmt_a",
        judgeTool: "claude",
        score: 80,
        reason: "judged first",
      },
      {
        promptId: "prmt_b",
        judgeTool: "claude",
        score: 80,
        reason: "judged secon",
      },
    ]);
    expect(storage.listPromptIdsNeedingJudge).toHaveBeenCalledWith(5);
  });

  it("respects per_minute_limit across consecutive runOnce calls", async () => {
    const { storage } = createFakeStorage({
      pending: ["prmt_a", "prmt_b", "prmt_c", "prmt_d"],
      prompts: {
        prmt_a: "a",
        prmt_b: "b",
        prmt_c: "c",
        prmt_d: "d",
      },
    });
    const judge = vi.fn(
      (): JudgeOutcome => ({ kind: "ok", score: 90, reason: "ok" }),
    );

    let nowMs = 0;
    const worker = createJudgeWorker({
      storage,
      getSettings: () => ({ ...baseSettings, per_minute_limit: 2 }),
      runJudge: judge,
      now: () => new Date(nowMs),
    });

    nowMs = 1_000;
    const first = await worker.runOnce();
    expect(first).toMatchObject({ judged: 2, reason: "completed" });

    nowMs = 2_000;
    const second = await worker.runOnce();
    expect(second).toEqual({ judged: 0, skipped: 0, reason: "rate_limited" });

    nowMs = 65_000;
    const third = await worker.runOnce();
    expect(third).toMatchObject({ judged: 2, reason: "completed" });
  });

  it("respects daily_limit and rolls over after 24 hours", async () => {
    const { storage } = createFakeStorage({
      pending: ["prmt_a", "prmt_b", "prmt_c"],
      prompts: { prmt_a: "a", prmt_b: "b", prmt_c: "c" },
    });
    const judge = vi.fn(
      (): JudgeOutcome => ({ kind: "ok", score: 80, reason: "ok" }),
    );

    let nowMs = 0;
    const worker = createJudgeWorker({
      storage,
      getSettings: () => ({
        ...baseSettings,
        daily_limit: 1,
        per_minute_limit: 100,
      }),
      runJudge: judge,
      now: () => new Date(nowMs),
    });

    nowMs = 1_000;
    expect(await worker.runOnce()).toMatchObject({ judged: 1 });
    nowMs = 2_000;
    expect(await worker.runOnce()).toEqual({
      judged: 0,
      skipped: 0,
      reason: "rate_limited",
    });

    nowMs = 1_000 + 24 * 60 * 60 * 1_000 + 1;
    expect(await worker.runOnce()).toMatchObject({ judged: 1 });
  });

  it("counts skipped outcomes from the judge subprocess and does not record them", async () => {
    const { storage, recorded } = createFakeStorage({
      pending: ["prmt_a", "prmt_b"],
      prompts: { prmt_a: "a", prmt_b: "b" },
    });
    const judge = vi
      .fn<(input: { redactedPrompt: string }) => JudgeOutcome>()
      .mockReturnValueOnce({ kind: "skipped", reason: "cli_missing" })
      .mockReturnValueOnce({ kind: "ok", score: 70, reason: "OK" });

    const worker = createJudgeWorker({
      storage,
      getSettings: () => baseSettings,
      runJudge: judge,
    });

    const result = await worker.runOnce();

    expect(result).toMatchObject({ judged: 1, skipped: 1 });
    expect(recorded).toEqual([
      {
        promptId: "prmt_b",
        judgeTool: "claude",
        score: 70,
        reason: "OK",
      },
    ]);
  });

  it("returns no_pending when the queue is empty even with rate budget left", async () => {
    const { storage } = createFakeStorage({ pending: [] });
    const judge = vi.fn();

    const worker = createJudgeWorker({
      storage,
      getSettings: () => baseSettings,
      runJudge: judge,
    });

    expect(await worker.runOnce()).toEqual({
      judged: 0,
      skipped: 0,
      reason: "no_pending",
    });
    expect(judge).not.toHaveBeenCalled();
  });

  it("delivers an unmodified redacted prompt body to the judge subprocess", async () => {
    const redactedBody = "Refactor [REDACTED:path] using [REDACTED:api_key]";
    const { storage } = createFakeStorage({
      pending: ["prmt_a"],
      prompts: { prmt_a: redactedBody },
    });
    const judge = vi.fn((input: { redactedPrompt: string }): JudgeOutcome => {
      expect(input.redactedPrompt).toBe(redactedBody);
      return { kind: "ok", score: 88, reason: "looks fine" };
    });

    const worker = createJudgeWorker({
      storage,
      getSettings: () => baseSettings,
      runJudge: judge,
    });

    const result = await worker.runOnce();
    expect(result).toMatchObject({ judged: 1, reason: "completed" });
  });
});
