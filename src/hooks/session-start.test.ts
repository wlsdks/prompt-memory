import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { initializePromptMemory } from "../config/config.js";
import { runSessionStartHook } from "./session-start.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("runSessionStartHook", () => {
  it("opens the web UI when the local server is already reachable", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    initializePromptMemory({ dataDir });
    const openedUrls: string[] = [];

    const result = await runSessionStartHook({
      stdin: JSON.stringify({
        hook_event_name: "SessionStart",
        session_id: "session-1",
        source: "startup",
      }),
      dataDir,
      openWeb: true,
      isServerReachable: async () => true,
      openUrl: (url) => openedUrls.push(url),
    });

    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    expect(openedUrls).toEqual(["http://127.0.0.1:17373"]);
  });

  it("skips opening the web UI when the local server is not reachable, and does not spawn one", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    initializePromptMemory({ dataDir });
    const openedUrls: string[] = [];

    const result = await runSessionStartHook({
      stdin: JSON.stringify({
        hook_event_name: "SessionStart",
        session_id: "session-1",
        source: "startup",
      }),
      dataDir,
      openWeb: true,
      isServerReachable: async () => false,
      openUrl: (url) => openedUrls.push(url),
    });

    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    expect(openedUrls).toEqual([]);
  });

  it("does not open the browser twice for the same session id", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    initializePromptMemory({ dataDir });
    const openedUrls: string[] = [];
    const payload = JSON.stringify({
      hook_event_name: "SessionStart",
      session_id: "session-1",
      source: "startup",
    });

    await runSessionStartHook({
      stdin: payload,
      dataDir,
      openWeb: true,
      isServerReachable: async () => true,
      openUrl: (url) => openedUrls.push(url),
    });
    await runSessionStartHook({
      stdin: payload,
      dataDir,
      openWeb: true,
      isServerReachable: async () => true,
      openUrl: (url) => openedUrls.push(url),
    });

    expect(openedUrls).toEqual(["http://127.0.0.1:17373"]);
  });

  it("is disabled unless setup or install-hook opted into open-web", async () => {
    const dir = createTempDir();
    const dataDir = join(dir, "data");
    initializePromptMemory({ dataDir });
    const openedUrls: string[] = [];

    const result = await runSessionStartHook({
      stdin: JSON.stringify({ hook_event_name: "SessionStart" }),
      dataDir,
      openWeb: false,
      isServerReachable: async () => true,
      openUrl: (url) => openedUrls.push(url),
    });

    expect(result).toEqual({ exitCode: 0, stdout: "", stderr: "" });
    expect(openedUrls).toEqual([]);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-session-start-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
