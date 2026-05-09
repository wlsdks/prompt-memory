import type { Command } from "commander";

import { loadHookAuth, loadPromptCoachConfig } from "../../config/config.js";
import { createProjectKey } from "../../storage/project-id.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import type {
  ProjectPolicyPatch,
  ProjectSummary,
} from "../../storage/ports.js";
import { UserError } from "../user-error.js";

type ProjectListCliOptions = {
  dataDir?: string;
  json?: boolean;
};

type ProjectShowCliOptions = ProjectListCliOptions & {
  cwd: string;
};

type ProjectSetCliOptions = ProjectShowCliOptions & {
  alias?: string;
  captureDisabled?: boolean;
  analysisDisabled?: boolean;
  retentionDays?: string;
  externalAnalysisOptIn?: boolean;
  exportDisabled?: boolean;
  dryRun?: boolean;
};

export function registerProjectCommand(program: Command): void {
  const project = program
    .command("project")
    .description("Manage local project policies (capture, retention, export).");

  project
    .command("list")
    .description("List captured projects with policy summary.")
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option("--json", "Print JSON.")
    .action((options: ProjectListCliOptions) => {
      console.log(listProjectsForCli(options));
    });

  project
    .command("show <cwd>")
    .description("Show the project policy for the given working directory.")
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option("--json", "Print JSON.")
    .action((cwd: string, options: ProjectListCliOptions) => {
      console.log(showProjectForCli({ ...options, cwd }));
    });

  project
    .command("set <cwd>")
    .description(
      "Update the project policy for the given working directory (capture, retention, etc.).",
    )
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option("--alias <name>", "Human-readable label for the project.")
    .option("--capture-disabled", "Stop capturing prompts from this project.")
    .option(
      "--no-capture-disabled",
      "Resume capturing prompts from this project.",
    )
    .option(
      "--analysis-disabled",
      "Skip local analysis (scoring/improvement) for this project.",
    )
    .option("--no-analysis-disabled", "Resume local analysis for this project.")
    .option(
      "--retention-days <days>",
      "Auto-retention window in days. Pass 0 to clear.",
    )
    .option(
      "--external-analysis-opt-in",
      "Allow gated external LLM analysis for this project.",
    )
    .option(
      "--no-external-analysis-opt-in",
      "Disallow external LLM analysis for this project.",
    )
    .option(
      "--export-disabled",
      "Exclude this project from anonymized exports.",
    )
    .option(
      "--no-export-disabled",
      "Include this project in anonymized exports again.",
    )
    .option("--dry-run", "Print the patch without writing to storage.")
    .option("--json", "Print JSON.")
    .action((cwd: string, options: Omit<ProjectSetCliOptions, "cwd">) => {
      console.log(setProjectPolicyForCli({ ...options, cwd }));
    });
}

export function listProjectsForCli(
  options: ProjectListCliOptions = {},
): string {
  return withProjectStorage(options.dataDir, ({ storage }) => {
    const result = storage.listProjects();
    if (options.json) {
      return JSON.stringify(result, null, 2);
    }
    if (result.items.length === 0) {
      return [
        "No projects captured yet.",
        "Capture at least one prompt from a Claude Code or Codex session, then rerun this command.",
      ].join("\n");
    }
    const rows = result.items.map((item) => formatProjectRow(item));
    return ["Projects", ...rows].join("\n");
  });
}

export function showProjectForCli(options: ProjectShowCliOptions): string {
  return withProjectStorage(options.dataDir, ({ storage, hmacSecret }) => {
    const projectId = createProjectKey(options.cwd, hmacSecret);
    const summary = storage
      .listProjects()
      .items.find((item) => item.project_id === projectId);

    if (!summary) {
      throw new UserError(
        `No captured project matches cwd "${options.cwd}". Capture at least one prompt from this directory first, or run prompt-coach project list to see known projects.`,
      );
    }

    if (options.json) {
      return JSON.stringify(summary, null, 2);
    }
    return formatProjectDetail(summary);
  });
}

