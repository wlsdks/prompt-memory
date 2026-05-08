import {
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import {
  initializePromptMemory,
  loadHookAuth,
  loadPromptMemoryConfig,
  updateAutoJudgeSettings,
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

  it("defaults auto_judge to disabled on a fresh init", () => {
    const dataDir = createTempDir();
    const result = initializePromptMemory({ dataDir });

    expect(result.config.auto_judge).toEqual({
      enabled: false,
      tool: "claude",
      daily_limit: 50,
      per_minute_limit: 5,
    });
  });

  it("merges auto_judge patches without losing untouched fields", () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    const enabled = updateAutoJudgeSettings(dataDir, { enabled: true });
    expect(enabled).toMatchObject({
      enabled: true,
      tool: "claude",
      daily_limit: 50,
      per_minute_limit: 5,
    });

    const tightened = updateAutoJudgeSettings(dataDir, {
      tool: "codex",
      per_minute_limit: 1,
    });
    expect(tightened).toMatchObject({
      enabled: true,
      tool: "codex",
      daily_limit: 50,
      per_minute_limit: 1,
    });

    const persisted = loadPromptMemoryConfig(dataDir);
    expect(persisted.auto_judge).toEqual(tightened);
  });

  it("defaults experimental_rules to an empty array on a fresh init", () => {
    const dataDir = createTempDir();
    const result = initializePromptMemory({ dataDir });

    expect(result.config.experimental_rules).toEqual([]);
    expect(loadPromptMemoryConfig(dataDir).experimental_rules).toEqual([]);
  });

  it("loads excluded_project_roots from config.json so server enforces them", () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    // Default
    expect(loadPromptMemoryConfig(dataDir).excluded_project_roots).toEqual([]);

    // User edits config.json directly to add a global opt-out
    const configPath = join(dataDir, "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;
    config.excluded_project_roots = ["/Users/example/private-project"];
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    expect(loadPromptMemoryConfig(dataDir).excluded_project_roots).toEqual([
      "/Users/example/private-project",
    ]);
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
