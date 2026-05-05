import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createArchiveScoreReport,
  type ArchiveScoreReport,
} from "../../analysis/archive-score.js";
import type {
  AskEventStoragePort,
  JudgeScoreEntry,
  JudgeScoreStoragePort,
  PromptDetail,
  PromptQualityDashboard,
  PromptReadStoragePort,
  PromptSummary,
  PromptStoragePort,
} from "../../storage/ports.js";
import { requireAppAccess, type ServerAuthConfig } from "../auth.js";
import { problem } from "../errors.js";

export type PromptRouteOptions = {
  auth: ServerAuthConfig;
  storage: PromptStoragePort &
    Partial<PromptReadStoragePort> &
    Partial<JudgeScoreStoragePort> &
    Partial<AskEventStoragePort>;
};

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().min(1).optional(),
  q: z.string().trim().max(500).optional(),
  tool: z.string().trim().min(1).max(80).optional(),
  cwd_prefix: z.string().trim().min(1).max(1000).optional(),
  import_job_id: z.string().trim().min(1).max(120).optional(),
  is_sensitive: z.coerce.boolean().optional(),
  tag: z.string().trim().min(1).max(80).optional(),
  focus: z.enum(["saved", "reused", "duplicated", "quality-gap"]).optional(),
  quality_gap: z
    .enum([
      "goal_clarity",
      "background_context",
      "scope_limits",
      "output_format",
      "verification_criteria",
    ])
    .optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
});

const SimilarPromptsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).optional(),
});

const AskEventSummaryQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).optional(),
});

const ArchiveScoreQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  low_score_limit: z.coerce.number().int().positive().max(50).optional(),
  tool: z.string().trim().min(1).max(80).optional(),
  cwd_prefix: z.string().trim().min(1).max(1000).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
});

const QualityDashboardQuerySchema = z.object({
  trend_days: z.coerce.number().int().positive().max(90).optional(),
});

const PromptParamsSchema = z.object({
  id: z.string().regex(/^prmt_[A-Za-z0-9_]+$/),
});

const PromptUsageEventSchema = z.object({
  type: z.literal("prompt_copied"),
});

const PromptBookmarkSchema = z.object({
  bookmarked: z.boolean(),
});

const PromptImprovementDraftSchema = z.object({
  draft_text: z.string().trim().min(1).max(100_000),
  analyzer: z.string().trim().min(1).max(120),
  changed_sections: z
    .array(
      z.enum([
        "goal_clarity",
        "background_context",
        "scope_limits",
        "output_format",
        "verification_criteria",
      ]),
    )
    .max(10)
    .optional(),
  safety_notes: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  copied: z.boolean().optional(),
  accepted: z.boolean().optional(),
});

