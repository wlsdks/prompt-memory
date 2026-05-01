import { homedir, platform } from "node:os";
import { isAbsolute, resolve, sep } from "node:path";

export const DEFAULT_DATA_DIR = "~/.prompt-memory";

export type PromptMemoryPaths = {
  dataDir: string;
  configPath: string;
  hookAuthPath: string;
  databasePath: string;
  promptsDir: string;
  logsDir: string;
  diagnosticLogPath: string;
  quarantineDir: string;
  spoolDir: string;
};

export function resolveHomePath(input: string, home = homedir()): string {
  if (input === "~") {
    return home;
  }

  if (input.startsWith(`~${sep}`) || input.startsWith("~/")) {
    return resolve(home, input.slice(2));
  }

  return resolve(input);
}

export function getPromptMemoryPaths(
  dataDir = DEFAULT_DATA_DIR,
): PromptMemoryPaths {
  const root = resolveHomePath(dataDir);

  return {
    dataDir: root,
    configPath: resolve(root, "config.json"),
    hookAuthPath: resolve(root, "hook-auth.json"),
    databasePath: resolve(root, "prompt-memory.sqlite"),
    promptsDir: resolve(root, "prompts"),
    logsDir: resolve(root, "logs"),
    diagnosticLogPath: resolve(root, "logs", "diagnostic.log"),
    quarantineDir: resolve(root, "quarantine"),
    spoolDir: resolve(root, "spool"),
  };
}

export function safeResolveUnderRoot(root: string, candidate: string): string {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = isAbsolute(candidate)
    ? resolve(candidate)
    : resolve(resolvedRoot, candidate);

  const prefix = resolvedRoot.endsWith(sep)
    ? resolvedRoot
    : `${resolvedRoot}${sep}`;
  const isInside =
    resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(prefix);

  if (!isInside) {
    throw new Error(`Path escapes root: ${candidate}`);
  }

  return resolvedCandidate;
}

export function supportsPosixMode(): boolean {
  return platform() !== "win32";
}
