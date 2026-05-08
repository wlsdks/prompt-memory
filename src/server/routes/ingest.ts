import { z, ZodError } from "zod";
import type { FastifyInstance } from "fastify";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { normalizeCodexPayload } from "../../adapters/codex.js";
import { ingestPrompt } from "../../storage/ingest-flow.js";
import type {
  NormalizedPromptEvent,
  RedactionPolicy,
} from "../../shared/schema.js";
import type {
  AskEventStoragePort,
  ProjectPolicyStoragePort,
  PromptStoragePort,
} from "../../storage/ports.js";
import { requireBearerToken, type ServerAuthConfig } from "../auth.js";
import { problem } from "../errors.js";

export type IngestRouteOptions = {
  auth: ServerAuthConfig;
  storage: PromptStoragePort &
    Partial<ProjectPolicyStoragePort> &
    Partial<AskEventStoragePort>;
  redactionMode: RedactionPolicy;
  excludedProjectRoots: string[];
  maxPromptLength: number;
};

const AskEventBodySchema = z.object({
  tool: z.enum(["claude-code", "codex"]),
  score: z.number().int().min(0).max(100),
  band: z.enum(["weak", "needs_work", "good", "excellent"]),
  missing_axes: z.array(z.string().min(1).max(40)).max(10).default([]),
  language: z.enum(["en", "ko"]).optional(),
  prompt_length: z.number().int().min(0).max(1_000_000),
  triggered_at: z.string().datetime().optional(),
});

export function registerIngestRoutes(
  server: FastifyInstance,
  options: IngestRouteOptions,
): void {
  server.post("/api/v1/ingest/claude-code", async (request) => {
    requireBearerToken(request, options.auth.ingestToken);

    return handlePromptIngest(request.body, request.url, options, (payload) =>
      normalizeClaudeCodePayload(payload, new Date()),
    );
  });

  server.post("/api/v1/ingest/codex", async (request) => {
    requireBearerToken(request, options.auth.ingestToken);

    return handlePromptIngest(request.body, request.url, options, (payload) =>
      normalizeCodexPayload(payload, new Date()),
    );
  });

  server.post("/api/v1/ingest/ask-event", async (request) => {
    requireBearerToken(request, options.auth.ingestToken);
    if (!options.storage.recordAskEvent) {
      throw problem(
        503,
        "Service Unavailable",
        "Storage backend does not support ask events.",
        request.url,
      );
    }

    let body;
    try {
      body = AskEventBodySchema.parse(request.body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw problem(
          422,
          "Validation Error",
          error.issues.map((issue) => issue.message).join("; "),
          request.url,
        );
      }
      throw error;
    }

    options.storage.recordAskEvent({
      tool: body.tool,
      score: body.score,
      band: body.band,
      missing_axes: body.missing_axes as never,
      language: body.language,
      prompt_length: body.prompt_length,
      triggered_at: body.triggered_at ?? new Date().toISOString(),
    });

    return { data: { recorded: true } };
  });
}

async function handlePromptIngest(
  payload: unknown,
  instance: string,
  options: IngestRouteOptions,
  normalize: (payload: unknown) => NormalizedPromptEvent,
) {
  const event = normalizePayload(payload, instance, normalize);

  if (!event.prompt.trim()) {
    throw problem(
      422,
      "Validation Error",
      "Prompt cannot be empty.",
      instance,
      [{ field: "prompt", message: "empty" }],
    );
  }

  if (event.prompt.length > options.maxPromptLength) {
    throw problem(
      413,
      "Payload Too Large",
      "Prompt length limit exceeded.",
      instance,
      [{ field: "prompt", message: "too_large" }],
    );
  }

  if (isExcluded(event.cwd, options.excludedProjectRoots)) {
    return {
      data: {
        stored: false,
        excluded: true,
        redacted: false,
      },
    };
  }

  const result = await ingestPrompt(options.storage, event, {
    redactionMode: options.redactionMode,
  });

  if (!result.stored) {
    if (result.reason === "policy_lookup_failed") {
      return {
        data: {
          stored: false,
          excluded: true,
          redacted: false,
          reason: "policy_lookup_failed",
        },
      };
    }
    if (result.reason === "project_policy") {
      return {
        data: {
          stored: false,
          excluded: true,
          redacted: false,
          reason: "project_policy",
        },
      };
    }
    return {
      data: {
        stored: false,
        excluded: false,
        redacted: true,
      },
    };
  }

  return {
    data: {
      id: result.id,
      stored: true,
      duplicate: result.duplicate,
      redacted: result.sensitive,
    },
  };
}

function normalizePayload(
  payload: unknown,
  instance: string,
  normalize: (payload: unknown) => NormalizedPromptEvent,
): NormalizedPromptEvent {
  try {
    return normalize(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw problem(
        422,
        "Validation Error",
        "The request payload is invalid.",
        instance,
        error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.code,
        })),
      );
    }

    throw problem(
      422,
      "Validation Error",
      "The request payload is invalid.",
      instance,
    );
  }
}

function isExcluded(cwd: string, excludedRoots: string[]): boolean {
  return excludedRoots.some((root) => {
    const normalized = root.replace(/\/+$/, "");
    return cwd === normalized || cwd.startsWith(`${normalized}/`);
  });
}
