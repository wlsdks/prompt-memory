import { spawnSync } from "node:child_process";
import type { Command } from "commander";

import { initializePromptMemory } from "../../config/config.js";
import {
  installClaudeCodeHook,
  installCodexHook,
  type CodexHookInstallResult,
  type HookInstallResult,
} from "./install-hook.js";
import { installService, type ServiceInstallResult } from "./service.js";
import {
  installClaudeCodeStatusLine,
  type StatusLineInstallResult,
} from "./statusline.js";
import type { PromptRewriteGuardMode } from "../../hooks/rewrite-guard.js";
import {
  doctorCommand,
  mcpRegistrationCommand,
  mcpRegistrationSpec,
} from "../agent-access.js";

export type SetupTool = "claude-code" | "codex";
export type SetupProfile = "capture" | "coach";

export type SetupOptions = {
  dataDir?: string;
  settingsPath?: string;
  hooksPath?: string;
  configPath?: string;
  plistPath?: string;
  profile?: string;
  rewriteGuard?: string;
  rewriteMinScore?: string;
  rewriteLanguage?: string;
  dryRun?: boolean;
  service?: boolean;
  noService?: boolean;
  startService?: boolean;
  noStatusLine?: boolean;
  skipStatusline?: boolean;
  openWeb?: boolean;
  platform?: NodeJS.Platform;
  detectedTools?: SetupTool[];
  commandExists?: (command: string) => boolean;
  commandRunner?: (
    command: string,
    args: string[],
  ) => {
    status: number | null;
    stderr?: string | Buffer;
    error?: Error;
  };
  registerMcp?: boolean;
  json?: boolean;
};

export type SetupResult = {
  dryRun: boolean;
  profile: SetupProfile;
  dataDir: string;
  detectedTools: SetupTool[];
  coach: {
    enabled: boolean;
    rewriteGuard?: {
      mode: PromptRewriteGuardMode;
      minScore?: number;
      language?: "en" | "ko";
    };
  };
  hooks: {
    claudeCode?: {
      installed: boolean;
      changed: boolean;
      settingsPath: string;
      backupPath?: string;
    };
    codex?: {
      installed: boolean;
      changed: boolean;
      hooksPath: string;
      configPath: string;
      hooksBackupPath?: string;
      configBackupPath?: string;
    };
  };
  statusLine: {
    claudeCode?: {
      installed: boolean;
      changed: boolean;
      dryRun: boolean;
      settingsPath: string;
      backupPath?: string;
    };
  };
  service: {
    supported: boolean;
    installed: boolean;
    changed: boolean;
    plistPath?: string;
    started: boolean;
    startError?: string;
  };
  autoOpenWeb: {
    enabled: boolean;
  };
  mcp: {
    registerRequested: boolean;
    claudeCode?: McpRegistrationResult;
    codex?: McpRegistrationResult;
  };
  nextSteps: string[];
};

export type McpRegistrationResult = {
  command: string;
  dryRun: boolean;
  ok: boolean;
  error?: string;
};

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description(
      "Initialize prompt-memory, install detected hooks, and set up local server startup.",
    )
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .option("--hooks-path <path>", "Override Codex hooks.json path.")
    .option("--config-path <path>", "Override Codex config.toml path.")
    .option("--plist-path <path>", "Override macOS LaunchAgent plist path.")
    .option(
      "--profile <profile>",
      "Setup profile: capture or coach.",
      "capture",
    )
    .option(
      "--rewrite-guard <mode>",
      "Prompt rewrite guard for installed hooks: off, context, ask, or block-and-copy.",
    )
    .option(
      "--rewrite-min-score <score>",
      "Only rewrite prompts scoring below this 0-100 threshold.",
    )
    .option(
      "--rewrite-language <language>",
      "Improvement draft language for rewrite guard: en or ko.",
    )
    .option("--dry-run", "Preview setup without writing files.")
    .option("--json", "Print machine-readable JSON.")
    .option(
      "--register-mcp",
      "Also register the local MCP server with detected Claude Code/Codex CLIs.",
    )
    .option("--no-service", "Do not install a background server service.")
    .option("--no-start-service", "Install service but do not start it now.")
    .option("--skip-statusline", "Do not install the Claude Code status line.")
    .option(
      "--open-web",
      "Open the local web UI automatically when Claude Code/Codex starts a session.",
    )
    .action((options: SetupOptions & { startService?: boolean }) => {
      const noService = options.noService ?? options.service === false;
      const result = runSetup({
        ...options,
        noService,
        startService: options.startService ?? true,
        noStatusLine: options.noStatusLine ?? options.skipStatusline,
      });
      console.log(
        options.json
          ? JSON.stringify(result, null, 2)
          : formatSetupResult(result),
      );
      if (setupNeedsAttention(result, noService)) {
        process.exitCode = 1;
      }
    });
}

