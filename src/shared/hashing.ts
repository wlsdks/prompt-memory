import { createHmac } from "node:crypto";

export function createStoredContentHash(
  content: string,
  secret: string,
): string {
  const digest = createHmac("sha256", secret).update(content).digest("hex");
  return `hmac-sha256:${digest}`;
}
