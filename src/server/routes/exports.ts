import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createAnonymizedExportPreview,
  executeAnonymizedExport,
  parseExportPreset,
  type AnonymizedExportStorage,
} from "../../exporter/anonymized.js";
import type { ServerAuthConfig } from "../auth.js";
import { requireAppAccess } from "../auth.js";
import { problem } from "../errors.js";

export type ExportRouteOptions = {
  auth: ServerAuthConfig;
  storage: Partial<AnonymizedExportStorage>;
};

const ExportPreviewBodySchema = z.object({
  preset: z
    .enum(["personal_backup", "anonymized_review", "issue_report_attachment"])
    .optional(),
});

const ExportExecuteBodySchema = z.object({
  job_id: z.string().regex(/^exp_[A-Za-z0-9_]+$/),
});

export function registerExportRoutes(
  server: FastifyInstance,
  options: ExportRouteOptions,
): void {
  server.post("/api/v1/exports/preview", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const storage = requireExportStorage(options.storage, request.url);
    const body = ExportPreviewBodySchema.parse(request.body ?? {});
    const preset = body.preset ? parseExportPreset(body.preset) : undefined;

    return {
      data: createAnonymizedExportPreview(storage, {
        hmacSecret: options.auth.webSessionSecret,
        preset,
      }),
    };
  });

  server.post("/api/v1/exports", async (request) => {
    requireAppAccess(request, options.auth, { csrf: true });
    const storage = requireExportStorage(options.storage, request.url);
    const body = ExportExecuteBodySchema.parse(request.body);

    try {
      return {
        data: executeAnonymizedExport(storage, body.job_id, {
          hmacSecret: options.auth.webSessionSecret,
        }),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("no longer valid")) {
        throw problem(
          409,
          "Conflict",
          "Export job is no longer valid. Create a new preview.",
          request.url,
        );
      }

      if (error instanceof Error && error.message.includes("not found")) {
        throw problem(404, "Not Found", "Export job not found.", request.url);
      }

      throw error;
    }
  });
}

function requireExportStorage(
  storage: ExportRouteOptions["storage"],
  instance: string,
): AnonymizedExportStorage {
  if (
    !storage.listPrompts ||
    !storage.getPrompt ||
    !storage.createExportJob ||
    !storage.getExportJob ||
    !storage.updateExportJobStatus
  ) {
    throw problem(
      500,
      "Internal Server Error",
      "Export storage is not configured.",
      instance,
    );
  }

  return storage as AnonymizedExportStorage;
}