export function setProjectPolicyForCli(options: ProjectSetCliOptions): string {
  const patch: ProjectPolicyPatch = {};
  if (options.alias !== undefined) patch.alias = options.alias;
  if (options.captureDisabled !== undefined)
    patch.capture_disabled = options.captureDisabled;
  if (options.analysisDisabled !== undefined)
    patch.analysis_disabled = options.analysisDisabled;
  if (options.externalAnalysisOptIn !== undefined)
    patch.external_analysis_opt_in = options.externalAnalysisOptIn;
  if (options.exportDisabled !== undefined)
    patch.export_disabled = options.exportDisabled;
  if (options.retentionDays !== undefined) {
    const parsed = Number.parseInt(options.retentionDays, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new UserError(
        `--retention-days must be a non-negative integer (got "${options.retentionDays}"). Use 0 to clear the retention window.`,
      );
    }
    patch.retention_candidate_days = parsed === 0 ? null : parsed;
  }

  if (Object.keys(patch).length === 0) {
    throw new UserError(
      "Provide at least one policy flag. Try --capture-disabled, --analysis-disabled, --retention-days <n>, --external-analysis-opt-in, --export-disabled, or --alias <text>.",
    );
  }

  return withProjectStorage(options.dataDir, ({ storage, hmacSecret }) => {
    const projectId = createProjectKey(options.cwd, hmacSecret);

    if (options.dryRun) {
      const dryRun = { project_id: projectId, dry_run: true, patch };
      return options.json
        ? JSON.stringify(dryRun, null, 2)
        : formatDryRun(dryRun);
    }

    const updated = storage.updateProjectPolicy(projectId, patch, "cli");
    if (!updated) {
      throw new UserError(
        `Project policy update did not match a captured project. Capture at least one prompt from cwd "${options.cwd}" first.`,
      );
    }

    if (options.json) {
      return JSON.stringify(updated, null, 2);
    }
    return ["Project policy updated", formatProjectDetail(updated)].join("\n");
  });
}

function formatProjectRow(summary: ProjectSummary): string {
  const policy = summary.policy;
  const flags: string[] = [];
  if (policy.capture_disabled) flags.push("capture_disabled");
  if (policy.analysis_disabled) flags.push("analysis_disabled");
  if (policy.export_disabled) flags.push("export_disabled");
  if (policy.external_analysis_opt_in) flags.push("external_analysis_opt_in");
  const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
  return `- ${summary.project_id} ${summary.alias ?? summary.label} prompts=${summary.prompt_count}${flagStr}`;
}

function formatProjectDetail(summary: ProjectSummary): string {
  const policy = summary.policy;
  const lines = [
    `project_id: ${summary.project_id}`,
    `label: ${summary.label}`,
    `alias: ${summary.alias ?? "(none)"}`,
    `prompt_count: ${summary.prompt_count}`,
    `capture_disabled: ${policy.capture_disabled ? "yes" : "no"}`,
    `analysis_disabled: ${policy.analysis_disabled ? "yes" : "no"}`,
    `external_analysis_opt_in: ${policy.external_analysis_opt_in ? "yes" : "no"}`,
    `export_disabled: ${policy.export_disabled ? "yes" : "no"}`,
    `retention_candidate_days: ${policy.retention_candidate_days ?? "not set"}`,
    `policy_version: ${policy.version}`,
  ];
  return lines.join("\n");
}

function formatDryRun(dryRun: {
  project_id: string;
  dry_run: boolean;
  patch: ProjectPolicyPatch;
}): string {
  const lines = [
    "dry-run: project policy patch",
    `project_id: ${dryRun.project_id}`,
    "patch:",
  ];
  for (const [key, value] of Object.entries(dryRun.patch)) {
    lines.push(`  ${key}: ${JSON.stringify(value)}`);
  }
  return lines.join("\n");
}

function withProjectStorage<T>(
  dataDir: string | undefined,
  callback: (context: {
    storage: ReturnType<typeof createSqlitePromptStorage>;
    hmacSecret: string;
  }) => T,
): T {
  const config = loadPromptCoachConfig(dataDir);
  const hookAuth = loadHookAuth(dataDir);
  const storage = createSqlitePromptStorage({
    dataDir: config.data_dir,
    hmacSecret: hookAuth.web_session_secret,
  });
  try {
    return callback({ storage, hmacSecret: hookAuth.web_session_secret });
  } finally {
    storage.close();
  }
}