export function registerPromptRoutes(
  server: FastifyInstance,
  options: PromptRouteOptions,
): void {
  server.get("/api/v1/prompts", async (request) => {
    requireAppAccess(request, options.auth);
    const storage = requireReadStorage(options.storage, request.url);
    const query = ListQuerySchema.parse(request.query);

    try {
      const result = query.q
        ? storage.searchPrompts(query.q, {
            limit: query.limit,
            tool: query.tool,
            cwdPrefix: query.cwd_prefix,
            importJobId: query.import_job_id,
            isSensitive: query.is_sensitive,
            receivedFrom: query.from,
            receivedTo: query.to,
            tag: query.tag,
            focus: query.focus,
            qualityGap: query.quality_gap,
          })
        : storage.listPrompts({
            limit: query.limit,
            cursor: query.cursor,
            tool: query.tool,
            cwdPrefix: query.cwd_prefix,
            importJobId: query.import_job_id,
            isSensitive: query.is_sensitive,
            receivedFrom: query.from,
            receivedTo: query.to,
            tag: query.tag,
            focus: query.focus,
            qualityGap: query.quality_gap,
          });

      return {
        data: {
          items: result.items.map(toBrowserPromptSummary),
          next_cursor: result.nextCursor,
        },
      };
    } catch {
      throw problem(
        400,
        "Bad Request",
        "Invalid prompt list query.",
        request.url,
      );
    }
  });

  server.get("/api/v1/prompts/:id", async (request) => {
    requireAppAccess(request, options.auth);
    const storage = requireReadStorage(options.storage, request.url);
    const params = PromptParamsSchema.parse(request.params);
    const prompt = storage.getPrompt(params.id);

    if (!prompt) {
      throw problem(404, "Not Found", "Prompt not found.", request.url);
    }

    const judgeScore = options.storage.getLatestJudgeScore?.(params.id);
    return { data: toBrowserPromptDetail(prompt, judgeScore) };
  });

  server.get("/api/v1/prompts/:id/similar", async (request) => {
    requireAppAccess(request, options.auth);
    const storage = requireReadStorage(options.storage, request.url);
    const params = PromptParamsSchema.parse(request.params);
    const query = SimilarPromptsQuerySchema.parse(request.query);
    const items = storage.findSimilarPrompts(params.id, query.limit ?? 5);
    return { data: items.map(toBrowserPromptSummary) };
  });

  server.get("/api/v1/ask-events/summary", async (request) => {
    requireAppAccess(request, options.auth);
    if (!options.storage.getAskEventSummary) {
      throw problem(
        503,
        "Service Unavailable",
        "Storage backend does not expose ask event metrics.",
        request.url,
      );
    }
    const query = AskEventSummaryQuerySchema.parse(request.query);
    const summary = options.storage.getAskEventSummary({ days: query.days });
    return { data: summary };
  });

  server.get("/api/v1/quality", async (request) => {
    requireAppAccess(request, options.auth);
    const storage = requireReadStorage(options.storage, request.url);
    const query = QualityDashboardQuerySchema.parse(request.query);

    return {
      data: toBrowserQualityDashboard(
        storage.getQualityDashboard({ trendDays: query.trend_days }),
      ),
    };
  });

  server.get("/api/v1/score", async (request) => {
    requireAppAccess(request, options.auth);
    const storage = requireReadStorage(options.storage, request.url);
    const query = ArchiveScoreQuerySchema.parse(request.query);

    return {
      data: toBrowserArchiveScoreReport(
        createArchiveScoreReport(storage, {
          maxPrompts: query.limit,
          lowScoreLimit: query.low_score_limit,
          tool: query.tool,
          cwdPrefix: query.cwd_prefix,
          receivedFrom: query.from,
          receivedTo: query.to,
        }),
      ),
    };
  });

  server.post("/api/v1/prompts/:id/events", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const storage = requireReadStorage(options.storage, request.url);
    const params = PromptParamsSchema.parse(request.params);
    const body = PromptUsageEventSchema.parse(request.body);
    const result = storage.recordPromptUsage(params.id, body.type);

    if (!result.recorded) {
      throw problem(404, "Not Found", "Prompt not found.", request.url);
    }

    return { data: result };
  });

  server.put("/api/v1/prompts/:id/bookmark", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const storage = requireReadStorage(options.storage, request.url);
    const params = PromptParamsSchema.parse(request.params);
    const body = PromptBookmarkSchema.parse(request.body);
    const result = storage.setPromptBookmark(params.id, body.bookmarked);

    if (!result.updated) {
      throw problem(404, "Not Found", "Prompt not found.", request.url);
    }

    return { data: result };
  });

  server.post("/api/v1/prompts/:id/improvements", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const storage = requireImprovementStorage(options.storage, request.url);
    const params = PromptParamsSchema.parse(request.params);
    const body = PromptImprovementDraftSchema.parse(request.body);
    const draft = storage.createPromptImprovementDraft(params.id, body);

    if (!draft) {
      throw problem(404, "Not Found", "Prompt not found.", request.url);
    }

    return { data: draft };
  });

  server.delete("/api/v1/prompts/:id", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const storage = requireReadStorage(options.storage, request.url);
    const params = PromptParamsSchema.parse(request.params);
    const result = storage.deletePrompt(params.id);

    if (!result.deleted) {
      throw problem(404, "Not Found", "Prompt not found.", request.url);
    }

    return { data: result };
  });
}

