import { setTimeout } from "node:timers/promises";
import type { Command } from "commander";

import {
  coachPromptTool,
  type CoachPromptToolResult,
} from "../../mcp/score-tool.js";
import { UserError } from "../user-error.js";

export type BuddyStyle = "block" | "line" | "json";

const BUDDY_STYLES: readonly BuddyStyle[] = ["block", "line", "json"];

type BuddyCliOptions = {
  dataDir?: string;
  interval?: string | number;
  json?: boolean;
  once?: boolean;
  style?: BuddyStyle;
};

const DEFAULT_BUDDY_INTERVAL_SECONDS = 2;
const MIN_BUDDY_INTERVAL_SECONDS = 1;
const BUDDY_INTERVAL_MS = 1000;
const DEFAULT_ARCHIVE_PROMPT_LIMIT = 200;
const DEFAULT_LOW_SCORE_LIMIT = 3;

export type BuddySnapshot = {
  mode: "buddy";
  generated_at: string;
  status: CoachPromptToolResult["status"];
  latest_prompt?: {
    value: number;
    max: number;
    band: string;
    top_gap?: string;
    tool?: string;
  };
  habit?: {
    average: number;
    max: number;
    band: string;
    top_gap?: string;
  };
  next_move: string;
  privacy: {
    local_only: true;
    external_calls: false;
    returns_prompt_bodies: false;
    returns_raw_paths: false;
  };
};

export function registerBuddyCommand(program: Command): void {
  program
    .command("buddy")
    .description(
      "Show an always-on prompt score buddy for a side terminal pane.",
    )
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--json", "Print one JSON snapshot.")
    .option("--once", "Print one text snapshot and exit.")
    .option(
      "--style <style>",
      "Output style: block (default multi-line), line (single statusline-style row), or json.",
    )
    .option(
      "--interval <seconds>",
      "Refresh interval for the terminal buddy.",
      String(DEFAULT_BUDDY_INTERVAL_SECONDS),
    )
    .action(async (options: BuddyCliOptions) => {
      const style = resolveBuddyStyle(options);
      if (
        style === "json" ||
        style === "line" ||
        options.once ||
        !process.stdout.isTTY
      ) {
        console.log(renderBuddyForCli(options));
        return;
      }

      await runBuddyLoop(options);
    });
}

export function renderBuddyForCli(options: BuddyCliOptions = {}): string {
  const style = resolveBuddyStyle(options);
  const snapshot = createBuddySnapshot(options);

  switch (style) {
    case "json":
      return JSON.stringify(snapshot, null, 2);
    case "line":
      return formatBuddyLine(snapshot);
    case "block":
    default:
      return formatBuddySnapshot(snapshot);
  }
}

function resolveBuddyStyle(options: BuddyCliOptions): BuddyStyle {
  if (options.style !== undefined) {
    if (!BUDDY_STYLES.includes(options.style)) {
      throw new UserError(
        `Unsupported --style value: ${String(options.style)}. Use one of: ${BUDDY_STYLES.join(", ")}.`,
      );
    }
    return options.style;
  }
  if (options.json) {
    return "json";
  }
  return "block";
}

function createBuddySnapshot(options: BuddyCliOptions = {}): BuddySnapshot {
  const result = createBuddyCoachResult(options);
  const latest = createLatestPromptSnapshot(result);
  const habit = createHabitSnapshot(result);

  return {
    mode: "buddy",
    generated_at: result.generated_at,
    status: result.status,
    ...(latest ? { latest_prompt: latest } : {}),
    ...(habit ? { habit } : {}),
    next_move: createNextMove({ result, latest, habit }),
    privacy: {
      local_only: true,
      external_calls: false,
      returns_prompt_bodies: false,
      returns_raw_paths: false,
    },
  };
}

function createBuddyCoachResult(
  options: BuddyCliOptions,
): CoachPromptToolResult {
  return coachPromptTool(
    {
      include_latest_score: true,
      include_improvement: false,
      include_archive: true,
      include_project_rules: false,
      max_prompts: DEFAULT_ARCHIVE_PROMPT_LIMIT,
      low_score_limit: DEFAULT_LOW_SCORE_LIMIT,
    },
    { dataDir: options.dataDir },
  );
}

