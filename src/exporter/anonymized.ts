import { createHmac } from "node:crypto";

import { detectSensitiveValues } from "../redaction/detectors.js";
import type {
  ExportJob,
  ExportJobStoragePort,
  ExportPreset,
  ProjectPolicyStoragePort,
  PromptDetail,
  PromptReadStoragePort,
} from "../storage/ports.js";

export const EXPORT_PRESETS = [
  "personal_backup",
  "anonymized_review",
  "issue_report_attachment",
] as const satisfies ExportPreset[];

const INCLUDED_FIELDS = [
  "masked_prompt",
  "tags",
  "quality_gaps",
  "tool",
  "coarse_date",
  "project_alias",
];

const EXCLUDED_FIELDS = [
  "cwd",
  "project_root",
  "transcript_path",
  "raw_metadata",
  "stable_prompt_id",
  "exact_timestamp",
];

const REDACTION_VERSION = "mask-v1";

export type AnonymizedExportStorage = PromptReadStoragePort &
  ExportJobStoragePort &
  Partial<ProjectPolicyStoragePort>;

export type AnonymizedExportOptions = {
  hmacSecret: string;
  preset?: ExportPreset;
  now?: Date;
};

export type AnonymizedExportPayload = {
  job_id: string;
  preset: ExportPreset;
  redaction_version: string;
  generated_at: string;
  count: number;
  items: AnonymizedExportItem[];
};

export type AnonymizedExportItem = {
  anonymous_id: string;
  tool: string;
  coarse_date: string;
  project_alias: string;
  prompt: string;
  tags: string[];
  quality_gaps: string[];
};

export function parseExportPreset(value: string): ExportPreset {
  if ((EXPORT_PRESETS as readonly string[]).includes(value)) {
    return value as ExportPreset;
  }

  throw new Error(
    `Unsupported export preset: ${value}. Valid presets: ${EXPORT_PRESETS.join(", ")}.`,
  );
}

export function createAnonymizedExportPreview(
  storage: AnonymizedExportStorage,
  options: AnonymizedExportOptions,
): ExportJob {
  const now = options.now ?? new Date();
  const promptDetails = collectExportablePrompts(storage);
  const promptIdHashes = promptDetails.map((detail) =>
    createPromptHash(detail.id, options.hmacSecret),
  );
  const projectPolicyVersions = collectProjectPolicyVersions(
    storage,
    promptDetails,
    options.hmacSecret,
  );
  const residualIdentifierCounts = countResidualIdentifiers(
    promptDetails
      .map((detail) => anonymizePromptText(detail.markdown))
      .join("\n"),
  );

  return storage.createExportJob({
    preset: options.preset ?? "personal_backup",
    status: "previewed",
    prompt_id_hashes: promptIdHashes,
    project_policy_versions: projectPolicyVersions,
    redaction_version: REDACTION_VERSION,
    counts: {
      prompt_count: promptDetails.length,
      sensitive_count: promptDetails.filter((detail) => detail.is_sensitive)
        .length,
      included_fields: INCLUDED_FIELDS,
      excluded_fields: EXCLUDED_FIELDS,
      residual_identifier_counts: residualIdentifierCounts,
      small_set_warning: promptDetails.length > 0 && promptDetails.length < 5,
    },
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  });
}

export function executeAnonymizedExport(
  storage: AnonymizedExportStorage,
  jobId: string,
  options: AnonymizedExportOptions,
): AnonymizedExportPayload {
  const now = options.now ?? new Date();
  const job = storage.getExportJob(jobId);

  if (!job) {
    throw new Error(`Export job not found: ${jobId}`);
  }

  if (
    job.status !== "previewed" ||
    Date.parse(job.expires_at) <= now.getTime()
  ) {
    storage.updateExportJobStatus(job.id, "invalid");
    throw new Error("Export job is no longer valid. Create a new preview.");
  }

  const currentPromptDetails = collectExportablePrompts(storage);
  const currentPromptIdHashes = currentPromptDetails.map((detail) =>
    createPromptHash(detail.id, options.hmacSecret),
  );
  const currentProjectPolicyVersions = collectProjectPolicyVersions(
    storage,
    currentPromptDetails,
    options.hmacSecret,
  );

  validateExportPreviewSnapshot(storage, job, {
    promptIdHashes: currentPromptIdHashes,
    projectPolicyVersions: currentProjectPolicyVersions,
    promptCount: currentPromptDetails.length,
    sensitiveCount: currentPromptDetails.filter((detail) => detail.is_sensitive)
      .length,
  });

  storage.updateExportJobStatus(job.id, "completed");

  return {
    job_id: job.id,
    preset: job.preset,
    redaction_version: job.redaction_version,
    generated_at: now.toISOString(),
    count: currentPromptDetails.length,
    items: currentPromptDetails.map((detail) => ({
      anonymous_id: `anon_${createPromptHash(detail.id, options.hmacSecret).slice(3, 19)}`,
      tool: detail.tool,
      coarse_date: detail.received_at.slice(0, 10),
      project_alias: projectAlias(storage, detail.cwd, options.hmacSecret),
      prompt: anonymizePromptText(detail.markdown),
      tags: detail.tags,
      quality_gaps: detail.quality_gaps,
    })),
  };
}

