import type { FastifyRequest } from "fastify";

import { problem } from "./errors.js";

export type ServerAuthConfig = {
  appToken: string;
  ingestToken: string;
};

export function requireBearerToken(
  request: FastifyRequest,
  expectedToken: string,
): void {
  const authorization = request.headers.authorization;
  const expected = `Bearer ${expectedToken}`;

  if (authorization !== expected) {
    throw problem(
      401,
      "Unauthorized",
      "Missing or invalid bearer token.",
      request.url,
    );
  }
}
