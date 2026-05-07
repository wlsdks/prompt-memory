import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";

import { problem } from "./errors.js";

export type ServerAuthConfig = {
  appToken: string;
  ingestToken: string;
  webSessionSecret: string;
};

export type WebSession = {
  csrfToken: string;
  expiresAt: number;
};

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const SESSION_DURATION_SECONDS = SESSION_DURATION_MS / 1000;

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

export function requireAppAccess(
  request: FastifyRequest,
  auth: ServerAuthConfig,
  options: { csrf?: boolean } = {},
): void {
  if (hasBearerToken(request, auth.appToken)) {
    return;
  }

  const session = readWebSession(request, auth.webSessionSecret);
  if (!session) {
    throw problem(
      401,
      "Unauthorized",
      "Missing or invalid app session.",
      request.url,
    );
  }

  if (options.csrf && request.headers["x-csrf-token"] !== session.csrfToken) {
    throw problem(
      403,
      "Forbidden",
      "Missing or invalid CSRF token.",
      request.url,
    );
  }
}

export function createWebSession(secret: string): {
  cookie: string;
  csrfToken: string;
} {
  const csrfToken = randomBytes(24).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      csrfToken,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    }),
    "utf8",
  ).toString("base64url");
  const signature = signPayload(payload, secret);
  const token = `${payload}.${signature}`;

  return {
    cookie: `prompt_memory_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}`,
    csrfToken,
  };
}

function hasBearerToken(
  request: FastifyRequest,
  expectedToken: string,
): boolean {
  return request.headers.authorization === `Bearer ${expectedToken}`;
}

function readWebSession(
  request: FastifyRequest,
  secret: string,
): WebSession | undefined {
  const token = parseCookies(request.headers.cookie).prompt_memory_session;
  if (!token) {
    return undefined;
  }

  const [payload, signature] = token.split(".", 2);
  if (!payload || !signature || !verifySignature(payload, signature, secret)) {
    return undefined;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<WebSession>;

    if (
      typeof session.csrfToken !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return undefined;
    }

    return {
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
    };
  } catch {
    return undefined;
  }
}

function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const part of cookieHeader?.split(";") ?? []) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName && rawValue.length > 0) {
      cookies[rawName] = rawValue.join("=");
    }
  }

  return cookies;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signPayload(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
