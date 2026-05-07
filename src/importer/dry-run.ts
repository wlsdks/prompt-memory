import { realpathSync, readFileSync, statSync } from "node:fs";

import { redactPrompt } from "../redaction/redact.js";
import type { RedactionPolicy } from "../shared/schema.js";
import { projectLabel } from "../storage/project-label.js";

export const IMPORT_SOURCE_TYPES = [
  "official-hook",
  "claude-transcript-best-effort",
  "codex-transcript-best-effort",
  "manual-jsonl",
] as const;

export type ImportSourceType = (typeof IMPORT_SOURCE_TYPES)[number];

export type ImportDryRunOptions = {
  file: string;
  sourceType: ImportSourceType;
  redactionMode: RedactionPolicy;
  maxFileBytes?: number;
  maxLineBytes?: number;
  sampleLimit?: number;
};

export type ImportDryRunResult = {
  dry_run: true;
  source_type: ImportSourceType;
  source_path_hash: string;
  records_read: number;
  prompt_candidates: number;
  sensitive_prompt_count: number;
  parse_errors: number;
  skipped_records: {
    assistant_or_tool: number;
    empty_prompt: number;
    unsupported_record: number;
    too_large: number;
  };
  samples: ImportDryRunSample[];
};

export type ImportDryRunSample = {
  record_offset: number;
  session_id?: string;
  turn_id?: string;
  cwd_label?: string;
  prompt_preview: string;
  is_sensitive: boolean;
};

export type ImportCandidate = {
  record_key: string;
  record_offset: number;
  prompt: string;
  session_id?: string;
  turn_id?: string;
  cwd?: string;
};

type PromptCandidate = {
  prompt: string;
  sessionId?: string;
  turnId?: string;
  cwd?: string;
};

export type ImportSourceScanResult = {
  summary: ImportDryRunResult;
  candidates: ImportCandidate[];
};

type SkipReason =
  | "assistant_or_tool"
  | "empty_prompt"
  | "unsupported_record"
  | "too_large";

const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_LINE_BYTES = 256 * 1024;

export function runImportDryRun(
  options: ImportDryRunOptions,
): ImportDryRunResult {
  return scanImportSource(options).summary;
}

export function scanImportSource(
  options: ImportDryRunOptions,
): ImportSourceScanResult {
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxLineBytes = options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES;
  const sampleLimit = options.sampleLimit ?? 5;
  let sourcePath: string;
  try {
    sourcePath = realpathSync(options.file);
  } catch {
    throw new Error(
      "Import source file not found. Pass an existing JSONL transcript path with --file <path>.",
    );
  }
  const stat = statSync(sourcePath);

  if (!stat.isFile()) {
    throw new Error(
      "Import source must be a file. Pass a single .jsonl transcript path with --file <path>.",
    );
  }
  if (stat.size > maxFileBytes) {
    throw new Error(
      `Import source exceeds file size limit. Got ${formatMb(stat.size)} MB, limit is ${formatMb(maxFileBytes)} MB. Split the transcript or raise the limit.`,
    );
  }

  const result: ImportDryRunResult = {
    dry_run: true,
    source_type: options.sourceType,
    source_path_hash: hashPathForPreview(sourcePath),
    records_read: 0,
    prompt_candidates: 0,
    sensitive_prompt_count: 0,
    parse_errors: 0,
    skipped_records: {
      assistant_or_tool: 0,
      empty_prompt: 0,
      unsupported_record: 0,
      too_large: 0,
    },
    samples: [],
  };
  const candidates: ImportCandidate[] = [];

  const lines = readFileSync(sourcePath, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      continue;
    }
    result.records_read += 1;

    if (Buffer.byteLength(line, "utf8") > maxLineBytes) {
      result.skipped_records.too_large += 1;
      continue;
    }

    const parsed = parseJsonLine(line);
    if (!parsed.ok) {
      result.parse_errors += 1;
      continue;
    }

    const candidate = extractPromptCandidate(parsed.value, options.sourceType);
    if ("skip" in candidate) {
      result.skipped_records[candidate.skip] += 1;
      continue;
    }

    const redaction = redactPrompt(candidate.prompt, options.redactionMode);
    result.prompt_candidates += 1;
    result.sensitive_prompt_count += redaction.is_sensitive ? 1 : 0;
    candidates.push({
      record_key: buildRecordKey(
        result.source_path_hash,
        index,
        candidate.prompt,
      ),
      record_offset: index,
      prompt: candidate.prompt,
      session_id: candidate.sessionId,
      turn_id: candidate.turnId,
      cwd: candidate.cwd,
    });

    if (result.samples.length < sampleLimit) {
      result.samples.push({
        record_offset: index,
        session_id: candidate.sessionId,
        turn_id: candidate.turnId,
        cwd_label: candidate.cwd ? projectLabel(candidate.cwd) : undefined,
        prompt_preview: redaction.stored_text.slice(0, 160),
        is_sensitive: redaction.is_sensitive,
      });
    }
  }

  return { summary: result, candidates };
}

