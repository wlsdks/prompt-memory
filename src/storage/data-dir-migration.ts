import { existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";

export const LEGACY_DATA_DIR_NAME = ".prompt-memory";
export const NEW_DATA_DIR_NAME = ".prompt-coach";

export type DataDirMigrationOptions = {
  legacyPath?: string;
  newPath?: string;
  dryRun?: boolean;
};

export type DataDirMigrationResult = {
  migrated: boolean;
  dryRun: boolean;
  legacyPath: string;
  newPath: string;
  reason?:
    | "no-legacy"
    | "new-exists"
    | "legacy-equals-new"
    | "ready"
    | "applied";
};

function expandHome(path: string, home = homedir()): string {
  if (path === "~") return home;
  if (path.startsWith(`~${sep}`) || path.startsWith("~/")) {
    return resolve(home, path.slice(2));
  }
  return resolve(path);
}

export function migrateLegacyDataDir(
  options: DataDirMigrationOptions = {},
): DataDirMigrationResult {
  const home = homedir();
  const legacyPath = expandHome(
    options.legacyPath ?? `~/${LEGACY_DATA_DIR_NAME}`,
    home,
  );
  const newPath = expandHome(options.newPath ?? `~/${NEW_DATA_DIR_NAME}`, home);
  const dryRun = Boolean(options.dryRun);

  if (legacyPath === newPath) {
    return {
      migrated: false,
      dryRun,
      legacyPath,
      newPath,
      reason: "legacy-equals-new",
    };
  }

  if (!existsSync(legacyPath)) {
    return {
      migrated: false,
      dryRun,
      legacyPath,
      newPath,
      reason: "no-legacy",
    };
  }

  if (existsSync(newPath)) {
    return {
      migrated: false,
      dryRun,
      legacyPath,
      newPath,
      reason: "new-exists",
    };
  }

  if (dryRun) {
    return {
      migrated: false,
      dryRun,
      legacyPath,
      newPath,
      reason: "ready",
    };
  }

  renameSync(legacyPath, newPath);
  return {
    migrated: true,
    dryRun,
    legacyPath,
    newPath,
    reason: "applied",
  };
}
