import { createHash } from "node:crypto";

import { redactPrompt } from "../redaction/redact.js";
import type {
  NormalizedPromptEvent,
  RedactionPolicy,
} from "../shared/schema.js";
import type {
  ImportJob,
  ImportJobStoragePort,
  ProjectPolicyStoragePort,
  PromptStoragePort,
} from "../storage/ports.js";
import {
  scanImportSource,
  type ImportCandidate,
  type ImportSourceType,
} from "./dry-run.js";

export type ImportExecuteOptions = {
  file: string;
  sourceType: ImportSourceType;
  redactionMode: RedactionPolicy;
  defaultCwd: string;
  resumeJobId?: string;
  now?: () => Date;
};

export type ImportExecuteResult = {
  job_id: string;
  status: "completed";
  imported_count: number;
  duplicate_count: number;
  skipped_count: number;
  error_count: number;
  source_type: ImportSourceType;
  source_path_hash: string;
};

export type ImportExecutionStorage = PromptStoragePort &
  ImportJobStoragePort &
  Partial<ProjectPolicyStoragePort>;

export async function executeImport(
  storage: ImportExecutionStorage,
  options: ImportExecuteOptions,
): Promise<ImportExecuteResult> {
  const scan = scanImportSource(options);
  const existingJob = options.resumeJobId
    ? storage.getImportJob(options.resumeJobId)
    : undefined;

  if (options.resumeJobId && !existingJob) {
    throw new Error(
      `Import job not found: ${options.resumeJobId}. Run prompt-memory import-job <id> to confirm the saved job, or rerun --dry-run --save-job to start a new one.`,
    );
  }
  if (
    existingJob &&
    existingJob.source_path_hash !== scan.summary.source_path_hash
  ) {
    throw new Error(
      "Import source does not match saved job. Use the same --file path that produced the dry-run, or rerun --dry-run --save-job for the new file.",
    );
  }
  if (existingJob && existingJob.source_type !== scan.summary.source_type) {
    throw new Error(
      `Import source type does not match saved job. The saved job was --source ${existingJob.source_type}; pass the same value.`,
    );
  }
  if (existingJob?.status === "completed") {
    return toExecuteResult(existingJob);
  }

  const job =
    existingJob ??
    storage.createImportJob({
      source_type: scan.summary.source_type,
      source_path_hash: scan.summary.source_path_hash,
      dry_run: false,
      status: "running",
      summary: scan.summary,
    });
  const processed = new Set(
    storage.listImportRecords(job.id).map((record) => record.record_key),
  );
  const result: ImportExecuteResult = {
    job_id: job.id,
    status: "completed",
    imported_count: 0,
    duplicate_count: 0,
    skipped_count:
      scan.summary.skipped_records.assistant_or_tool +
      scan.summary.skipped_records.empty_prompt +
      scan.summary.skipped_records.unsupported_record +
      scan.summary.skipped_records.too_large +
      scan.summary.parse_errors,
    error_count: 0,
    source_type: scan.summary.source_type,
    source_path_hash: scan.summary.source_path_hash,
  };

  for (const candidate of scan.candidates) {
    if (processed.has(candidate.record_key)) {
      continue;
    }

    try {
      const event = toImportedPromptEvent(candidate, options, job);
      if (
        storage.getProjectPolicyForEvent?.({
          cwd: event.cwd,
          project_root: event.project_root,
        })?.capture_disabled
      ) {
        result.skipped_count += 1;
        storage.createImportRecord({
          job_id: job.id,
          record_key: candidate.record_key,
          record_offset: candidate.record_offset,
          status: "skipped",
          error_code: "project_capture_disabled",
        });
        continue;
      }

      const redaction = redactPrompt(event.prompt, options.redactionMode);
      const stored = await storage.storePrompt({ event, redaction });
      storage.createImportRecord({
        job_id: job.id,
        record_key: candidate.record_key,
        record_offset: candidate.record_offset,
        status: stored.duplicate ? "duplicate" : "imported",
        prompt_id: stored.id,
      });

      if (stored.duplicate) {
        result.duplicate_count += 1;
      } else {
        result.imported_count += 1;
      }
    } catch {
      result.error_count += 1;
      storage.createImportRecord({
        job_id: job.id,
        record_key: candidate.record_key,
        record_offset: candidate.record_offset,
        status: "error",
        error_code: "store_failed",
      });
    }
  }

  const completed = storage.completeImportJob(job.id, "completed", result);
  return completed ? toExecuteResult(completed) : result;
}

function toImportedPromptEvent(
  candidate: ImportCandidate,
  options: ImportExecuteOptions,
  job: ImportJob,
): NormalizedPromptEvent {
  const now = options.now?.() ?? new Date();
  const tool = toolForSource(options.sourceType);

  return {
    tool,
    source_event: "TranscriptImport",
    prompt: candidate.prompt,
    session_id: candidate.session_id ?? `import:${job.id}`,
    cwd: candidate.cwd ?? options.defaultCwd,
    created_at: now.toISOString(),
    received_at: now.toISOString(),
    idempotency_key: `import:${job.source_path_hash}:${candidate.record_key}`,
    adapter_version: `import-${options.sourceType}-v1`,
    schema_version: 1,
    turn_id: candidate.turn_id,
    raw_event_hash: hashValue(
      `${candidate.record_key}:${candidate.prompt.length}`,
    ),
  };
}

function toolForSource(
  sourceType: ImportSourceType,
): NormalizedPromptEvent["tool"] {
  if (sourceType === "claude-transcript-best-effort") {
    return "claude-code";
  }
  if (sourceType === "codex-transcript-best-effort") {
    return "codex";
  }

  return "manual";
}

function toExecuteResult(job: ImportJob): ImportExecuteResult {
  const summary = isExecuteResult(job.summary)
    ? job.summary
    : {
        job_id: job.id,
        status: "completed" as const,
        imported_count: 0,
        duplicate_count: 0,
        skipped_count: 0,
        error_count: 0,
        source_type: job.source_type as ImportSourceType,
        source_path_hash: job.source_path_hash,
      };

  return summary;
}

function isExecuteResult(value: unknown): value is ImportExecuteResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "job_id" in value &&
    "imported_count" in value &&
    "source_path_hash" in value
  );
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}