function toBrowserPromptSummary(prompt: PromptSummary): PromptSummary {
  return {
    ...prompt,
    cwd: browserProjectLabel(prompt.cwd),
    snippet: maskBrowserPathText(prompt.snippet),
  };
}

function toBrowserPromptDetail(
  prompt: PromptDetail,
  judgeScore: JudgeScoreEntry | undefined,
): PromptDetail & { judge_score?: JudgeScoreEntry } {
  return {
    ...prompt,
    cwd: browserProjectLabel(prompt.cwd),
    snippet: maskBrowserPathText(prompt.snippet),
    markdown: maskBrowserPathText(prompt.markdown),
    ...(judgeScore ? { judge_score: judgeScore } : {}),
  };
}

function toBrowserQualityDashboard(
  dashboard: PromptQualityDashboard,
): PromptQualityDashboard {
  return {
    ...dashboard,
    distribution: {
      ...dashboard.distribution,
      by_project: dashboard.distribution.by_project.map((bucket) => ({
        ...bucket,
        key: browserProjectLabel(bucket.key),
        label: browserProjectLabel(bucket.label),
      })),
    },
    useful_prompts: dashboard.useful_prompts.map((prompt) => ({
      ...prompt,
      cwd: browserProjectLabel(prompt.cwd),
    })),
    duplicate_prompt_groups: dashboard.duplicate_prompt_groups.map((group) => ({
      ...group,
      projects: group.projects.map(browserProjectLabel),
      prompts: group.prompts.map((prompt) => ({
        ...prompt,
        cwd: browserProjectLabel(prompt.cwd),
      })),
    })),
    project_profiles: dashboard.project_profiles.map((profile) => ({
      ...profile,
      key: browserProjectLabel(profile.key),
      label: browserProjectLabel(profile.label),
    })),
    patterns: dashboard.patterns.map((pattern) => ({
      ...pattern,
      project: browserProjectLabel(pattern.project),
      message: maskBrowserPathText(pattern.message),
    })),
    instruction_suggestions: dashboard.instruction_suggestions.map(
      (suggestion) => ({
        ...suggestion,
        project: suggestion.project
          ? browserProjectLabel(suggestion.project)
          : undefined,
        reason: maskBrowserPathText(suggestion.reason),
      }),
    ),
  };
}

function toBrowserArchiveScoreReport(
  report: ArchiveScoreReport,
): ArchiveScoreReport {
  return {
    ...report,
    low_score_prompts: report.low_score_prompts.map((prompt) => ({
      ...prompt,
      project: browserProjectLabel(prompt.project),
    })),
    filters: {
      ...report.filters,
      project: report.filters.project
        ? browserProjectLabel(report.filters.project)
        : undefined,
    },
  };
}

function browserProjectLabel(value: string): string {
  return value.split("/").filter(Boolean).at(-1) ?? value;
}

function maskBrowserPathText(value: string): string {
  return value.replace(
    /(^|[\s('"`])\/(?:Users|home|private|tmp|var|opt|workspace|Volumes)\/[^\s)'"`]+/gi,
    (_match, prefix: string) => `${prefix}[REDACTED:path]`,
  );
}

function requireReadStorage(
  storage: PromptRouteOptions["storage"],
  instance: string,
): PromptReadStoragePort {
  if (
    !storage.listPrompts ||
    !storage.searchPrompts ||
    !storage.getPrompt ||
    !storage.deletePrompt ||
    !storage.getQualityDashboard ||
    !storage.recordPromptUsage ||
    !storage.setPromptBookmark
  ) {
    throw problem(
      500,
      "Internal Server Error",
      "Prompt read storage is not configured.",
      instance,
    );
  }

  return storage as PromptReadStoragePort;
}

function requireImprovementStorage(
  storage: PromptRouteOptions["storage"],
  instance: string,
): PromptReadStoragePort {
  const readStorage = requireReadStorage(storage, instance);

  if (!readStorage.createPromptImprovementDraft) {
    throw problem(
      500,
      "Internal Server Error",
      "Prompt improvement storage is not configured.",
      instance,
    );
  }

  return readStorage;
}
