import type { Command } from "commander";

import { loadHookAuth, loadPromptMemoryConfig } from "../../config/config.js";
import {
  parseImportSourceType,
  runImportDryRun,
  type ImportDryRunResult,
  type ImportSourceType,
} from "../../importer/dry-run.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import type { ImportJob } from "../../storage/ports.js";

type ImportCliOptions = {
  dataDir?: string;
  dryRun?: boolean;
  file?: string;
  json?: boolean;
  saveJob?: boolean;
  source?: string;
};

type ImportJobCliOptions = {
  dataDir?: string;
  json?: boolean;
};

export function registerImportCommand(program: Command): void {
  program
    .command("import")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--dry-run", "Preview import without writing Markdown or SQLite.")
    .option("--file <path>", "JSONL transcript file to preview.")
    .option("--save-job", "Persist a raw-free dry-run job summary.")
    .option(
      "--source <type>",
      "Import source type: manual-jsonl, claude-transcript-best-effort, codex-transcript-best-effort, official-hook.",
      "manual-jsonl",
    )
    .option("--json", "Print JSON.")
    .action((options: ImportCliOptions) => {
      console.log(importDryRunForCli(options));
    });

  program
    .command("import-job")
    .argument("<id>", "Import job id.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--json", "Print JSON.")
    .action((id: string, options: ImportJobCliOptions) => {
      console.log(showImportJobForCli(id, options));
    });
}

export function importDryRunForCli(options: ImportCliOptions): string {
  if (!options.dryRun) {
    throw new Error("--dry-run is required for import preview.");
  }
  if (!options.file) {
    throw new Error("--file is required for import dry-run.");
  }

  const sourceType = parseImportSourceType(
    options.source ?? "manual-jsonl",
  ) as ImportSourceType;
  const result = runImportDryRun({
    file: options.file,
    redactionMode: options.dataDir
      ? loadPromptMemoryConfig(options.dataDir).redaction_mode
      : "mask",
    sourceType,
  });

  if (!options.saveJob) {
    return options.json
      ? JSON.stringify(result, null, 2)
      : formatDryRunSummary(result);
  }

  const job = withImportStorage(options.dataDir, (storage) =>
    storage.createImportJob({
      source_type: result.source_type,
      source_path_hash: result.source_path_hash,
      dry_run: true,
      status: "dry_run_completed",
      summary: result,
    }),
  );

  return options.json
    ? JSON.stringify({ job_id: job.id, ...result }, null, 2)
    : `${formatDryRunSummary(result)}\njob ${job.id}`;
}

export function showImportJobForCli(
  id: string,
  options: ImportJobCliOptions = {},
): string {
  return withImportStorage(options.dataDir, (storage) => {
    const job = storage.getImportJob(id);

    if (!job) {
      throw new Error(`Import job not found: ${id}`);
    }

    return options.json ? JSON.stringify(job, null, 2) : formatImportJob(job);
  });
}

function formatDryRunSummary(result: ImportDryRunResult): string {
  return [
    `dry-run ${result.source_type}`,
    `records ${result.records_read}`,
    `prompt candidates ${result.prompt_candidates}`,
    `sensitive candidates ${result.sensitive_prompt_count}`,
    `parse errors ${result.parse_errors}`,
    `skipped assistant/tool ${result.skipped_records.assistant_or_tool}`,
    `skipped unsupported ${result.skipped_records.unsupported_record}`,
    `source ${result.source_path_hash}`,
  ].join("\n");
}

function formatImportJob(job: ImportJob): string {
  return [
    `job ${job.id}`,
    `status ${job.status}`,
    `source ${job.source_type}`,
    `source hash ${job.source_path_hash}`,
    `dry-run ${job.dry_run ? "yes" : "no"}`,
    `started ${job.started_at}`,
    job.completed_at ? `completed ${job.completed_at}` : undefined,
    `summary ${JSON.stringify(job.summary)}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function withImportStorage<T>(
  dataDir: string | undefined,
  callback: (storage: ReturnType<typeof createSqlitePromptStorage>) => T,
): T {
  const config = loadPromptMemoryConfig(dataDir);
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
