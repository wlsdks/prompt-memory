import { createHash } from "node:crypto";

export function buildIdempotencyKey(
  tool: string,
  sessionId: string,
  parts: readonly string[],
): string {
  const basis = [tool, sessionId, ...parts].join(":");
  const digest = createHash("sha256").update(basis).digest("hex").slice(0, 16);
  return `${tool}:${sessionId}:${digest}`;
}
