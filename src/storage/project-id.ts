import { createHmac } from "node:crypto";

export function createProjectKey(
  sourcePath: string,
  hmacSecret: string,
): string {
  return `proj_${createHmac("sha256", hmacSecret)
    .update(sourcePath)
    .digest("hex")
    .slice(0, 24)}`;
}