export function setupNeedsAttention(
  result: SetupResult,
  noService: boolean,
): boolean {
  return (
    (!result.service.supported && !noService) ||
    [result.mcp.claudeCode, result.mcp.codex].some(
      (mcpResult) => mcpResult && !mcpResult.dryRun && !mcpResult.ok,
    )
  );
}

export function formatSetupResult(result: SetupResult): string {
  const lines = [
    result.dryRun
      ? "prompt-memory setup preview"
      : "prompt-memory setup complete",
    `Profile: ${result.profile}`,
    `Data: ${result.dataDir}`,
    `Tools: ${result.detectedTools.length > 0 ? result.detectedTools.join(", ") : "none detected"}`,
    "",
    "Status:",
    `- Claude Code hook: ${formatBoolean(result.hooks.claudeCode?.installed)}`,
    `- Codex hook: ${formatBoolean(result.hooks.codex?.installed)}`,
    `- Claude Code status line: ${formatBoolean(result.statusLine.claudeCode?.installed)}`,
    `- Local service: ${formatServiceStatus(result.service)}`,
    `- Auto web open: ${result.autoOpenWeb.enabled ? "installed on SessionStart" : "off"}`,
  ];

  if (result.coach.enabled) {
    lines.push(
      `- Coach profile: on (${result.coach.rewriteGuard?.mode ?? "default"})`,
    );
  }
  if (result.mcp.registerRequested) {
    lines.push(
      `- Claude Code MCP: ${formatMcpRegistration(result.mcp.claudeCode)}`,
    );
    lines.push(`- Codex MCP: ${formatMcpRegistration(result.mcp.codex)}`);
  }

  lines.push("", "First score path:");
  for (const step of result.nextSteps.filter(isFirstScoreStep)) {
    lines.push(`- ${step}`);
  }

  const troubleshootingSteps = result.nextSteps.filter(isTroubleshootingStep);
  if (troubleshootingSteps.length > 0) {
    lines.push("", "If capture does not appear:");
    for (const step of troubleshootingSteps) {
      lines.push(`- ${step}`);
    }
  }

  const optionalSteps = result.nextSteps.filter(isOptionalStep);
  if (optionalSteps.length > 0) {
    lines.push("", "Optional:");
    for (const step of optionalSteps) {
      lines.push(`- ${step}`);
    }
  }

  for (const step of result.nextSteps.filter(isOtherStep)) {
    lines.push(`- ${step}`);
  }

  lines.push("", "Use --json for automation.");
  return lines.join("\n");
}

function formatBoolean(value: boolean | undefined): string {
  return value ? "installed" : "not installed";
}

function formatServiceStatus(service: SetupResult["service"]): string {
  if (!service.supported) return "manual start required";
  if (!service.installed) return "not installed";
  return service.started ? "installed and running" : "installed";
}

function formatMcpRegistration(
  result: McpRegistrationResult | undefined,
): string {
  if (!result) return "not detected";
  if (result.dryRun) return "preview";
  return result.ok ? "registered" : `failed (${result.error ?? "unknown"})`;
}

function isFirstScoreStep(step: string): boolean {
  return (
    step.startsWith("Run prompt-memory server") ||
    step.startsWith("Run prompt-memory service start") ||
    step.startsWith("Send one real coding prompt")
  );
}

function isTroubleshootingStep(step: string): boolean {
  return (
    step.startsWith("Register MCP") ||
    step.startsWith("Retry MCP") ||
    step.startsWith("Run prompt-memory doctor")
  );
}

function isOptionalStep(step: string): boolean {
  return (
    step.startsWith("Open http://127.0.0.1:17373") ||
    step.startsWith("Restart Claude Code") ||
    step.startsWith("Coach profile enabled")
  );
}

function isOtherStep(step: string): boolean {
  return (
    !isFirstScoreStep(step) &&
    !isTroubleshootingStep(step) &&
    !isOptionalStep(step)
  );
}

