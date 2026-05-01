import { randomBytes } from "node:crypto";

export type TokenPrefix = "pm_app" | "pm_ingest" | "pm_session";

export function generateToken(prefix: TokenPrefix): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export function generateAppToken(): string {
  return generateToken("pm_app");
}

export function generateIngestToken(): string {
  return generateToken("pm_ingest");
}

export function generateWebSessionSecret(): string {
  return generateToken("pm_session");
}
