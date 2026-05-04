import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import type { RedactionPolicy } from "../shared/schema.js";
import type {
  CoachFeedbackStoragePort,
  ExportJobStoragePort,
  ProjectInstructionStoragePort,
  ProjectPolicyStoragePort,
  PromptReadStoragePort,
  PromptStoragePort,
} from "../storage/ports.js";
import type { ServerAuthConfig } from "./auth.js";
import { HttpProblem, problem } from "./errors.js";
import { registerCoachFeedbackRoutes } from "./routes/coach-feedback.js";
import { registerExportRoutes } from "./routes/exports.js";
import { registerImportRoutes } from "./routes/import.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerIngestRoutes } from "./routes/ingest.js";
import { registerPromptRoutes } from "./routes/prompts.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerStaticRoutes, type WebAssets } from "./routes/static.js";

export type CreateServerOptions = {
  dataDir: string;
  auth: ServerAuthConfig;
  storage: PromptStoragePort &
    Partial<ProjectPolicyStoragePort> &
    Partial<ProjectInstructionStoragePort> &
    Partial<PromptReadStoragePort> &
    Partial<ExportJobStoragePort> &
    Partial<CoachFeedbackStoragePort>;
  redactionMode: RedactionPolicy;
  excludedProjectRoots?: string[];
  maxBodyBytes?: number;
  maxQueryLength?: number;
  maxPromptLength?: number;
  serverConfig?: {
    host: string;
    port: number;
  };
  webRoot?: string;
  webAssets?: WebAssets;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
};

export function createServer(options: CreateServerOptions): FastifyInstance {
  const rateLimiter = createRateLimiter(options.rateLimit);
  const server = Fastify({
    bodyLimit: options.maxBodyBytes ?? 256 * 1024,
    logger: false,
  });

  server.addHook("onRequest", async (request) => {
    validateHost(request);
    validateBrowserOrigin(request);
    validateQueryLength(request, options.maxQueryLength);
    rateLimiter(request);
  });

  server.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpProblem) {
      sendProblem(reply, error.problem);
      return;
    }

    if (error instanceof ZodError) {
      sendProblem(
        reply,
        problem(
          422,
          "Validation Error",
          "The request payload is invalid.",
          request.url,
          error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.code,
          })),
        ).problem,
      );
      return;
    }

    if (hasStatusCode(error, 413)) {
      sendProblem(
        reply,
        problem(
          413,
          "Payload Too Large",
          "Request body limit exceeded.",
          request.url,
        ).problem,
      );
      return;
    }

    sendProblem(
      reply,
      problem(
        500,
        "Internal Server Error",
        "An unexpected error occurred.",
        request.url,
      ).problem,
    );
  });

  server.get("/favicon.ico", async (_request, reply) => {
    reply.status(204).send();
  });

  registerHealthRoutes(server);
  registerSessionRoutes(server, options.auth);
  registerIngestRoutes(server, {
    auth: options.auth,
    storage: options.storage,
    redactionMode: options.redactionMode,
    excludedProjectRoots: options.excludedProjectRoots ?? [],
    maxPromptLength: options.maxPromptLength ?? 100_000,
  });
  registerProjectRoutes(server, {
    auth: options.auth,
    storage: options.storage,
  });
  registerExportRoutes(server, {
    auth: options.auth,
    storage: options.storage,
  });
  registerImportRoutes(server, {
    auth: options.auth,
    redactionMode: options.redactionMode,
  });
  registerCoachFeedbackRoutes(server, {
    auth: options.auth,
    storage: options.storage,
  });
  registerPromptRoutes(server, {
    auth: options.auth,
    storage: options.storage,
  });
  registerSettingsRoutes(server, {
    auth: options.auth,
    dataDir: options.dataDir,
    excludedProjectRoots: options.excludedProjectRoots ?? [],
    redactionMode: options.redactionMode,
    server: options.serverConfig ?? {
      host: "127.0.0.1",
      port: 17373,
    },
  });
  registerStaticRoutes(server, {
    webRoot: options.webRoot,
    webAssets: options.webAssets,
  });

  return server;
}

function validateQueryLength(
  request: FastifyRequest,
  maxQueryLength: number | undefined,
): void {
  if (!maxQueryLength) {
    return;
  }

  const query = request.url.split("?", 2)[1] ?? "";

  if (query.length > maxQueryLength) {
    throw problem(
      414,
      "URI Too Long",
      "Query length limit exceeded.",
      request.url,
    );
  }
}

function createRateLimiter(
  options: CreateServerOptions["rateLimit"],
): (request: FastifyRequest) => void {
  if (!options) {
    return () => undefined;
  }

  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (request) => {
    if (!request.url.startsWith("/api/v1/ingest/")) {
      return;
    }

    const key = `${request.ip}:${request.method}:${request.url.split("?", 1)[0]}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return;
    }

    current.count += 1;

    if (current.count > options.max) {
      throw problem(
        429,
        "Too Many Requests",
        "Rate limit exceeded.",
        request.url,
      );
    }
  };
}

function hasStatusCode(error: unknown, statusCode: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === statusCode
  );
}

function validateHost(request: FastifyRequest): void {
  const host = request.headers.host;

  if (!host || !isLoopbackHost(host)) {
    throw problem(400, "Bad Request", "Invalid Host header.", request.url);
  }
}

function validateBrowserOrigin(request: FastifyRequest): void {
  const origin = request.headers.origin;
  const secFetchSite = request.headers["sec-fetch-site"];

  if (typeof secFetchSite === "string" && secFetchSite === "cross-site") {
    throw problem(
      403,
      "Forbidden",
      "Cross-site browser request rejected.",
      request.url,
    );
  }

  if (typeof origin === "string" && !isLoopbackOrigin(origin)) {
    throw problem(
      403,
      "Forbidden",
      "Cross-origin browser request rejected.",
      request.url,
    );
  }
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.replace(/:\d+$/, "");
  return (
    hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]"
  );
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "127.0.0.1" ||
        url.hostname === "localhost" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

function sendProblem(
  reply: FastifyReply,
  details: {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
    errors?: Array<{ field: string; message: string }>;
  },
): void {
  reply.status(details.status).type("application/problem+json").send(details);
}
