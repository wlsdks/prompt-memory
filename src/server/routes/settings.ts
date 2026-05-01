import type { FastifyInstance } from "fastify";

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
};

export function registerSettingsRoutes(
  fastify: FastifyInstance,
  options: SettingsRouteOptions,
): void {
  fastify.get("/api/v1/settings", async (request) => {
    requireAppAccess(request, options.auth);

    return {
      data: {
        data_dir: options.dataDir,
        excluded_project_roots: options.excludedProjectRoots,
        redaction_mode: options.redactionMode,
        server: options.server,
        last_ingest_status: readLastHookStatus(options.dataDir),
      },
    };
  });
}
