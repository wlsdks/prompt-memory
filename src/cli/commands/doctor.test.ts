import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptMemory } from "../../config/config.js";
import { writeLastHookStatus } from "../../hooks/hook-status.js";
import { installClaudeCodeHook } from "./install-hook.js";
import { doctorClaudeCode } from "./doctor.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("doctorClaudeCode", () => {
  it("detects missing server and token", async () => {
    const dir = createTempDir();

    const result = await doctorClaudeCode({
      dataDir: join(dir, "missing-data"),
      settingsPath: join(dir, "settings.json"),
      checkServer: async () => false,
    });

    expect(result.server.ok).toBe(false);
    expect(result.token.ok).toBe(false);
    expect(result.settings.hookInstalled).toBe(false);
  });

  it("detects invalid settings JSON", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });
    writeFileSync(settingsPath, "{not-json");

    const result = await doctorClaudeCode({
      dataDir,
      settingsPath,
      checkServer: async () => true,
    });

    expect(result.settings.ok).toBe(false);
    expect(result.settings.invalid).toBe(true);
  });

  it("detects installed hook and last ingest status", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const settingsPath = join(dir, "settings.json");
    initializePromptMemory({ dataDir });
    installClaudeCodeHook({ dataDir, settingsPath });
    writeLastHookStatus(dataDir, {
      ok: false,
      status: 503,
      checked_at: "2026-05-01T00:00:00.000Z",
    });

    const result = await doctorClaudeCode({
      dataDir,
      settingsPath,
      checkServer: async () => true,
    });

    expect(result.server.ok).toBe(true);
    expect(result.token.ok).toBe(true);
    expect(result.settings.ok).toBe(true);
    expect(result.settings.hookInstalled).toBe(true);
    expect(result.lastIngestStatus).toEqual({
      ok: false,
      status: 503,
      checked_at: "2026-05-01T00:00:00.000Z",
    });
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-doctor-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