function validateExportPreviewSnapshot(
  storage: AnonymizedExportStorage,
  job: ExportJob,
  current: {
    promptIdHashes: string[];
    projectPolicyVersions: Record<string, number>;
    promptCount: number;
    sensitiveCount: number;
  },
): void {
  const valid =
    job.redaction_version === REDACTION_VERSION &&
    sameStringArray(job.prompt_id_hashes, current.promptIdHashes) &&
    sameNumberRecord(
      job.project_policy_versions,
      current.projectPolicyVersions,
    ) &&
    job.counts.prompt_count === current.promptCount &&
    job.counts.sensitive_count === current.sensitiveCount;

  if (!valid) {
    storage.updateExportJobStatus(job.id, "invalid");
    throw new Error("Export job is no longer valid. Create a new preview.");
  }
}

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameNumberRecord(
  left: Record<string, number>,
  right: Record<string, number>,
): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const rightEntries = Object.entries(right).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      ([key, value], index) =>
        key === rightEntries[index]?.[0] && value === rightEntries[index]?.[1],
    )
  );
}

function collectExportablePrompts(
  storage: AnonymizedExportStorage,
): PromptDetail[] {
  const details: PromptDetail[] = [];
  let cursor: string | undefined;

  do {
    const page = storage.listPrompts({ limit: 100, cursor });
    for (const item of page.items) {
      const detail = storage.getPrompt(item.id);
      if (!detail || isExportDisabled(storage, detail)) {
        continue;
      }
      details.push(detail);
    }
    cursor = page.nextCursor;
  } while (cursor);

  return details.sort(
    (a, b) =>
      b.received_at.localeCompare(a.received_at) || a.id.localeCompare(b.id),
  );
}

function isExportDisabled(
  storage: AnonymizedExportStorage,
  detail: PromptDetail,
): boolean {
  if (!storage.getProjectPolicyForEvent) {
    return false;
  }

  return (
    storage.getProjectPolicyForEvent({ cwd: detail.cwd })?.export_disabled ===
    true
  );
}

function collectProjectPolicyVersions(
  storage: AnonymizedExportStorage,
  details: PromptDetail[],
  hmacSecret: string,
): Record<string, number> {
  const versions: Record<string, number> = {};

  for (const detail of details) {
    const projectId = createProjectKey(detail.cwd, hmacSecret);
    versions[projectId] =
      storage.getProjectPolicyForEvent?.({ cwd: detail.cwd })?.version ?? 1;
  }

  return versions;
}

function countResidualIdentifiers(text: string): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const finding of detectSensitiveValues(text)) {
    counts[finding.detector_type] = (counts[finding.detector_type] ?? 0) + 1;
  }

  for (const [type, pattern] of Object.entries(ANONYMIZATION_PATTERNS)) {
    const count = [...text.matchAll(pattern)].length;
    if (count > 0) {
      counts[type] = (counts[type] ?? 0) + count;
    }
  }

  return counts;
}

function anonymizePromptText(value: string): string {
  let result = value;

  for (const [type, pattern] of Object.entries(ANONYMIZATION_PATTERNS)) {
    result =
      type === "path"
        ? result.replace(
            pattern,
            (_match, prefix: string) => `${prefix}[REDACTED:path]`,
          )
        : result.replace(pattern, `[REDACTED:${type}]`);
  }

  return result;
}

const ANONYMIZATION_PATTERNS: Record<string, RegExp> = {
  url: /https?:\/\/[^\s)'"`]+/gi,
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  path: /(^|[\s('"`])\/(?:Users|home|private|tmp|var|opt|workspace|Volumes)\/[^\s)'"`]+/gi,
  repo_slug: /\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b/g,
};

function createPromptHash(promptId: string, hmacSecret: string): string {
  return `ph_${createHmac("sha256", hmacSecret)
    .update(promptId)
    .digest("hex")
    .slice(0, 32)}`;
}

function createProjectKey(sourcePath: string, hmacSecret: string): string {
  return `proj_${createHmac("sha256", hmacSecret)
    .update(sourcePath)
    .digest("hex")
    .slice(0, 24)}`;
}

function projectAlias(
  storage: AnonymizedExportStorage,
  cwd: string,
  hmacSecret: string,
): string {
  const projectId = createProjectKey(cwd, hmacSecret);
  const project = storage
    .listProjects?.()
    .items.find((item) => item.project_id === projectId);

  return project?.label ?? projectLabel(cwd);
}

function projectLabel(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.split("/").at(-1) || trimmed || "unknown";
}
