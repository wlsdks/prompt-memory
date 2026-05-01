import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type {
  PromptReadStoragePort,
  PromptStoragePort,
} from "../../storage/ports.js";
import { requireAppAccess, type ServerAuthConfig } from "../auth.js";
import { problem } from "../errors.js";

export type PromptRouteOptions = {
  auth: ServerAuthConfig;
  storage: PromptStoragePort & Partial<PromptReadStoragePort>;
};

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().min(1).optional(),
  q: z.string().trim().max(500).optional(),
  tool: z.string().trim().min(1).max(80).optional(),
  cwd_prefix: z.string().trim().min(1).max(1000).optional(),
  is_sensitive: z.coerce.boolean().optional(),
  tag: z.string().trim().min(1).max(80).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
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
            isSensitive: query.is_sensitive,
            receivedFrom: query.from,
            receivedTo: query.to,
            tag: query.tag,
          })
        : storage.listPrompts({
            limit: query.limit,
            cursor: query.cursor,
            tool: query.tool,
            cwdPrefix: query.cwd_prefix,
            isSensitive: query.is_sensitive,
            receivedFrom: query.from,
            receivedTo: query.to,
            tag: query.tag,
          });

      return {
        data: {
          items: result.items,
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

    return { data: prompt };
  });

  server.get("/api/v1/quality", async (request) => {
    requireAppAccess(request, options.auth);
    const storage = requireReadStorage(options.storage, request.url);

    return { data: storage.getQualityDashboard() };
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
