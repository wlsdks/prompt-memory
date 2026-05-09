import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadPromptCoachConfig } from "../config/config.js";
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
  openUrl?: (url: string) => void;
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

    const config = loadPromptCoachConfig(options.dataDir);
    if (!claimSessionOpen(config.data_dir, payload.session_id ?? "unknown")) {
      return emptyResult();
    }

    const url = `http://${config.server.host}:${config.server.port}`;
    const healthUrl = `${url}/api/v1/health`;
    const isReachable = options.isServerReachable ?? defaultIsServerReachable;
    if (!(await isReachable(healthUrl))) {
      // Do not spawn a server here. Server lifecycle is owned by
      // `prompt-coach service`; spawning from a SessionStart hook risks a
      // detached child binding 17373 with the wrong data dir and is what
      // produced the 2026-05-09 401 incident. Fail-open silently — the user
      // will see no web pop-up, which matches the spirit of an opt-in hook.
      return emptyResult();
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

function emptyResult(): HookRunResult {
  return { exitCode: 0, stdout: "", stderr: "" };
}
