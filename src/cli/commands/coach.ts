import type { Command } from "commander";

import {
  coachPromptTool,
  type CoachPromptToolResult,
} from "../../mcp/score-tool.js";

type CoachCliOptions = {
  dataDir?: string;
  json?: boolean;
  noArchive?: boolean;
  noImprovement?: boolean;
  noProjectRules?: boolean;
  noLatestScore?: boolean;
  limit?: string | number;
  lowScoreLimit?: string | number;
};

export function registerCoachCommand(program: Command): void {
  program
    .command("coach")
    .description("Run the one-call agent prompt coach workflow.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--json", "Print JSON.")
    .option("--no-latest-score", "Skip latest prompt scoring.")
    .option("--no-improvement", "Skip latest prompt rewrite.")
    .option("--no-archive", "Skip recent habit review.")
    .option("--no-project-rules", "Skip AGENTS.md/CLAUDE.md review.")
    .option("--limit <count>", "Maximum number of recent prompts to score.")
    .option(
      "--low-score-limit <count>",
      "Maximum number of low scoring prompts to include.",
    )
    .action((options: CoachCliOptions) => {
      console.log(coachPromptForCli(options));
    });
}

export function coachPromptForCli(options: CoachCliOptions = {}): string {
  const result = coachPromptTool(
    {
      include_latest_score: options.noLatestScore !== true,
      include_improvement: options.noImprovement !== true,
      include_archive: options.noArchive !== true,
      include_project_rules: options.noProjectRules !== true,
      max_prompts: parseCount(options.limit),
      low_score_limit: parseCount(options.lowScoreLimit),
    },
    { dataDir: options.dataDir },
  );

  return options.json ? JSON.stringify(result, null, 2) : formatCoach(result);
}

function formatCoach(result: CoachPromptToolResult): string {
  const rows = [
    "Prompt Memory Coach",
    result.agent_brief.headline,
    result.agent_brief.summary,
    "",
    `Status: ${result.status.status} (${result.status.total_prompts} prompts)`,
  ];

  if (result.latest_score && !("is_error" in result.latest_score)) {
    rows.push(
      `Latest prompt: ${result.latest_score.quality_score.value}/${result.latest_score.quality_score.max} ${result.latest_score.quality_score.band}`,
    );
  }

  if (result.archive && !("is_error" in result.archive)) {
    const topGap = result.archive.top_gaps[0];
    rows.push(
      `Archive: ${result.archive.archive_score.average}/${result.archive.archive_score.max} ${result.archive.archive_score.band}`,
    );
    if (topGap) {
      rows.push(`Top gap: ${topGap.label} (${topGap.count})`);
    }
  }

  if (result.project_rules && !("is_error" in result.project_rules)) {
    rows.push(
      `Rules: ${result.project_rules.review.score.value}/${result.project_rules.review.score.max} ${result.project_rules.review.score.band}`,
    );
  }

  rows.push(
    "",
    "Next actions",
    ...result.agent_brief.next_actions.map((action) => `- ${action}`),
    "",
    "Suggested response",
    result.agent_brief.suggested_user_response,
    "",
    "Privacy: local-only, no external calls, no prompt bodies, no raw paths, no auto-submit.",
  );

  return rows.join("\n");
}

function parseCount(value: string | number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