export function runSetup(options: SetupOptions = {}): SetupResult {
  const profile = parseSetupProfile(options.profile);
  const detectedTools = options.detectedTools ?? detectTools(options);
  const rewriteGuard = resolveRewriteGuardOptions({ ...options, profile });
  const initResult = options.dryRun
    ? undefined
    : initializePromptMemory({ dataDir: options.dataDir });
  const dataDir =
    initResult?.config.data_dir ?? options.dataDir ?? "~/.prompt-memory";

  const claudeResult = detectedTools.includes("claude-code")
    ? installClaudeCodeHook({
        dataDir: options.dataDir,
        settingsPath: options.settingsPath,
        dryRun: options.dryRun,
        ...rewriteGuard.installOptions,
        openWeb: options.openWeb,
      })
    : undefined;
  const codexResult = detectedTools.includes("codex")
    ? installCodexHook({
        dataDir: options.dataDir,
        hooksPath: options.hooksPath,
        configPath: options.configPath,
        dryRun: options.dryRun,
        ...rewriteGuard.installOptions,
        openWeb: options.openWeb,
      })
    : undefined;
  const statusLineResult =
    profile === "coach" &&
    !options.noStatusLine &&
    detectedTools.includes("claude-code")
      ? installClaudeCodeStatusLine({
          dataDir: options.dataDir,
          settingsPath: options.settingsPath,
          dryRun: options.dryRun,
        })
      : undefined;
  const serviceResult = options.noService
    ? undefined
    : installService({
        dataDir: options.dataDir,
        plistPath: options.plistPath,
        platform: options.platform,
        dryRun: options.dryRun,
        start: options.startService ?? true,
      });
  const mcpResult = registerMcpForTools(detectedTools, options);

  return {
    dryRun: Boolean(options.dryRun),
    profile,
    dataDir,
    detectedTools,
    coach: {
      enabled: profile === "coach",
      rewriteGuard: rewriteGuard.result,
    },
    hooks: {
      claudeCode: claudeResult ? formatClaudeHook(claudeResult) : undefined,
      codex: codexResult ? formatCodexHook(codexResult) : undefined,
    },
    statusLine: {
      claudeCode: statusLineResult
        ? formatStatusLine(statusLineResult)
        : undefined,
    },
    autoOpenWeb: {
      enabled: Boolean(options.openWeb),
    },
    service: formatService(serviceResult),
    mcp: mcpResult,
    nextSteps: buildNextSteps({
      profile,
      detectedTools,
      serviceResult,
      noService: options.noService,
      statusLineResult,
      mcpResult,
    }),
  };
}

function parseSetupProfile(value: string | undefined): SetupProfile {
  return value === "coach" ? "coach" : "capture";
}

function resolveRewriteGuardOptions(
  options: SetupOptions & {
    profile: SetupProfile;
  },
): {
  installOptions: {
    rewriteGuard?: string;
    rewriteMinScore?: string;
    rewriteLanguage?: string;
  };
  result?: NonNullable<SetupResult["coach"]["rewriteGuard"]>;
} {
  const mode = parseRewriteGuardMode(
    options.rewriteGuard ??
      (options.profile === "coach" ? "context" : undefined),
  );
  if (!mode) {
    return { installOptions: {} };
  }

  const minScore =
    options.rewriteMinScore ?? (options.profile === "coach" ? "80" : undefined);
  const language =
    options.rewriteLanguage === "en" || options.rewriteLanguage === "ko"
      ? options.rewriteLanguage
      : undefined;
  const parsedMinScore = parseMinScore(minScore);

  return {
    installOptions: {
      rewriteGuard: mode,
      ...(minScore ? { rewriteMinScore: minScore } : {}),
      ...(language ? { rewriteLanguage: language } : {}),
    },
    result: {
      mode,
      ...(parsedMinScore === undefined ? {} : { minScore: parsedMinScore }),
      ...(language ? { language } : {}),
    },
  };
}

function parseRewriteGuardMode(
  value: string | undefined,
): PromptRewriteGuardMode | undefined {
  if (
    value === "off" ||
    value === "context" ||
    value === "block-and-copy" ||
    value === "ask"
  ) {
    return value;
  }

  return undefined;
}

function parseMinScore(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.min(100, Math.round(parsed)))
    : undefined;
}

function detectTools(options: SetupOptions): SetupTool[] {
  const exists = options.commandExists ?? defaultCommandExists;
  return [
    exists("claude") ? "claude-code" : undefined,
    exists("codex") ? "codex" : undefined,
  ].filter((tool): tool is SetupTool => Boolean(tool));
}

function formatClaudeHook(
  result: HookInstallResult,
): NonNullable<SetupResult["hooks"]["claudeCode"]> {
  return {
    installed: true,
    changed: result.changed,
    settingsPath: result.settingsPath,
    backupPath: result.backupPath,
  };
}

function formatCodexHook(
  result: CodexHookInstallResult,
): NonNullable<SetupResult["hooks"]["codex"]> {
  return {
    installed: true,
    changed: result.changed,
    hooksPath: result.hooksPath,
    configPath: result.configPath,
    hooksBackupPath: result.hooksBackupPath,
    configBackupPath: result.configBackupPath,
  };
}

