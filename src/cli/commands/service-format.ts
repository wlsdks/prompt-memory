import type { ServiceInstallResult } from "./service.js";

export type LaunchctlErrorCode =
  | "already_loaded"
  | "not_loaded"
  | "denied"
  | "unsupported_platform"
  | "unknown";

export type ServiceCommandResult = {
  ok: boolean;
  supported: boolean;
  error?: string;
};

export type ServiceCommandKind = "start" | "stop" | "status";

export function classifyLaunchctlError(
  error: string | undefined,
): LaunchctlErrorCode {
  if (!error) return "unknown";
  if (error === "unsupported_platform") return "unsupported_platform";

  const lower = error.toLowerCase();

  if (
    error.includes("Bootstrap failed: 5") ||
    lower.includes("already bootstrapped") ||
    lower.includes("already loaded")
  ) {
    return "already_loaded";
  }

  if (
    error.includes("Could not find specified service") ||
    error.includes("Bootout failed: 36") ||
    lower.includes("not loaded") ||
    lower.includes("not found")
  ) {
    return "not_loaded";
  }

  if (
    error.includes("Operation not permitted") ||
    error.includes("Bootstrap failed: 1") ||
    error.includes("Load failed: 5")
  ) {
    return "denied";
  }

  return "unknown";
}

export function explainLaunchctlError(code: LaunchctlErrorCode): string {
  switch (code) {
    case "unsupported_platform":
      return "prompt-memory service is supported on macOS only.";
    case "already_loaded":
      return "Service is already loaded. Run `prompt-memory service stop` first if you want to reload it.";
    case "not_loaded":
      return "Service is not loaded. Run `prompt-memory service install` first.";
    case "denied":
      return "macOS denied the operation. Open System Settings > Privacy & Security > Full Disk Access and grant access to your Terminal, then try again.";
    case "unknown":
      return "launchctl reported an unexpected error.";
  }
}

const COMMAND_VERB: Record<ServiceCommandKind, string> = {
  start: "started",
  stop: "stopped",
  status: "running",
};

export function formatServiceCommandPlain(
  kind: ServiceCommandKind,
  result: ServiceCommandResult,
): string {
  if (result.ok) {
    return `service ${COMMAND_VERB[kind]}`;
  }

  const code = classifyLaunchctlError(result.error);
  const hint = explainLaunchctlError(code);
  const failure = `failed to ${kind} service: ${hint}`;

  if (code === "unknown" && result.error) {
    return `${failure}\nlaunchctl reported: ${result.error}`;
  }

  return failure;
}

export function formatServiceCommandJson(result: ServiceCommandResult): string {
  const code = result.ok ? undefined : classifyLaunchctlError(result.error);
  const hint = code ? explainLaunchctlError(code) : undefined;

  return JSON.stringify(
    {
      ok: result.ok,
      supported: result.supported,
      error: result.ok ? undefined : result.error,
      error_code: code,
      error_hint: hint,
    },
    null,
    2,
  );
}

export function formatServiceInstallPlain(
  result: ServiceInstallResult,
): string {
  if (!result.supported) {
    return explainLaunchctlError("unsupported_platform");
  }

  const lines: string[] = [];

  if (result.dryRun) {
    lines.push(
      result.changed
        ? `dry-run: would write LaunchAgent to ${result.plistPath}`
        : `dry-run: LaunchAgent at ${result.plistPath} is already up to date`,
    );
    return lines.join("\n");
  }

  if (result.changed) {
    lines.push(`installed LaunchAgent at ${result.plistPath}`);
    if (result.backupPath) {
      lines.push(`backup: ${result.backupPath}`);
    }
  } else {
    lines.push(`LaunchAgent at ${result.plistPath} already up to date`);
  }

  if (result.started) {
    lines.push("service started");
  } else if (result.startError) {
    const code = classifyLaunchctlError(result.startError);
    const hint = explainLaunchctlError(code);
    lines.push(`failed to start service: ${hint}`);
    if (code === "unknown") {
      lines.push(`launchctl reported: ${result.startError}`);
    }
  } else {
    lines.push("service not started (use `prompt-memory service start`)");
  }

  return lines.join("\n");
}

export function formatServiceInstallJson(result: ServiceInstallResult): string {
  const code = result.startError
    ? classifyLaunchctlError(result.startError)
    : undefined;
  const hint = code ? explainLaunchctlError(code) : undefined;

  return JSON.stringify(
    {
      supported: result.supported,
      changed: result.changed,
      dry_run: result.dryRun,
      plist_path: result.plistPath,
      backup_path: result.backupPath,
      started: result.started,
      start_error: result.startError,
      start_error_code: code,
      start_error_hint: hint,
    },
    null,
    2,
  );
}