function createLatestPromptSnapshot(
  result: CoachPromptToolResult,
): BuddySnapshot["latest_prompt"] {
  if (!result.latest_score || "is_error" in result.latest_score) {
    return undefined;
  }

  return {
    value: result.latest_score.quality_score.value,
    max: result.latest_score.quality_score.max,
    band: result.latest_score.quality_score.band,
    top_gap: result.latest_score.checklist.find(
      (item) => item.status === "missing" || item.status === "weak",
    )?.label,
    tool: result.status.latest_prompt?.tool,
  };
}

function createHabitSnapshot(
  result: CoachPromptToolResult,
): BuddySnapshot["habit"] {
  if (!result.archive || "is_error" in result.archive) {
    return undefined;
  }

  return {
    average: result.archive.archive_score.average,
    max: result.archive.archive_score.max,
    band: result.archive.archive_score.band,
    top_gap: result.archive.top_gaps[0]?.label,
  };
}

function formatBuddyLine(snapshot: BuddySnapshot): string {
  const segments: string[] = ["pm"];

  if (snapshot.latest_prompt) {
    segments.push(
      `${snapshot.latest_prompt.value}/${snapshot.latest_prompt.max} ${snapshot.latest_prompt.band}`,
    );
    if (snapshot.latest_prompt.top_gap) {
      segments.push(`gap=${snapshot.latest_prompt.top_gap}`);
    }
  } else {
    segments.push("no prompt yet");
  }

  if (snapshot.habit) {
    segments.push(`habit ${snapshot.habit.average}/${snapshot.habit.max}`);
  }

  segments.push(snapshot.status.status);

  return segments.join(" · ");
}

function formatBuddySnapshot(snapshot: BuddySnapshot): string {
  const rows = [
    "Prompt Memory Buddy",
    `Status        ${snapshot.status.status} (${snapshot.status.total_prompts} prompts)`,
  ];

  if (snapshot.latest_prompt) {
    rows.push(
      `Latest prompt ${snapshot.latest_prompt.value}/${snapshot.latest_prompt.max} ${snapshot.latest_prompt.band}`,
    );
    if (snapshot.latest_prompt.tool) {
      rows.push(`Tool          ${snapshot.latest_prompt.tool}`);
    }
    if (snapshot.latest_prompt.top_gap) {
      rows.push(`Gap           ${snapshot.latest_prompt.top_gap}`);
    }
  } else {
    rows.push("Latest prompt not captured yet");
  }

  if (snapshot.habit) {
    rows.push(
      `Habit         ${snapshot.habit.average}/${snapshot.habit.max} ${snapshot.habit.band}`,
    );
    if (snapshot.habit.top_gap) {
      rows.push(`Habit gap     ${snapshot.habit.top_gap}`);
    }
  }

  rows.push(
    `Next move     ${snapshot.next_move}`,
    `Updated       ${snapshot.generated_at}`,
    "Privacy      local-only, no external calls, no prompt bodies, no raw paths",
  );

  return rows.join("\n");
}

function createNextMove({
  result,
  latest,
  habit,
}: {
  result: CoachPromptToolResult;
  latest: BuddySnapshot["latest_prompt"];
  habit: BuddySnapshot["habit"];
}): string {
  if (result.status.status !== "ready") {
    return result.status.next_actions[0] ?? "Run prompt-memory setup.";
  }

  if (latest?.top_gap) {
    return `Fix ${latest.top_gap} before the next submit.`;
  }

  if (habit?.top_gap) {
    return `Practice ${habit.top_gap} across the next few prompts.`;
  }

  return "Keep goal, scope, output format, and verification explicit.";
}

async function runBuddyLoop(options: BuddyCliOptions): Promise<void> {
  const intervalMs =
    Math.max(MIN_BUDDY_INTERVAL_SECONDS, parseInterval(options.interval)) *
    BUDDY_INTERVAL_MS;

  while (true) {
    process.stdout.write("\x1B[2J\x1B[H");
    process.stdout.write(`${renderBuddyForCli({ ...options, once: true })}\n`);
    await setTimeout(intervalMs);
  }
}

function parseInterval(value: string | number | undefined): number {
  if (value === undefined) {
    return DEFAULT_BUDDY_INTERVAL_SECONDS;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_BUDDY_INTERVAL_SECONDS;
}
