import { setTimeout } from "node:timers/promises";
import type { Command } from "commander";

import {
  coachPromptTool,
  type CoachPromptToolResult,
} from "../../mcp/score-tool.js";

type BuddyCliOptions = {
  dataDir?: string;
  interval?: string | number;
  json?: boolean;
  once?: boolean;
};

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
      "--interval <seconds>",
      "Refresh interval for the terminal buddy.",
      "2",
    )
    .action(async (options: BuddyCliOptions) => {
      if (options.json || options.once || !process.stdout.isTTY) {
        console.log(renderBuddyForCli(options));
        return;
      }

      await runBuddyLoop(options);
    });
}

export function renderBuddyForCli(options: BuddyCliOptions = {}): string {
  const snapshot = createBuddySnapshot(options);

  return options.json
    ? JSON.stringify(snapshot, null, 2)
    : formatBuddySnapshot(snapshot);
}

function createBuddySnapshot(options: BuddyCliOptions = {}): BuddySnapshot {
  const result = coachPromptTool(
    {
      include_latest_score: true,
      include_improvement: false,
      include_archive: true,
      include_project_rules: false,
      max_prompts: 200,
      low_score_limit: 3,
    },
    { dataDir: options.dataDir },
  );
  const latest =
    result.latest_score && !("is_error" in result.latest_score)
      ? {
          value: result.latest_score.quality_score.value,
          max: result.latest_score.quality_score.max,
          band: result.latest_score.quality_score.band,
          top_gap: result.latest_score.checklist.find(
            (item) => item.status === "missing" || item.status === "weak",
          )?.label,
          tool: result.status.latest_prompt?.tool,
        }
      : undefined;
  const habit =
    result.archive && !("is_error" in result.archive)
      ? {
          average: result.archive.archive_score.average,
          max: result.archive.archive_score.max,
          band: result.archive.archive_score.band,
          top_gap: result.archive.top_gaps[0]?.label,
        }
      : undefined;

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
  const intervalMs = Math.max(1, parseInterval(options.interval)) * 1000;

  while (true) {
    process.stdout.write("\x1B[2J\x1B[H");
    process.stdout.write(`${renderBuddyForCli({ ...options, once: true })}\n`);
    await setTimeout(intervalMs);
  }
}

function parseInterval(value: string | number | undefined): number {
  if (value === undefined) {
    return 2;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 2;
}
