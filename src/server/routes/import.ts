import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  IMPORT_SOURCE_TYPES,
  runImportDryRun,
  type ImportSourceType,
} from "../../importer/dry-run.js";
import type { RedactionPolicy } from "../../shared/schema.js";
import type { ServerAuthConfig } from "../auth.js";
import { requireAppAccess } from "../auth.js";
import { problem } from "../errors.js";

export type ImportRouteOptions = {
  auth: ServerAuthConfig;
  redactionMode: RedactionPolicy;
};

const MAX_BODY_BYTES = 10 * 1024 * 1024;

const ImportDryRunBodySchema = z.object({
  source_type: z.enum(IMPORT_SOURCE_TYPES),
  content: z.string().min(1).max(MAX_BODY_BYTES),
});

export function registerImportRoutes(
  server: FastifyInstance,
  options: ImportRouteOptions,
): void {
  server.post("/api/v1/import/dry-run", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const body = ImportDryRunBodySchema.parse(request.body);

    if (Buffer.byteLength(body.content, "utf8") > MAX_BODY_BYTES) {
      throw problem(
        413,
        "Payload Too Large",
        "Import source exceeds the per-request size limit.",
        request.url,
      );
    }

    const dir = mkdtempSync(join(tmpdir(), "prompt-coach-import-upload-"));
    const file = join(dir, "upload.jsonl");
    try {
      writeFileSync(file, body.content, { mode: 0o600 });
      const summary = runImportDryRun({
        file,
        sourceType: body.source_type as ImportSourceType,
        redactionMode: options.redactionMode,
      });
      return { data: summary };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
