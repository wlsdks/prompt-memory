import type { Command } from "commander";

import { loadPromptMemoryConfig } from "../../config/config.js";
import {
  parseImportSourceType,
  runImportDryRun,
  type ImportDryRunResult,
  type ImportSourceType,
} from "../../importer/dry-run.js";

type ImportCliOptions = {
  dataDir?: string;
  dryRun?: boolean;
  file?: string;
  json?: boolean;
  source?: string;
};

export function registerImportCommand(program: Command): void {
  program
    .command("import")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--dry-run", "Preview import without writing Markdown or SQLite.")
    .option("--file <path>", "JSONL transcript file to preview.")
    .option(
      "--source <type>",
      "Import source type: manual-jsonl, claude-transcript-best-effort, codex-transcript-best-effort, official-hook.",
      "manual-jsonl",
    )
    .option("--json", "Print JSON.")
    .action((options: ImportCliOptions) => {
      console.log(importDryRunForCli(options));
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

  return options.json
    ? JSON.stringify(result, null, 2)
    : formatDryRunSummary(result);
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
