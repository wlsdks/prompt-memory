import {
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { migrateLegacyDataDir } from "./data-dir-migration.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-migrate-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

describe("migrateLegacyDataDir", () => {
  it("renames the legacy directory to the new path when only legacy exists", () => {
    const sandbox = createTempDir();
    const legacyPath = join(sandbox, ".prompt-memory");
    const newPath = join(sandbox, ".prompt-coach");
    mkdirSync(legacyPath, { recursive: true });
    writeFileSync(join(legacyPath, "config.json"), '{"a":1}\n');

    const result = migrateLegacyDataDir({ legacyPath, newPath });

    expect(result.migrated).toBe(true);
    expect(result.reason).toBe("applied");
    expect(existsSync(legacyPath)).toBe(false);
    expect(existsSync(newPath)).toBe(true);
    expect(readFileSync(join(newPath, "config.json"), "utf8")).toBe(
      '{"a":1}\n',
    );
  });

  it("returns no-legacy when the legacy directory does not exist", () => {
    const sandbox = createTempDir();
    const legacyPath = join(sandbox, ".prompt-memory");
    const newPath = join(sandbox, ".prompt-coach");

    const result = migrateLegacyDataDir({ legacyPath, newPath });

    expect(result.migrated).toBe(false);
    expect(result.reason).toBe("no-legacy");
  });

  it("returns new-exists and does NOT overwrite when both directories exist", () => {
    const sandbox = createTempDir();
    const legacyPath = join(sandbox, ".prompt-memory");
    const newPath = join(sandbox, ".prompt-coach");
    mkdirSync(legacyPath, { recursive: true });
    mkdirSync(newPath, { recursive: true });
    writeFileSync(join(legacyPath, "legacy.txt"), "legacy\n");
    writeFileSync(join(newPath, "new.txt"), "new\n");

    const result = migrateLegacyDataDir({ legacyPath, newPath });

    expect(result.migrated).toBe(false);
    expect(result.reason).toBe("new-exists");
    expect(existsSync(join(legacyPath, "legacy.txt"))).toBe(true);
    expect(existsSync(join(newPath, "new.txt"))).toBe(true);
  });

  it("dry-run reports ready but does not move", () => {
    const sandbox = createTempDir();
    const legacyPath = join(sandbox, ".prompt-memory");
    const newPath = join(sandbox, ".prompt-coach");
    mkdirSync(legacyPath, { recursive: true });

    const result = migrateLegacyDataDir({ legacyPath, newPath, dryRun: true });

    expect(result.migrated).toBe(false);
    expect(result.dryRun).toBe(true);
    expect(result.reason).toBe("ready");
    expect(existsSync(legacyPath)).toBe(true);
    expect(existsSync(newPath)).toBe(false);
  });

  it("returns legacy-equals-new when both paths resolve to the same directory", () => {
    const sandbox = createTempDir();
    const samePath = join(sandbox, "same");
    mkdirSync(samePath, { recursive: true });

    const result = migrateLegacyDataDir({
      legacyPath: samePath,
      newPath: samePath,
    });

    expect(result.migrated).toBe(false);
    expect(result.reason).toBe("legacy-equals-new");
  });
});
