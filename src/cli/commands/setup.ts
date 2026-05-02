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

export type SetupTool = "claude-code" | "codex";

export type SetupOptions = {
  dataDir?: string;
  settingsPath?: string;
  hooksPath?: string;
  configPath?: string;
  plistPath?: string;
  dryRun?: boolean;
  noService?: boolean;
  startService?: boolean;
  platform?: NodeJS.Platform;
  detectedTools?: SetupTool[];
  commandExists?: (command: string) => boolean;
};

export type SetupResult = {
  dryRun: boolean;
  dataDir: string;
  detectedTools: SetupTool[];
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
  service: {
    supported: boolean;
    installed: boolean;
    changed: boolean;
    plistPath?: string;
    started: boolean;
    startError?: string;
  };
  nextSteps: string[];
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
    .option("--dry-run", "Preview setup without writing files.")
    .option("--no-service", "Do not install a background server service.")
    .option("--no-start-service", "Install service but do not start it now.")
    .action((options: SetupOptions & { startService?: boolean }) => {
      const result = runSetup({
        ...options,
        startService: options.startService ?? true,
      });
      console.log(JSON.stringify(result, null, 2));
      if (!result.service.supported && !options.noService) {
        process.exitCode = 1;
      }
    });
}

export function runSetup(options: SetupOptions = {}): SetupResult {
  const detectedTools = options.detectedTools ?? detectTools(options);
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
      })
    : undefined;
  const codexResult = detectedTools.includes("codex")
    ? installCodexHook({
        dataDir: options.dataDir,
        hooksPath: options.hooksPath,
        configPath: options.configPath,
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

  return {
    dryRun: Boolean(options.dryRun),
    dataDir,
    detectedTools,
    hooks: {
      claudeCode: claudeResult ? formatClaudeHook(claudeResult) : undefined,
      codex: codexResult ? formatCodexHook(codexResult) : undefined,
    },
    service: formatService(serviceResult),
    nextSteps: buildNextSteps({
      detectedTools,
      serviceResult,
      noService: options.noService,
    }),
  };
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
  detectedTools: SetupTool[];
  serviceResult?: ServiceInstallResult;
  noService?: boolean;
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

  steps.push("Open http://127.0.0.1:17373 to review captured prompts.");
  steps.push(
    "Run prompt-memory doctor claude-code or prompt-memory doctor codex if capture does not appear.",
  );

  return steps;
}

function defaultCommandExists(command: string): boolean {
  const lookup = process.platform === "win32" ? "where" : "which";
  return spawnSync(lookup, [command], { stdio: "ignore" }).status === 0;
}
