import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { getPromptMemoryPaths, supportsPosixMode } from "../storage/paths.js";

const LastHookStatusSchema = z.object({
  ok: z.boolean(),
  status: z.number().int().positive().optional(),
  checked_at: z.string().min(1),
});

export type LastHookStatus = z.infer<typeof LastHookStatusSchema>;

const OWNER_ONLY_DIR_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;
const LAST_INGEST_STATUS_FILE = "last-ingest-status.json";

export function writeLastHookStatus(
  dataDir: string | undefined,
  status: LastHookStatus,
): void {
  const path = getLastHookStatusPath(dataDir);
  mkdirSync(getPromptMemoryPaths(dataDir).logsDir, {
    recursive: true,
    mode: OWNER_ONLY_DIR_MODE,
  });
  writeFileSync(
    path,
    `${JSON.stringify(LastHookStatusSchema.parse(status), null, 2)}\n`,
    { mode: OWNER_ONLY_FILE_MODE },
  );

  if (supportsPosixMode()) {
    chmodSync(path, OWNER_ONLY_FILE_MODE);
  }
}

export function readLastHookStatus(
  dataDir?: string,
): LastHookStatus | undefined {
  const path = getLastHookStatusPath(dataDir);

  if (!existsSync(path)) {
    return undefined;
  }

  return LastHookStatusSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

function getLastHookStatusPath(dataDir?: string): string {
  return join(getPromptMemoryPaths(dataDir).logsDir, LAST_INGEST_STATUS_FILE);
}
