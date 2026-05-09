import { readFileSync } from "node:fs";
import type { Command } from "commander";

import {
  createArchiveScoreReport,
  type ArchiveScoreOptions,
  type ArchiveScoreReport,
} from "../../analysis/archive-score.js";
import { loadHookAuth, loadPromptCoachConfig } from "../../config/config.js";
import {
  scorePromptTool,
  type ScorePromptToolResult,
} from "../../mcp/score-tool.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import { UserError } from "../user-error.js";

type ScoreCliOptions = {
  dataDir?: string;
  from?: string;
  json?: boolean;
  limit?: string | number;
  lowScoreLimit?: string | number;
  tool?: string;
  to?: string;
  cwdPrefix?: string;
  latest?: boolean;
  text?: string;
  stdin?: boolean;
};

export function registerScoreCommand(program: Command): void {
  program
    .command("score")
    .description(
      "Score the local prompt archive without returning prompt bodies.",
    )
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option("--json", "Print JSON.")
    .option(
      "--text <prompt>",
      "Score this prompt text directly without storing it.",
    )
    .option("--stdin", "Read prompt text from stdin and score it directly.")
    .option("--latest", "Score the latest stored prompt without printing it.")
    .option("--limit <count>", "Maximum number of recent prompts to score.")
    .option(
      "--low-score-limit <count>",
      "Maximum number of low scoring prompts to include.",
    )
    .option("--tool <tool>", "Only score prompts captured from this tool.")
    .option("--cwd-prefix <path>", "Only score prompts from this project/path.")
    .option(
      "--from <iso>",
      "Only score prompts received at or after this time.",
    )
    .option("--to <iso>", "Only score prompts received at or before this time.")
    .action((options: ScoreCliOptions) => {
      console.log(scoreArchiveForCli(options));
    });
}

export function scoreArchiveForCli(options: ScoreCliOptions = {}): string {
  if (options.text !== undefined || options.stdin) {
    const prompt = readScorePromptInput(options);
    const result = scorePromptTool(
      { prompt, include_suggestions: true },
      { dataDir: options.dataDir },
    );

    return options.json
      ? JSON.stringify(result, null, 2)
      : formatPromptScore(result, "Prompt score");
  }

  if (options.latest) {
    const result = scorePromptTool(
      { latest: true, include_suggestions: true },
      { dataDir: options.dataDir },
    );

    return options.json
      ? JSON.stringify(result, null, 2)
      : formatPromptScore(result, "Latest prompt score");
  }

  return withStorage(options.dataDir, (storage) => {
    const report = createArchiveScoreReport(storage, toScoreOptions(options));

    return options.json
      ? JSON.stringify(report, null, 2)
      : formatArchiveScoreReport(report);
  });
}

function readScorePromptInput(options: ScoreCliOptions): string {
  const raw =
    options.text !== undefined
      ? options.text
      : options.stdin
        ? readFileSync(0, "utf8")
        : undefined;

  if (raw === undefined) {
    throw new UserError(
      '--text or --stdin is required to score text directly. Try: prompt-coach score --text "add caching to fetchUser"',
    );
  }

  if (!raw.trim()) {
    throw new UserError(
      'Prompt must not be empty. Try: prompt-coach score --text "add caching to fetchUser"',
    );
  }

  return raw;
}

function formatPromptScore(
  result: ScorePromptToolResult,
  heading: string,
): string {
  if ("is_error" in result) {
    return [
      heading,
      `error ${result.error_code}: ${result.message}`,
      "",
      "Tip: pass --text or --stdin to score text directly without storing it.",
      "",
      "Privacy: local-only, no external calls, no prompt body.",
    ].join("\n");
  }

  const checklistRows = result.checklist.map((item) => {
    const points = `${item.earned}/${item.weight}`;
    const suggestion = item.suggestion ? ` — ${item.suggestion}` : "";
    return `- ${item.label} [${item.status}] ${points}${suggestion}`;
  });

  return [
    heading,
    `${result.quality_score.value}/${result.quality_score.max} (${result.quality_score.band})`,
    ...(result.redaction_notice ? [`Notice: ${result.redaction_notice}`] : []),
    "",
    "Checklist",
    ...checklistRows,
    "",
    "Privacy: local-only, no external calls, no prompt body.",
  ].join("\n");
}

function toScoreOptions(options: ScoreCliOptions): ArchiveScoreOptions {
  return {
    maxPrompts: parseCount(options.limit),
    lowScoreLimit: parseCount(options.lowScoreLimit),
    tool: options.tool,
    cwdPrefix: options.cwdPrefix,
    receivedFrom: options.from,
    receivedTo: options.to,
  };
}

function withStorage<T>(
  dataDir: string | undefined,
  callback: (storage: ReturnType<typeof createSqlitePromptStorage>) => T,
): T {
  const config = loadPromptCoachConfig(dataDir);
  const hookAuth = loadHookAuth(dataDir);
  const storage = createSqlitePromptStorage({
    dataDir: config.data_dir,
    hmacSecret: hookAuth.web_session_secret,
  });

  try {
    return callback(storage);
  } finally {
    storage.close();
  }
}

function formatArchiveScoreReport(report: ArchiveScoreReport): string {
  const lowScoreRows =
    report.low_score_prompts.length > 0
      ? report.low_score_prompts.map(
          (prompt) =>
            `- ${prompt.id} ${prompt.tool}/${prompt.project} ${prompt.quality_score}/${report.archive_score.max} ${prompt.quality_score_band} gaps: ${prompt.quality_gaps.join(", ") || "none"}`,
        )
      : ["- none"];
  const gapRows =
    report.top_gaps.length > 0
      ? report.top_gaps.map(
          (gap) =>
            `- ${gap.label}: ${gap.count} (${Math.round(gap.rate * 100)}%)`,
        )
      : ["- none"];
  const practiceRows =
    report.practice_plan.length > 0
      ? report.practice_plan.map(
          (item) =>
            `- ${item.priority}. ${item.label}: ${item.prompt_rule} (${item.reason})`,
        )
      : ["- none"];

  const lines = [
    "Prompt archive score",
    `average ${report.archive_score.average}/${report.archive_score.max} (${report.archive_score.band})`,
    `scored ${report.archive_score.scored_prompts} prompts${report.has_more ? " (more available)" : ""}`,
    `distribution excellent ${report.distribution.excellent}, good ${report.distribution.good}, needs_work ${report.distribution.needs_work}, weak ${report.distribution.weak}`,
    "",
    "Top quality gaps",
    ...gapRows,
    "",
    "Practice plan",
    ...practiceRows,
    "",
    "Next prompt template",
    report.next_prompt_template,
    "",
    "Lowest scoring prompts",
    ...lowScoreRows,
  ];

  if (report.archive_score.scored_prompts === 0) {
    lines.push(
      "",
      "No prompts captured yet. Run prompt-coach start to see the shortest setup -> real prompt -> score path.",
    );
  }

  lines.push(
    "",
    "Privacy: local-only, no external calls, no prompt bodies, no raw paths.",
  );

  return lines.join("\n");
}

function parseCount(value: string | number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
