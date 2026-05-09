import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { installService } from "./service.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("installService", () => {
  it("writes a macOS LaunchAgent plist with an explicit server command", () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    const plistPath = join(
      dir,
      "LaunchAgents",
      "com.prompt-coach.server.plist",
    );

    const result = installService({
      dataDir,
      plistPath,
      platform: "darwin",
      start: false,
    });
    const plist = readFileSync(plistPath, "utf8");

    expect(result.changed).toBe(true);
    expect(result.supported).toBe(true);
    expect(result.started).toBe(false);
    expect(plist).toContain("com.prompt-coach.server");
    expect(plist).toContain("<string>server</string>");
    expect(plist).toContain("<string>--data-dir</string>");
    expect(plist).toContain(`<string>${dataDir}</string>`);
    expect(plist).toContain("RunAtLoad");
    expect(plist).toContain("KeepAlive");
  });

  it("dry-run reports the plist without writing", () => {
    const dir = createTempDir();
    const plistPath = join(
      dir,
      "LaunchAgents",
      "com.prompt-coach.server.plist",
    );

    const result = installService({
      plistPath,
      platform: "darwin",
      dryRun: true,
    });

    expect(result.changed).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(() => readFileSync(plistPath, "utf8")).toThrow();
    expect(result.nextPlist).toContain("com.prompt-coach.server");
  });

  it("reports unsupported platforms without writing", () => {
    const dir = createTempDir();
    const plistPath = join(dir, "service.plist");

    const result = installService({
      plistPath,
      platform: "linux",
    });

    expect(result.supported).toBe(false);
    expect(result.changed).toBe(false);
    expect(() => readFileSync(plistPath, "utf8")).toThrow();
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-service-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
