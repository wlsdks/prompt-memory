import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Command } from "commander";

import { resolveCliEntryPath } from "../entry-path.js";
import {
  formatServiceCommandJson,
  formatServiceCommandPlain,
  formatServiceInstallJson,
  formatServiceInstallPlain,
} from "./service-format.js";

export type ServiceActionOptions = {
  dataDir?: string;
  plistPath?: string;
  dryRun?: boolean;
  start?: boolean;
  platform?: NodeJS.Platform;
  runCommand?: (
    command: string,
    args: string[],
  ) => { status: number | null; stderr?: string };
};

export type ServiceInstallResult = {
  supported: boolean;
  changed: boolean;
  dryRun: boolean;
  plistPath: string;
  backupPath?: string;
  nextPlist?: string;
  started: boolean;
  startError?: string;
};

const SERVICE_LABEL = "com.prompt-coach.server";

export function registerServiceCommand(program: Command): void {
  const service = program
    .command("service")
    .description("Manage prompt-coach background service.");

  service
    .command("install")
    .description("Install a login service for the local prompt-coach server.")
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option("--plist-path <path>", "Override macOS LaunchAgent plist path.")
    .option("--dry-run", "Print intended service change without writing.")
    .option("--no-start", "Install service without starting it now.")
    .option("--json", "Print machine-readable JSON instead of plain text.")
    .action(
      (options: ServiceActionOptions & { start?: boolean; json?: boolean }) => {
        const result = installService({
          ...options,
          start: options.start ?? true,
        });
        console.log(
          options.json
            ? formatServiceInstallJson(result)
            : formatServiceInstallPlain(result),
        );
        if (!result.supported || result.startError) {
          process.exitCode = 1;
        }
      },
    );

  service
    .command("start")
    .description("Start the prompt-coach service on supported platforms.")
    .option("--plist-path <path>", "Override macOS LaunchAgent plist path.")
    .option("--json", "Print machine-readable JSON instead of plain text.")
    .action((options: ServiceActionOptions & { json?: boolean }) => {
      const result = startService(options);
      console.log(
        options.json
          ? formatServiceCommandJson(result)
          : formatServiceCommandPlain("start", result),
      );
      if (!result.ok) {
        process.exitCode = 1;
      }
    });

  service
    .command("stop")
    .description("Stop the prompt-coach service on supported platforms.")
    .option("--plist-path <path>", "Override macOS LaunchAgent plist path.")
    .option("--json", "Print machine-readable JSON instead of plain text.")
    .action((options: ServiceActionOptions & { json?: boolean }) => {
      const result = stopService(options);
      console.log(
        options.json
          ? formatServiceCommandJson(result)
          : formatServiceCommandPlain("stop", result),
      );
      if (!result.ok) {
        process.exitCode = 1;
      }
    });

  service
    .command("status")
    .description("Check the prompt-coach service status.")
    .option("--json", "Print machine-readable JSON instead of plain text.")
    .action((options: ServiceActionOptions & { json?: boolean }) => {
      const result = serviceStatus(options);
      console.log(
        options.json
          ? formatServiceCommandJson(result)
          : formatServiceCommandPlain("status", result),
      );
      if (!result.ok) {
        process.exitCode = 1;
      }
    });
}

export function installService(
  options: ServiceActionOptions = {},
): ServiceInstallResult {
  const platform = options.platform ?? process.platform;
  const plistPath = options.plistPath ?? defaultLaunchAgentPath();

  if (platform !== "darwin") {
    return {
      supported: false,
      changed: false,
      dryRun: Boolean(options.dryRun),
      plistPath,
      started: false,
    };
  }

  const nextPlist = buildLaunchAgentPlist(options.dataDir);
  const current = existsSync(plistPath) ? readFileSync(plistPath, "utf8") : "";
  const changed = current !== nextPlist;

  if (options.dryRun) {
    return {
      supported: true,
      changed,
      dryRun: true,
      plistPath,
      nextPlist,
      started: false,
    };
  }

  let backupPath: string | undefined;
  if (changed) {
    mkdirSync(dirname(plistPath), { recursive: true, mode: 0o700 });
    if (existsSync(plistPath)) {
      backupPath = `${plistPath}.prompt-coach.${Date.now()}.bak`;
      copyFileSync(plistPath, backupPath);
    }
    writeFileSync(plistPath, nextPlist, { mode: 0o600 });
  }

  if (options.start === false) {
    return {
      supported: true,
      changed,
      dryRun: false,
      plistPath,
      backupPath,
      started: false,
    };
  }

  const startResult = startService({ ...options, plistPath, platform });

  return {
    supported: true,
    changed,
    dryRun: false,
    plistPath,
    backupPath,
    started: startResult.ok,
    startError: startResult.ok ? undefined : startResult.error,
  };
}

