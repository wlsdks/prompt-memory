import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { DoctorCommandRunner } from "./doctor.js";

export type IngestFailureCause =
  | "server_owner_mismatch"
  | "node_abi_mismatch"
  | "token_stale"
  | "server_unreachable"
  | "unknown";

export type IngestFailureDiagnosis = {
  cause: IngestFailureCause;
  hint: string;
};

export type DiagnoseIngestFailureInput = {
  tool: "claude-code" | "codex";
  status?: number;
  configuredDataDir: string;
  port?: number;
  commandRunner?: DoctorCommandRunner;
  readFile?: (path: string) => string | undefined;
  serverErrLogPath?: string;
};

const DEFAULT_PORT = 17373;
const DEFAULT_LOG_TAIL_BYTES = 16 * 1024;
const ABI_PATTERN = /NODE_MODULE_VERSION/;

export function diagnoseIngestFailure({
  tool,
  status,
  configuredDataDir,
  port = DEFAULT_PORT,
  commandRunner,
  readFile = defaultReadFile,
  serverErrLogPath = join(homedir(), ".prompt-coach", "logs", "server.err.log"),
}: DiagnoseIngestFailureInput): IngestFailureDiagnosis {
  if (status !== 401) {
    return {
      cause: "unknown",
      hint: "Run prompt-coach buddy --once to inspect the most recent failed hook ingest.",
    };
  }

  const ownerDataDir = inspectServerDataDir({ port, commandRunner });
  if (
    ownerDataDir &&
    !pathsEqual(ownerDataDir, normalizePath(configuredDataDir))
  ) {
    return {
      cause: "server_owner_mismatch",
      hint: `A different server is bound to port ${port} using data dir ${ownerDataDir} instead of ${configuredDataDir}. Stop it and start the configured service: prompt-coach service stop && prompt-coach service install.`,
    };
  }

  if (
    serverErrLogPath &&
    logHasAbiMismatch({ readFile, path: serverErrLogPath })
  ) {
    return {
      cause: "node_abi_mismatch",
      hint: "The local server keeps exiting with a Node ABI mismatch (better-sqlite3 NODE_MODULE_VERSION error). Reinstall the LaunchAgent with the current Node binary: prompt-coach service install.",
    };
  }

  return {
    cause: "token_stale",
    hint: `Reinstall the hook to refresh the local ingest token: prompt-coach install-hook ${tool}.`,
  };
}

function inspectServerDataDir({
  port,
  commandRunner,
}: {
  port: number;
  commandRunner?: DoctorCommandRunner;
}): string | undefined {
  if (!commandRunner) {
    return undefined;
  }

  const lsof = commandRunner("lsof", [
    "-nP",
    `-iTCP:${port}`,
    "-sTCP:LISTEN",
    "-Fpc",
  ]);

  if (lsof.status !== 0 || !lsof.stdout) {
    return undefined;
  }

  const pid = parseLsofPid(lsof.stdout.toString("utf8"));
  if (!pid) {
    return undefined;
  }

  const ps = commandRunner("ps", ["-p", String(pid), "-o", "command="]);
  if (ps.status !== 0 || !ps.stdout) {
    return undefined;
  }

  return parseDataDirArgument(ps.stdout.toString("utf8"));
}

function parseLsofPid(stdout: string): number | undefined {
  for (const line of stdout.split("\n")) {
    if (line.startsWith("p")) {
      const value = Number.parseInt(line.slice(1).trim(), 10);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
  }
  return undefined;
}

function parseDataDirArgument(commandLine: string): string | undefined {
  const match = commandLine.match(/--data-dir\s+(\S+)/);
  return match ? normalizePath(match[1]) : undefined;
}

function logHasAbiMismatch({
  readFile,
  path,
}: {
  readFile: (path: string) => string | undefined;
  path: string;
}): boolean {
  const content = readFile(path);
  if (!content) {
    return false;
  }
  const tail = content.slice(-DEFAULT_LOG_TAIL_BYTES);
  return ABI_PATTERN.test(tail);
}

function defaultReadFile(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function normalizePath(value: string): string {
  return value.replace(/\/+$/, "");
}

function pathsEqual(a: string, b: string): boolean {
  return normalizePath(a) === normalizePath(b);
}
