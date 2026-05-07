import { runAutoJudge, type JudgeOutcome } from "./auto-judge.js";
import { redactPrompt } from "../redaction/redact.js";
import { DAY_MS, MINUTE_MS } from "../shared/time.js";
import type {
  JudgeScoreStoragePort,
  JudgeTool,
  PromptDetail,
  PromptReadStoragePort,
} from "../storage/ports.js";

export type JudgeWorkerSettings = {
  enabled: boolean;
  tool: JudgeTool;
  daily_limit: number;
  per_minute_limit: number;
};

export type JudgeWorkerStorage = JudgeScoreStoragePort &
  Pick<PromptReadStoragePort, "getPrompt">;

export type JudgeWorkerOptions = {
  storage: JudgeWorkerStorage;
  getSettings: () => JudgeWorkerSettings;
  runJudge?: (input: {
    tool: JudgeTool;
    redactedPrompt: string;
  }) => JudgeOutcome | Promise<JudgeOutcome>;
  intervalMs?: number;
  now?: () => Date;
  onError?: (error: unknown) => void;
};

export type JudgeWorkerTickResult = {
  judged: number;
  skipped: number;
  reason?: "disabled" | "rate_limited" | "no_pending" | "completed";
};

export type JudgeWorker = {
  start(): void;
  stop(): void;
  runOnce(): Promise<JudgeWorkerTickResult>;
};

const DEFAULT_INTERVAL_MS = 30_000;

export function createJudgeWorker(options: JudgeWorkerOptions): JudgeWorker {
  const minuteWindow: number[] = [];
  let dailyCount = 0;
  let dailyResetAt = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  function clock(): Date {
    return options.now ? options.now() : new Date();
  }

  function pruneMinuteWindow(nowMs: number): void {
    const cutoff = nowMs - MINUTE_MS;
    while (minuteWindow.length > 0 && minuteWindow[0]! < cutoff) {
      minuteWindow.shift();
    }
  }

  function rollDailyCounter(nowMs: number): void {
    if (dailyResetAt === 0 || nowMs >= dailyResetAt) {
      dailyCount = 0;
      dailyResetAt = nowMs + DAY_MS;
    }
  }

  async function runOnce(): Promise<JudgeWorkerTickResult> {
    const settings = options.getSettings();
    if (!settings.enabled) {
      return { judged: 0, skipped: 0, reason: "disabled" };
    }

    const now = clock();
    const nowMs = now.getTime();
    pruneMinuteWindow(nowMs);
    rollDailyCounter(nowMs);

    const minuteRemaining = Math.max(
      0,
      settings.per_minute_limit - minuteWindow.length,
    );
    const dailyRemaining = Math.max(0, settings.daily_limit - dailyCount);
    const budget = Math.min(minuteRemaining, dailyRemaining);
    if (budget === 0) {
      return { judged: 0, skipped: 0, reason: "rate_limited" };
    }

    const pending = options.storage.listPromptIdsNeedingJudge(budget);
    if (pending.length === 0) {
      return { judged: 0, skipped: 0, reason: "no_pending" };
    }

    let judged = 0;
    let skipped = 0;
    const judge = options.runJudge ?? runAutoJudge;
    for (const id of pending) {
      const detail = readPrompt(options.storage, id);
      if (!detail) {
        skipped += 1;
        continue;
      }

      const outcome = await Promise.resolve(
        judge({ tool: settings.tool, redactedPrompt: detail.markdown }),
      );
      if (outcome.kind === "skipped") {
        skipped += 1;
        continue;
      }

      options.storage.recordJudgeScore({
        promptId: id,
        judgeTool: settings.tool,
        score: outcome.score,
        reason: redactJudgeReason(outcome.reason),
      });
      minuteWindow.push(nowMs);
      dailyCount += 1;
      judged += 1;
    }

    return { judged, skipped, reason: "completed" };
  }

  function start(): void {
    if (timer) {
      return;
    }
    timer = setInterval(() => {
      runOnce().catch((error) => {
        options.onError?.(error);
      });
    }, options.intervalMs ?? DEFAULT_INTERVAL_MS);
    timer.unref?.();
  }

  function stop(): void {
    if (!timer) {
      return;
    }
    clearInterval(timer);
    timer = undefined;
  }

  return { start, stop, runOnce };
}

function readPrompt(
  storage: JudgeWorkerStorage,
  id: string,
): PromptDetail | undefined {
  const reader = (storage as Partial<PromptReadStoragePort>).getPrompt;
  if (!reader) {
    return undefined;
  }
  return reader(id);
}

function redactJudgeReason(reason: string): string {
  return redactPrompt(reason, "mask").stored_text;
}