export function startService(options: ServiceActionOptions = {}): {
  ok: boolean;
  supported: boolean;
  error?: string;
} {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin") {
    return { ok: false, supported: false, error: "unsupported_platform" };
  }

  const plistPath = options.plistPath ?? defaultLaunchAgentPath();
  const runner = options.runCommand ?? runCommand;
  const domain = launchdDomain();
  const bootstrap = runner("launchctl", ["bootstrap", domain, plistPath]);
  const bootstrapOk =
    bootstrap.status === 0 || isAlreadyBootstrapped(bootstrap);

  if (!bootstrapOk) {
    return {
      ok: false,
      supported: true,
      error: bootstrap.stderr ?? "launchctl bootstrap failed",
    };
  }

  const kickstart = runner("launchctl", [
    "kickstart",
    "-k",
    `${domain}/${SERVICE_LABEL}`,
  ]);
  return {
    ok: kickstart.status === 0,
    supported: true,
    error:
      kickstart.status === 0
        ? undefined
        : (kickstart.stderr ?? "launchctl kickstart failed"),
  };
}

export function stopService(options: ServiceActionOptions = {}): {
  ok: boolean;
  supported: boolean;
  error?: string;
} {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin") {
    return { ok: false, supported: false, error: "unsupported_platform" };
  }

  const runner = options.runCommand ?? runCommand;
  const result = runner("launchctl", [
    "bootout",
    launchdDomain(),
    options.plistPath ?? defaultLaunchAgentPath(),
  ]);
  return {
    ok: result.status === 0,
    supported: true,
    error: result.status === 0 ? undefined : result.stderr,
  };
}

export function serviceStatus(options: ServiceActionOptions = {}): {
  ok: boolean;
  supported: boolean;
  error?: string;
} {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin") {
    return { ok: false, supported: false, error: "unsupported_platform" };
  }

  const runner = options.runCommand ?? runCommand;
  const result = runner("launchctl", [
    "print",
    `${launchdDomain()}/${SERVICE_LABEL}`,
  ]);
  return {
    ok: result.status === 0,
    supported: true,
    error: result.status === 0 ? undefined : result.stderr,
  };
}

function buildLaunchAgentPlist(dataDir: string | undefined): string {
  const args = [process.execPath, cliEntryPath(), "server"];
  if (dataDir) {
    args.push("--data-dir", dataDir);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((arg) => `    <string>${escapeXml(arg)}</string>`).join("\n")}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(logPath("server.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(logPath("server.err.log"))}</string>
</dict>
</plist>
`;
}

function cliEntryPath(): string {
  return resolveCliEntryPath(import.meta.url, "../index.js");
}

function defaultLaunchAgentPath(): string {
  return join(homedir(), "Library", "LaunchAgents", `${SERVICE_LABEL}.plist`);
}

function logPath(fileName: string): string {
  return join(homedir(), ".prompt-coach", "logs", fileName);
}

function launchdDomain(): string {
  return `gui/${typeof process.getuid === "function" ? process.getuid() : 0}`;
}

function runCommand(
  command: string,
  args: string[],
): { status: number | null; stderr?: string } {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return { status: result.status, stderr: result.stderr };
}

function isAlreadyBootstrapped(result: { stderr?: string }): boolean {
  return Boolean(
    result.stderr?.includes("Bootstrap failed: 5") ||
    result.stderr?.includes("already bootstrapped"),
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
