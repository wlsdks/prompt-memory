import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  updateAutoJudgeSettings,
  type AutoJudgeSettings,
} from "../../config/config.js";
import { readLastHookStatus } from "../../hooks/hook-status.js";
import type { RedactionPolicy } from "../../shared/schema.js";
import { requireAppAccess, type ServerAuthConfig } from "../auth.js";

export type SettingsRouteOptions = {
  auth: ServerAuthConfig;
  dataDir: string;
  excludedProjectRoots: string[];
  redactionMode: RedactionPolicy;
  server: {
    host: string;
    port: number;
  };
  autoJudge: AutoJudgeSettings;
};

const AutoJudgePatchSchema = z.object({
  enabled: z.boolean().optional(),
  tool: z.enum(["claude", "codex"]).optional(),
  daily_limit: z.number().int().nonnegative().max(10_000).optional(),
  per_minute_limit: z.number().int().nonnegative().max(60).optional(),
});

export function registerSettingsRoutes(
  fastify: FastifyInstance,
  options: SettingsRouteOptions,
): void {
  let autoJudgeState = options.autoJudge;

  fastify.get("/api/v1/settings", async (request) => {
    requireAppAccess(request, options.auth);

    return {
      data: {
        data_dir: options.dataDir,
        excluded_project_roots: options.excludedProjectRoots,
        redaction_mode: options.redactionMode,
        server: options.server,
        last_ingest_status: readLastHookStatus(options.dataDir),
        auto_judge: autoJudgeState,
      },
    };
  });

  fastify.patch("/api/v1/settings/auto-judge", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const patch = AutoJudgePatchSchema.parse(request.body);
    autoJudgeState = updateAutoJudgeSettings(options.dataDir, patch);
    return { data: autoJudgeState };
  });
}
