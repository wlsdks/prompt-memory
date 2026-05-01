import { randomBytes } from "node:crypto";

import { compactTimestamp } from "./time.js";

export type PromptIdOptions = {
  now?: Date;
  random?: Uint8Array;
};

export function createPromptId(options: PromptIdOptions = {}): string {
  const now = options.now ?? new Date();
  const random = options.random ?? randomBytes(6);
  const suffix = Buffer.from(random).toString("hex");

  return `prmt_${compactTimestamp(now)}_${suffix}`;
}
