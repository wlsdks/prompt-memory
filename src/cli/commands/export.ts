import type { Command } from "commander";

import { loadHookAuth, loadPromptMemoryConfig } from "../../config/config.js";
import {
  createAnonymizedExportPreview,
  executeAnonymizedExport,
  parseExportPreset,
} from "../../exporter/anonymized.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";

type ExportCliOptions = {
  anonymized?: boolean;
  dataDir?: string;
  job?: string;
  json?: boolean;
  preset?: string;
  preview?: boolean;
};

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("Preview or run anonymized prompt exports.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--anonymized", "Use the anonymized export path.")
    .option("--preview", "Create a raw-free export preview job.")
    .option("--job <id>", "Execute a previewed export job.")
    .option(
      "--preset <preset>",
      "Export preset: personal_backup, anonymized_review, issue_report_attachment.",
      "personal_backup",
    )
    .option("--json", "Print JSON.")
    .action((options: ExportCliOptions) => {
      console.log(exportForCli(options));
    });
}

export function exportForCli(options: ExportCliOptions): string {
  if (!options.anonymized) {
    throw new Error("--anonymized is required.");
  }

  if (options.preview === Boolean(options.job)) {
    throw new Error("Use exactly one of --preview or --job <id>.");
  }

  return withExportStorage(options.dataDir, (storage, hmacSecret) => {
    if (options.preview) {
      const job = createAnonymizedExportPreview(storage, {
        hmacSecret,
        preset: parseExportPreset(options.preset ?? "personal_backup"),
      });

      return options.json
        ? JSON.stringify(job, null, 2)
        : formatExportPreview(job);
    }

    const payload = executeAnonymizedExport(storage, options.job!, {
      hmacSecret,
    });

    return options.json
      ? JSON.stringify(payload, null, 2)
      : formatExportPayload(payload);
  });
}

function formatExportPreview(
  job: ReturnType<typeof createAnonymizedExportPreview>,
): string {
  return [
    `job ${job.id}`,
    `preset ${job.preset}`,
    `status ${job.status}`,
    `prompts ${job.counts.prompt_count}`,
    `sensitive ${job.counts.sensitive_count}`,
    `small-set-warning ${job.counts.small_set_warning ? "yes" : "no"}`,
    `expires ${job.expires_at}`,
  ].join("\n");
}

function formatExportPayload(
  payload: ReturnType<typeof executeAnonymizedExport>,
): string {
  return JSON.stringify(payload, null, 2);
}

function withExportStorage<T>(
  dataDir: string | undefined,
  callback: (
    storage: ReturnType<typeof createSqlitePromptStorage>,
    hmacSecret: string,
  ) => T,
): T {
  const config = loadPromptMemoryConfig(dataDir);
  const hookAuth = loadHookAuth(dataDir);
  const storage = createSqlitePromptStorage({
    dataDir: config.data_dir,
    hmacSecret: hookAuth.web_session_secret,
  });

  try {
    return callback(storage, hookAuth.web_session_secret);
  } finally {
    storage.close();
  }
}
