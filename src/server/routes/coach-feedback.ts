import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { CoachFeedbackStoragePort } from "../../storage/ports.js";
import type { ServerAuthConfig } from "../auth.js";
import { requireAppAccess } from "../auth.js";
import { problem } from "../errors.js";

export type CoachFeedbackRouteOptions = {
  auth: ServerAuthConfig;
  storage: Partial<CoachFeedbackStoragePort>;
};

const PromptParamsSchema = z.object({
  id: z.string().regex(/^prmt_[A-Za-z0-9_]+$/),
});

const CoachFeedbackBodySchema = z.object({
  rating: z.enum(["helpful", "not_helpful", "wrong"]),
});

export function registerCoachFeedbackRoutes(
  server: FastifyInstance,
  options: CoachFeedbackRouteOptions,
): void {
  server.post("/api/v1/prompts/:id/coach-feedback", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const storage = requireCoachFeedbackStorage(options.storage, request.url);
    const params = PromptParamsSchema.parse(request.params);
    const body = CoachFeedbackBodySchema.parse(request.body);

    const entry = storage.recordCoachFeedback(params.id, body.rating);
    if (!entry) {
      throw problem(404, "Not Found", "Prompt not found.", request.url);
    }

    return { data: entry };
  });

  server.get("/api/v1/coach-feedback/summary", async (request) => {
    requireAppAccess(request, options.auth);
    const storage = requireCoachFeedbackStorage(options.storage, request.url);
    return { data: storage.getCoachFeedbackSummary() };
  });
}

function requireCoachFeedbackStorage(
  storage: CoachFeedbackRouteOptions["storage"],
  instance: string,
): CoachFeedbackStoragePort {
  if (!storage.recordCoachFeedback || !storage.getCoachFeedbackSummary) {
    throw problem(
      500,
      "Internal Server Error",
      "Coach feedback storage is not configured.",
      instance,
    );
  }

  return storage as CoachFeedbackStoragePort;
}