export function parseImportSourceType(value: string): ImportSourceType {
  if ((IMPORT_SOURCE_TYPES as readonly string[]).includes(value)) {
    return value as ImportSourceType;
  }

  throw new Error(`Unsupported import source: ${value}`);
}

function parseJsonLine(
  line: string,
): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(line) as unknown };
  } catch {
    return { ok: false };
  }
}

function extractPromptCandidate(
  value: unknown,
  sourceType: ImportSourceType,
): PromptCandidate | { skip: SkipReason } {
  if (!isRecord(value)) {
    return { skip: "unsupported_record" };
  }

  const role = readString(value.role) ?? readString(value.type);
  const message = isRecord(value.message) ? value.message : undefined;
  const messageRole = message ? readString(message.role) : undefined;

  if (isAssistantOrToolRole(role) || isAssistantOrToolRole(messageRole)) {
    return { skip: "assistant_or_tool" };
  }

  const prompt =
    readHookPrompt(value) ??
    readUserMessagePrompt(message) ??
    readContentPrompt(value, sourceType);

  if (prompt === undefined) {
    return { skip: "unsupported_record" };
  }
  if (!prompt.trim()) {
    return { skip: "empty_prompt" };
  }

  return {
    prompt,
    sessionId: readString(value.session_id) ?? readString(value.sessionId),
    turnId: readString(value.turn_id) ?? readString(value.turnId),
    cwd: readString(value.cwd),
  };
}

function readHookPrompt(value: Record<string, unknown>): string | undefined {
  if (value.hook_event_name === "UserPromptSubmit") {
    return readString(value.prompt);
  }

  return undefined;
}

function readUserMessagePrompt(
  message: Record<string, unknown> | undefined,
): string | undefined {
  if (!message || message.role !== "user") {
    return undefined;
  }

  return contentToText(message.content);
}

function readContentPrompt(
  value: Record<string, unknown>,
  sourceType: ImportSourceType,
): string | undefined {
  if (sourceType === "manual-jsonl" || sourceType === "official-hook") {
    return undefined;
  }

  if (readString(value.role) === "user" || readString(value.type) === "user") {
    return contentToText(value.content);
  }

  return undefined;
}

function contentToText(content: unknown): string | undefined {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return undefined;
  }

  const parts = content
    .map((item) => {
      if (!isRecord(item) || item.type !== "text") {
        return undefined;
      }
      return readString(item.text);
    })
    .filter((text): text is string => Boolean(text));

  return parts.length > 0 ? parts.join("\n") : undefined;
}

function isAssistantOrToolRole(value: string | undefined): boolean {
  return (
    value === "assistant" ||
    value === "tool" ||
    value === "tool_result" ||
    value === "tool_use" ||
    value === "command" ||
    value === "command_output"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function hashPathForPreview(path: string): string {
  let hash = 0;
  for (let index = 0; index < path.length; index += 1) {
    hash = (hash * 31 + path.charCodeAt(index)) >>> 0;
  }
  return `path_${hash.toString(16).padStart(8, "0")}`;
}

function buildRecordKey(
  sourcePathHash: string,
  recordOffset: number,
  prompt: string,
): string {
  let hash = 0;
  for (let index = 0; index < prompt.length; index += 1) {
    hash = (hash * 33 + prompt.charCodeAt(index)) >>> 0;
  }

  return `${sourcePathHash}:${recordOffset}:${hash.toString(16).padStart(8, "0")}`;
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
