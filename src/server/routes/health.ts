import type { FastifyInstance } from "fastify";

import { VERSION } from "../../shared/version.js";

export function registerHealthRoutes(
  server: FastifyInstance,
  dataDir: string,
): void {
  server.get("/api/v1/health", async () => ({
    ok: true,
    version: VERSION,
    data_dir: dataDir,
  }));
}
