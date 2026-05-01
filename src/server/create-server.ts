import Fastify from "fastify";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import type { RedactionPolicy } from "../shared/schema.js";
import type { PromptStoragePort } from "../storage/ports.js";
import type { ServerAuthConfig } from "./auth.js";
import { HttpProblem, problem } from "./errors.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerIngestRoutes } from "./routes/ingest.js";

export type CreateServerOptions = {
  dataDir: string;
  auth: ServerAuthConfig;
  storage: PromptStoragePort;
  redactionMode: RedactionPolicy;
  excludedProjectRoots?: string[];
  maxBodyBytes?: number;
  maxPromptLength?: number;
};

export function createServer(options: CreateServerOptions): FastifyInstance {
  const server = Fastify({
    bodyLimit: options.maxBodyBytes ?? 256 * 1024,
    logger: false,
  });

  server.addHook("onRequest", async (request) => {
    validateHost(request);
    validateBrowserOrigin(request);
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

  registerHealthRoutes(server, options.dataDir);
  registerIngestRoutes(server, {
    auth: options.auth,
    storage: options.storage,
    redactionMode: options.redactionMode,
    excludedProjectRoots: options.excludedProjectRoots ?? [],
    maxPromptLength: options.maxPromptLength ?? 100_000,
  });

  return server;
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
