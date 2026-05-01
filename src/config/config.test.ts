import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import {
  initializePromptMemory,
  loadHookAuth,
  loadPromptMemoryConfig,
} from "./config.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("initializePromptMemory", () => {
  it("creates config, hook auth, and required directories", () => {
    const dataDir = createTempDir();

    const result = initializePromptMemory({
      dataDir,
      now: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(result.created).toEqual({ config: true, hookAuth: true });
    expect(loadPromptMemoryConfig(dataDir)).toEqual(result.config);
    expect(loadHookAuth(dataDir)).toEqual(result.hookAuth);
    expect(result.hookAuth.app_token).toMatch(/^pm_app_/);
    expect(result.hookAuth.ingest_token).toMatch(/^pm_ingest_/);
    expect(result.hookAuth.web_session_secret).toMatch(/^pm_session_/);

    expect(statSync(result.config.prompts_dir).isDirectory()).toBe(true);
    expect(statSync(result.config.logs_dir).isDirectory()).toBe(true);
    expect(statSync(result.config.spool_dir).isDirectory()).toBe(true);
    expect(statSync(result.config.quarantine_dir).isDirectory()).toBe(true);
  });

  it("is idempotent and does not rotate existing secrets", () => {
    const dataDir = createTempDir();

    const first = initializePromptMemory({ dataDir });
    const second = initializePromptMemory({ dataDir });

    expect(second.created).toEqual({ config: false, hookAuth: false });
    expect(second.config).toEqual(first.config);
    expect(second.hookAuth).toEqual(first.hookAuth);
  });

  it("uses owner-only permissions on POSIX systems", () => {
    if (process.platform === "win32") {
      return;
    }

    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    expect(modeOf(dataDir)).toBe(0o700);
    expect(modeOf(join(dataDir, "config.json"))).toBe(0o600);
    expect(modeOf(join(dataDir, "hook-auth.json"))).toBe(0o600);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-config-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function modeOf(path: string): number {
  return statSync(path).mode & 0o777;
}
