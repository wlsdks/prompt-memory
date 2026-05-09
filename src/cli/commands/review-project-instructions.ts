import type { Command } from "commander";

import {
  reviewProjectInstructionsTool,
  type ReviewProjectInstructionsToolResult,
} from "../../mcp/score-tool.js";

type ReviewProjectInstructionsCliOptions = {
  dataDir?: string;
  json?: boolean;
  projectId?: string;
  noAnalyze?: boolean;
};

export function registerReviewProjectInstructionsCommand(
  program: Command,
): void {
  program
    .command("review-project-instructions")
    .description(
      "Review the captured project's AGENTS.md / CLAUDE.md instructions and surface gaps.",
    )
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option(
      "--project-id <id>",
      "Review the project with this proj_<hash> id. Defaults to the latest captured project.",
    )
    .option(
      "--no-analyze",
      "Reuse the cached review instead of re-analyzing the files now.",
    )
    .option("--json", "Print JSON.")
    .action((options: ReviewProjectInstructionsCliOptions) => {
      console.log(reviewProjectInstructionsForCli(options));
    });
}

export function reviewProjectInstructionsForCli(
  options: ReviewProjectInstructionsCliOptions = {},
): string {
  const result = reviewProjectInstructionsTool(
    {
      project_id: options.projectId,
      latest: options.projectId ? undefined : true,
      analyze: options.noAnalyze ? false : true,
      include_suggestions: true,
    },
    { dataDir: options.dataDir },
  );

  if (options.json) {
    return JSON.stringify(result, null, 2);
  }
  return formatReview(result);
}

function formatReview(result: ReviewProjectInstructionsToolResult): string {
  if ("is_error" in result) {
    return [
      "Project instruction review",
      `error ${result.error_code}: ${result.message}`,
      "",
      "Privacy: local-only, no external calls, no instruction file bodies.",
    ].join("\n");
  }

  const review = result.review;
  const checklistRows = review.checklist.map((item) => {
    const status = `[${item.status}]`;
    const points = `${item.earned}/${item.weight}`;
    const suggestion = item.suggestion ? ` — ${item.suggestion}` : "";
    return `- ${item.label} ${status} ${points}${suggestion}`;
  });
  const suggestionRows = (result.suggestions ?? review.suggestions).map(
    (suggestion) => `- ${suggestion}`,
  );

  const lines = [
    "Project instruction review",
    `${review.score.value}/${review.score.max} (${review.score.band})`,
    `project: ${result.project_label} (${result.project_id})`,
    `files_found: ${review.files_found}`,
    `analyzer: ${review.analyzer}`,
    "",
    "Checklist",
    ...checklistRows,
  ];

  if (suggestionRows.length > 0) {
    lines.push("", "Suggestions", ...suggestionRows);
  }

  lines.push(
    "",
    `Next action: ${result.next_action}`,
    "",
    "Privacy: local-only, no external calls, no instruction file bodies.",
  );

  return lines.join("\n");
}