function formatStatusLine(
  result: StatusLineInstallResult,
): NonNullable<SetupResult["statusLine"]["claudeCode"]> {
  return {
    installed: true,
    changed: result.changed,
    dryRun: result.dryRun,
    settingsPath: result.settingsPath,
    backupPath: result.backupPath,
  };
}

function formatService(
  result: ServiceInstallResult | undefined,
): SetupResult["service"] {
  if (!result) {
    return {
      supported: false,
      installed: false,
      changed: false,
      started: false,
    };
  }

  return {
    supported: result.supported,
    installed: result.supported,
    changed: result.changed,
    plistPath: result.plistPath,
    started: result.started,
    startError: result.startError,
  };
}

function buildNextSteps(options: {
  profile: SetupProfile;
  detectedTools: SetupTool[];
  serviceResult?: ServiceInstallResult;
  noService?: boolean;
  statusLineResult?: StatusLineInstallResult;
  mcpResult: SetupResult["mcp"];
}): string[] {
  const steps: string[] = [];

  if (options.detectedTools.length === 0) {
    steps.push(
      "Install Claude Code or Codex, then run prompt-memory setup again.",
    );
  }

  if (options.noService) {
    steps.push("Run prompt-memory server before using connected tools.");
  } else if (!options.serviceResult?.supported) {
    steps.push("Run prompt-memory server manually on this platform.");
  } else if (!options.serviceResult.started) {
    steps.push("Run prompt-memory service start or prompt-memory server.");
  }

  if (options.profile === "coach") {
    steps.push(
      "Send one real coding prompt in Claude Code or Codex, then run prompt-memory coach.",
    );
    steps.push(
      "Coach profile enabled: prompt-memory will add low-friction rewrite guidance inside supported hooks.",
    );
    if (!options.mcpResult.registerRequested) {
      for (const tool of options.detectedTools) {
        steps.push(
          `Register MCP for agent commands: ${mcpRegistrationCommand(tool)}.`,
        );
      }
    } else {
      for (const tool of options.detectedTools) {
        const result =
          tool === "claude-code"
            ? options.mcpResult.claudeCode
            : options.mcpResult.codex;
        if (result && !result.dryRun && !result.ok) {
          steps.push(
            `Retry MCP registration: ${mcpRegistrationCommand(tool)}.`,
          );
        }
      }
    }
    if (options.statusLineResult) {
      steps.push(
        "Restart Claude Code if the prompt-memory status line is not visible.",
      );
    }
  }

  steps.push(
    "Open http://127.0.0.1:17373 when you want archive search, dashboards, or export.",
  );
  steps.push(buildDoctorNextStep(options.detectedTools));

  return steps;
}

function buildDoctorNextStep(tools: SetupTool[]): string {
  if (tools.length === 1) {
    return `Run ${doctorCommand(tools[0])} if capture does not appear.`;
  }

  return "Run prompt-memory doctor claude-code or prompt-memory doctor codex if capture does not appear.";
}

function registerMcpForTools(
  tools: SetupTool[],
  options: SetupOptions,
): SetupResult["mcp"] {
  if (!options.registerMcp) {
    return { registerRequested: false };
  }

  return {
    registerRequested: true,
    claudeCode: tools.includes("claude-code")
      ? registerMcpForTool("claude-code", options)
      : undefined,
    codex: tools.includes("codex")
      ? registerMcpForTool("codex", options)
      : undefined,
  };
}

function registerMcpForTool(
  tool: SetupTool,
  options: SetupOptions,
): McpRegistrationResult {
  const spec = mcpRegistrationSpec(tool);
  const command = mcpRegistrationCommand(tool);
  if (options.dryRun) {
    return { command, dryRun: true, ok: true };
  }

  const runner = options.commandRunner ?? defaultCommandRunner;
  const result = runner(spec.command, spec.args);
  const ok = result.status === 0;
  return {
    command,
    dryRun: false,
    ok,
    ...(ok ? {} : { error: formatCommandError(result) }),
  };
}

function defaultCommandRunner(
  command: string,
  args: string[],
): {
  status: number | null;
  stderr?: string | Buffer;
  error?: Error;
} {
  return spawnSync(command, args, { encoding: "utf8" });
}

function formatCommandError(result: {
  status: number | null;
  stderr?: string | Buffer;
  error?: Error;
}): string {
  if (result.error?.message) {
    return result.error.message;
  }
  if (result.stderr) {
    const stderr = String(result.stderr).trim();
    if (stderr.length > 0) {
      return stderr;
    }
  }
  return result.status === null ? "command failed" : `exit ${result.status}`;
}

function defaultCommandExists(command: string): boolean {
  const lookup = process.platform === "win32" ? "where" : "which";
  return spawnSync(lookup, [command], { stdio: "ignore" }).status === 0;
}
