import { ZodError } from "zod";
import type { FastifyInstance } from "fastify";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { normalizeCodexPayload } from "../../adapters/codex.js";
import { redactPrompt } from "../../redaction/redact.js";
import type {
  NormalizedPromptEvent,
  RedactionPolicy,
} from "../../shared/schema.js";
import type { PromptStoragePort } from "../../storage/ports.js";
import { requireBearerToken, type ServerAuthConfig } from "../auth.js";
import { problem } from "../errors.js";

export type IngestRouteOptions = {
  auth: ServerAuthConfig;
  storage: PromptStoragePort;
  redactionMode: RedactionPolicy;
  excludedProjectRoots: string[];
  maxPromptLength: number;
};

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

  const redaction = redactPrompt(event.prompt, options.redactionMode);

  if (options.redactionMode === "reject" && redaction.is_sensitive) {
    return {
      data: {
        stored: false,
        excluded: false,
        redacted: true,
      },
    };
  }

  const stored = await options.storage.storePrompt({ event, redaction });

  return {
    data: {
      id: stored.id,
      stored: true,
      duplicate: stored.duplicate,
      redacted: redaction.is_sensitive,
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
  return excludedRoots.some(
    (root) => cwd === root || cwd.startsWith(`${root}/`),
  );
}
