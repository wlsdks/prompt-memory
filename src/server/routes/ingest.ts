import { ZodError } from "zod";
import type { FastifyInstance } from "fastify";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { redactPrompt } from "../../redaction/redact.js";
import type { RedactionPolicy } from "../../shared/schema.js";
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

    let event;
    try {
      event = normalizeClaudeCodePayload(request.body, new Date());
    } catch (error) {
      if (error instanceof ZodError) {
        throw problem(
          422,
          "Validation Error",
          "The request payload is invalid.",
          request.url,
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
        request.url,
      );
    }

    if (!event.prompt.trim()) {
      throw problem(
        422,
        "Validation Error",
        "Prompt cannot be empty.",
        request.url,
        [{ field: "prompt", message: "empty" }],
      );
    }

    if (event.prompt.length > options.maxPromptLength) {
      throw problem(
        413,
        "Payload Too Large",
        "Prompt length limit exceeded.",
        request.url,
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
  });
}

function isExcluded(cwd: string, excludedRoots: string[]): boolean {
  return excludedRoots.some(
    (root) => cwd === root || cwd.startsWith(`${root}/`),
  );
}
