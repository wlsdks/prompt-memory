import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { resolveCliEntryPath } from "../cli/entry-path.js";
import { loadPromptMemoryConfig } from "../config/config.js";
import type { HookRunResult } from "./wrapper.js";

type SessionStartPayload = {
  hook_event_name?: string;
  session_id?: string;
  source?: string;
};

export type RunSessionStartHookOptions = {
  stdin: string;
  dataDir?: string;
  openWeb?: boolean;
  isServerReachable?: (url: string) => Promise<boolean>;
  spawnServer?: (options: { dataDir: string }) => void;
  openUrl?: (url: string) => void;
  startupWaitMs?: number;
};

export async function runSessionStartHook(
  options: RunSessionStartHookOptions,
): Promise<HookRunResult> {
  try {
    if (!options.openWeb) {
      return emptyResult();
    }

    const payload = parsePayload(options.stdin);
    if (payload.hook_event_name && payload.hook_event_name !== "SessionStart") {
      return emptyResult();
    }
    if (payload.source && !isOpenableSessionStartSource(payload.source)) {
      return emptyResult();
    }

    const config = loadPromptMemoryConfig(options.dataDir);
    if (!claimSessionOpen(config.data_dir, payload.session_id ?? "unknown")) {
      return emptyResult();
    }

    const url = `http://${config.server.host}:${config.server.port}`;
    const healthUrl = `${url}/api/v1/health`;
    const isReachable = options.isServerReachable ?? defaultIsServerReachable;
    const serverReady = await isReachable(healthUrl);
    if (!serverReady) {
      (options.spawnServer ?? defaultSpawnServer)({ dataDir: config.data_dir });
      await waitForServer(
        healthUrl,
        isReachable,
        options.startupWaitMs ?? 1200,
      );
    }

    (options.openUrl ?? defaultOpenUrl)(url);
  } catch {
    // Session hooks must fail open and must not leak paths, prompts, or tokens.
  }

  return emptyResult();
}

function parsePayload(stdin: string): SessionStartPayload {
  try {
    return JSON.parse(stdin) as SessionStartPayload;
  } catch {
    return {};
  }
}

function isOpenableSessionStartSource(source: string): boolean {
  return source === "startup" || source === "resume";
}

function claimSessionOpen(dataDir: string, sessionId: string): boolean {
  const runtimeDir = join(dataDir, "runtime");
  const statePath = join(runtimeDir, "web-open-sessions.json");
  mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });

  const state = readSessionState(statePath);
  const key = sessionId || "unknown";
  if (state.opened.includes(key)) {
    return false;
  }

  const opened = [key, ...state.opened].slice(0, 100);
  writeFileSync(statePath, `${JSON.stringify({ opened }, null, 2)}\n`, {
    mode: 0o600,
  });
  return true;
}

function readSessionState(statePath: string): { opened: string[] } {
  if (!existsSync(statePath)) {
    return { opened: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as {
      opened?: unknown;
    };
    const opened = Array.isArray(parsed.opened)
      ? parsed.opened.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    return { opened };
  } catch {
    return { opened: [] };
  }
}

async function defaultIsServerReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(
  url: string,
  isReachable: (url: string) => Promise<boolean>,
  maxWaitMs: number,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    if (await isReachable(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

function defaultSpawnServer(options: { dataDir: string }): void {
  const child = spawn(
    process.execPath,
    [cliEntryPath(), "server", "--data-dir", options.dataDir],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );
  child.unref();
}

function defaultOpenUrl(url: string): void {
  const platform = process.platform;
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

function cliEntryPath(): string {
  return resolveCliEntryPath(import.meta.url, "../cli/index.js");
}

function emptyResult(): HookRunResult {
  return { exitCode: 0, stdout: "", stderr: "" };
}
