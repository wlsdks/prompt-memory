import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Command } from "commander";

import { resolveCliEntryPath } from "../entry-path.js";
import {
  initializePromptMemory,
  revokeIngestToken,
} from "../../config/config.js";

export type ClaudeSettings = {
  hooks?: Record<string, Array<ClaudeHookGroup>>;
  [key: string]: unknown;
};

export type CodexHooksSettings = {
  hooks?: Record<string, Array<ClaudeHookGroup>>;
  [key: string]: unknown;
};

export type ClaudeHookGroup = {
  matcher?: string;
  hooks: Array<ClaudeHookHandler>;
};

export type ClaudeHookHandler = {
  type: "command";
  command: string;
  timeout?: number;
  async?: boolean;
};

export type HookInstallOptions = {
  dataDir?: string;
  settingsPath?: string;
  hooksPath?: string;
  configPath?: string;
  dryRun?: boolean;
  rewriteGuard?: string;
  rewriteMinScore?: string;
  rewriteLanguage?: string;
  openWeb?: boolean;
};

export type HookInstallResult = {
  changed: boolean;
  dryRun: boolean;
  settingsPath: string;
  backupPath?: string;
  nextSettings: ClaudeSettings & { hooks: Record<string, ClaudeHookGroup[]> };
};

export type CodexHookInstallResult = {
  changed: boolean;
  dryRun: boolean;
  hooksPath: string;
  configPath: string;
  hooksBackupPath?: string;
  configBackupPath?: string;
  nextHooks: CodexHooksSettings & { hooks: Record<string, ClaudeHookGroup[]> };
  nextConfig: string;
};

const PROMPT_MEMORY_MARKER = "prompt-memory hook claude-code";
const CODEX_PROMPT_MEMORY_MARKER = "prompt-memory hook codex";
const PROMPT_MEMORY_SESSION_MARKER =
  "prompt-memory hook session-start claude-code";
const CODEX_PROMPT_MEMORY_SESSION_MARKER =
  "prompt-memory hook session-start codex";

export function registerInstallHookCommands(program: Command): void {
  program
    .command("install-hook")
    .argument("<tool>", "Tool to install hook for.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .option("--hooks-path <path>", "Override Codex hooks.json path.")
    .option("--config-path <path>", "Override Codex config.toml path.")
    .option(
      "--rewrite-guard <mode>",
      "Opt in to prompt rewrite guard: off, block-and-copy, or context.",
    )
    .option(
      "--rewrite-min-score <score>",
      "Only rewrite prompts scoring below this 0-100 threshold.",
    )
    .option(
      "--rewrite-language <language>",
      "Improvement draft language for rewrite guard: en or ko.",
    )
    .option(
      "--open-web",
      "Opt in to opening the local web UI when Claude Code/Codex starts a session.",
    )
    .option("--dry-run", "Print intended settings change without writing.")
    .action((tool: string, options: HookInstallOptions) => {
      if (tool === "codex") {
        const result = installCodexHook(options);
        console.log(
          JSON.stringify(
            {
              changed: result.changed,
              dry_run: result.dryRun,
              hooks_path: result.hooksPath,
              config_path: result.configPath,
              hooks_backup_path: result.hooksBackupPath,
              config_backup_path: result.configBackupPath,
            },
            null,
            2,
          ),
        );
        return;
      }

      if (tool !== "claude-code") {
        throw new Error(`Unsupported hook target: ${tool}`);
      }

      const result = installClaudeCodeHook(options);
      console.log(
        JSON.stringify(
          {
            changed: result.changed,
            dry_run: result.dryRun,
            settings_path: result.settingsPath,
            backup_path: result.backupPath,
          },
          null,
          2,
        ),
      );
    });

  program
    .command("uninstall-hook")
    .argument("<tool>", "Tool to uninstall hook for.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--settings-path <path>", "Override Claude Code settings path.")
    .option("--hooks-path <path>", "Override Codex hooks.json path.")
    .option("--config-path <path>", "Override Codex config.toml path.")
    .action((tool: string, options: HookInstallOptions) => {
      if (tool === "codex") {
        const result = uninstallCodexHook(options);
        console.log(
          JSON.stringify(
            {
              changed: result.changed,
              hooks_path: result.hooksPath,
              config_path: result.configPath,
              hooks_backup_path: result.hooksBackupPath,
              config_backup_path: result.configBackupPath,
            },
            null,
            2,
          ),
        );
        return;
      }

      if (tool !== "claude-code") {
        throw new Error(`Unsupported hook target: ${tool}`);
      }

      const result = uninstallClaudeCodeHook(options);
      console.log(
        JSON.stringify(
          {
            changed: result.changed,
            settings_path: result.settingsPath,
            backup_path: result.backupPath,
          },
          null,
          2,
        ),
      );
    });
}

export function installClaudeCodeHook(
  options: HookInstallOptions = {},
): HookInstallResult {
  if (!options.dryRun) {
    initializePromptMemory({ dataDir: options.dataDir });
  }

  const settingsPath = options.settingsPath ?? defaultClaudeSettingsPath();
  const current = readSettings(settingsPath);
  const next = ensureHook(current, buildHookCommand(options.dataDir, options), {
    sessionStartCommand: options.openWeb
      ? buildSessionStartHookCommand("claude-code", options.dataDir)
      : undefined,
  });
  const changed = JSON.stringify(current) !== JSON.stringify(next);

  if (options.dryRun) {
    return {
      changed,
      dryRun: true,
      settingsPath,
      nextSettings: next,
    };
  }

  let backupPath: string | undefined;
  if (changed) {
    mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
    if (existsSync(settingsPath)) {
      backupPath = `${settingsPath}.prompt-memory.${Date.now()}.bak`;
      copyFileSync(settingsPath, backupPath);
    }
    writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, {
      mode: 0o600,
    });
  }

  return {
    changed,
    dryRun: false,
    settingsPath,
    backupPath,
    nextSettings: next,
  };
}

export function uninstallClaudeCodeHook(
  options: HookInstallOptions = {},
): HookInstallResult {
  const settingsPath = options.settingsPath ?? defaultClaudeSettingsPath();
  const current = readSettings(settingsPath);
  const next = removeHook(current);
  const changed = JSON.stringify(current) !== JSON.stringify(next);

  let backupPath: string | undefined;
  if (changed) {
    mkdirSync(dirname(settingsPath), { recursive: true, mode: 0o700 });
    if (existsSync(settingsPath)) {
      backupPath = `${settingsPath}.prompt-memory.${Date.now()}.bak`;
      copyFileSync(settingsPath, backupPath);
    }
    writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, {
      mode: 0o600,
    });
    revokeIngestToken(options.dataDir);
  }

  return {
    changed,
    dryRun: false,
    settingsPath,
    backupPath,
    nextSettings: next,
  };
}

export function installCodexHook(
  options: HookInstallOptions = {},
): CodexHookInstallResult {
  if (!options.dryRun) {
    initializePromptMemory({ dataDir: options.dataDir });
  }

  const hooksPath = options.hooksPath ?? defaultCodexHooksPath();
  const configPath = options.configPath ?? defaultCodexConfigPath();
  const currentHooks = readHooksSettings(hooksPath);
  const currentConfig = readText(configPath);
  const nextHooks = ensureCodexHook(
    currentHooks,
    buildCodexHookCommand(options.dataDir, options),
    {
      sessionStartCommand: options.openWeb
        ? buildSessionStartHookCommand("codex", options.dataDir)
        : undefined,
    },
  );
  const nextConfig = ensureCodexHooksFeature(currentConfig);
  const hooksChanged =
    JSON.stringify(currentHooks) !== JSON.stringify(nextHooks);
  const configChanged = currentConfig !== nextConfig;

  if (options.dryRun) {
    return {
      changed: hooksChanged || configChanged,
      dryRun: true,
      hooksPath,
      configPath,
      nextHooks,
      nextConfig,
    };
  }

  const hooksBackupPath = hooksChanged
    ? writeJsonWithBackup(hooksPath, nextHooks)
    : undefined;
  const configBackupPath = configChanged
    ? writeTextWithBackup(configPath, nextConfig)
    : undefined;

  return {
    changed: hooksChanged || configChanged,
    dryRun: false,
    hooksPath,
    configPath,
    hooksBackupPath,
    configBackupPath,
    nextHooks,
    nextConfig,
  };
}

export function uninstallCodexHook(
  options: HookInstallOptions = {},
): CodexHookInstallResult {
  const hooksPath = options.hooksPath ?? defaultCodexHooksPath();
  const configPath = options.configPath ?? defaultCodexConfigPath();
  const currentHooks = readHooksSettings(hooksPath);
  const currentConfig = readText(configPath);
  const nextHooks = removeCodexHook(currentHooks);
  const hooksChanged =
    JSON.stringify(currentHooks) !== JSON.stringify(nextHooks);

  const hooksBackupPath = hooksChanged
    ? writeJsonWithBackup(hooksPath, nextHooks)
    : undefined;

  if (hooksChanged) {
    revokeIngestToken(options.dataDir);
  }

  return {
    changed: hooksChanged,
    dryRun: false,
    hooksPath,
    configPath,
    hooksBackupPath,
    nextHooks,
    nextConfig: currentConfig,
  };
}

export function hasPromptMemoryHook(settings: ClaudeSettings): boolean {
  return Boolean(
    settings.hooks?.UserPromptSubmit?.some((group) =>
      group.hooks?.some((hook) => hook.command.includes(PROMPT_MEMORY_MARKER)),
    ),
  );
}

export function hasPromptMemorySessionStartHook(
  settings: ClaudeSettings,
): boolean {
  return Boolean(
    settings.hooks?.SessionStart?.some((group) =>
      group.hooks?.some((hook) =>
        hook.command.includes(PROMPT_MEMORY_SESSION_MARKER),
      ),
    ),
  );
}

export function hasPromptMemoryCodexHook(
  settings: CodexHooksSettings,
): boolean {
  return Boolean(
    settings.hooks?.UserPromptSubmit?.some((group) =>
      group.hooks?.some((hook) =>
        hook.command.includes(CODEX_PROMPT_MEMORY_MARKER),
      ),
    ),
  );
}

export function hasPromptMemoryCodexSessionStartHook(
  settings: CodexHooksSettings,
): boolean {
  return Boolean(
    settings.hooks?.SessionStart?.some((group) =>
      group.hooks?.some((hook) =>
        hook.command.includes(CODEX_PROMPT_MEMORY_SESSION_MARKER),
      ),
    ),
  );
}

export function isCodexHooksFeatureEnabled(config: string): boolean {
  const lines = config.split(/\r?\n/);
  let inFeatures = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\[[^\]]+\]$/.test(trimmed)) {
      inFeatures = trimmed === "[features]";
      continue;
    }

    if (inFeatures && /^codex_hooks\s*=\s*true\b/.test(trimmed)) {
      return true;
    }
  }

  return false;
}

function ensureHook(
  settings: ClaudeSettings,
  command: string,
  options: { sessionStartCommand?: string } = {},
): ClaudeSettings & { hooks: Record<string, ClaudeHookGroup[]> } {
  const hooks = { ...(settings.hooks ?? {}) };
  let found = false;
  const userPromptSubmit = [...(hooks.UserPromptSubmit ?? [])].map((group) => ({
    ...group,
    hooks: group.hooks.map((hook) => {
      if (!isClaudePromptMemoryHook(hook.command)) {
        return hook;
      }

      found = true;
      return { ...hook, command };
    }),
  }));

  if (!found) {
    userPromptSubmit.push({
      hooks: [
        {
          type: "command",
          command,
          timeout: 2,
        },
      ],
    });
  }

  hooks.UserPromptSubmit = userPromptSubmit;
  if (options.sessionStartCommand) {
    hooks.SessionStart = ensureSessionStartHook(
      hooks.SessionStart ?? [],
      options.sessionStartCommand,
      PROMPT_MEMORY_SESSION_MARKER,
    );
  }

  return {
    ...settings,
    hooks,
  };
}

function removeHook(
  settings: ClaudeSettings,
): ClaudeSettings & { hooks: Record<string, ClaudeHookGroup[]> } {
  const hooks = { ...(settings.hooks ?? {}) };
  const userPromptSubmit = [...(hooks.UserPromptSubmit ?? [])]
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter(
        (hook) => !isClaudePromptMemoryHook(hook.command),
      ),
    }))
    .filter((group) => group.hooks.length > 0);

  hooks.UserPromptSubmit = userPromptSubmit;
  hooks.SessionStart = removeSessionStartHook(
    hooks.SessionStart ?? [],
    PROMPT_MEMORY_SESSION_MARKER,
  );

  return {
    ...settings,
    hooks,
  };
}

function ensureCodexHook(
  settings: CodexHooksSettings,
  command: string,
  options: { sessionStartCommand?: string } = {},
): CodexHooksSettings & { hooks: Record<string, ClaudeHookGroup[]> } {
  const hooks = { ...(settings.hooks ?? {}) };
  let found = false;
  const userPromptSubmit = [...(hooks.UserPromptSubmit ?? [])].map((group) => ({
    ...group,
    hooks: group.hooks.map((hook) => {
      if (!isCodexPromptMemoryHook(hook.command)) {
        return hook;
      }

      found = true;
      return { ...hook, command };
    }),
  }));

  if (!found) {
    userPromptSubmit.push({
      hooks: [
        {
          type: "command",
          command,
          timeout: 2,
        },
      ],
    });
  }

  hooks.UserPromptSubmit = userPromptSubmit;
  if (options.sessionStartCommand) {
    hooks.SessionStart = ensureSessionStartHook(
      hooks.SessionStart ?? [],
      options.sessionStartCommand,
      CODEX_PROMPT_MEMORY_SESSION_MARKER,
    );
  }

  return {
    ...settings,
    hooks,
  };
}

function removeCodexHook(
  settings: CodexHooksSettings,
): CodexHooksSettings & { hooks: Record<string, ClaudeHookGroup[]> } {
  const hooks = { ...(settings.hooks ?? {}) };
  const userPromptSubmit = [...(hooks.UserPromptSubmit ?? [])]
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter(
        (hook) => !isCodexPromptMemoryHook(hook.command),
      ),
    }))
    .filter((group) => group.hooks.length > 0);

  hooks.UserPromptSubmit = userPromptSubmit;
  hooks.SessionStart = removeSessionStartHook(
    hooks.SessionStart ?? [],
    CODEX_PROMPT_MEMORY_SESSION_MARKER,
  );

  return {
    ...settings,
    hooks,
  };
}

function ensureSessionStartHook(
  groups: ClaudeHookGroup[],
  command: string,
  marker: string,
): ClaudeHookGroup[] {
  let found = false;
  const next = [...groups].map((group) => ({
    ...group,
    hooks: group.hooks.map((hook) => {
      if (!hook.command.includes(marker)) {
        return hook;
      }

      found = true;
      return { ...hook, command, timeout: 5 };
    }),
  }));

  if (!found) {
    next.push({
      hooks: [
        {
          type: "command",
          command,
          timeout: 5,
        },
      ],
    });
  }

  return next;
}

function removeSessionStartHook(
  groups: ClaudeHookGroup[],
  marker: string,
): ClaudeHookGroup[] {
  return [...groups]
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter((hook) => !hook.command.includes(marker)),
    }))
    .filter((group) => group.hooks.length > 0);
}

function ensureCodexHooksFeature(config: string): string {
  const source = config.trimEnd();
  if (!source) {
    return "[features]\ncodex_hooks = true\n";
  }

  const lines = source.split(/\r?\n/);
  let featuresIndex = -1;
  let nextSectionIndex = lines.length;

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (/^\[[^\]]+\]$/.test(trimmed)) {
      if (trimmed === "[features]") {
        featuresIndex = index;
        nextSectionIndex = lines.length;
      } else if (featuresIndex >= 0 && nextSectionIndex === lines.length) {
        nextSectionIndex = index;
      }
    }
  }

  if (featuresIndex < 0) {
    return `${source}\n\n[features]\ncodex_hooks = true\n`;
  }

  for (let index = featuresIndex + 1; index < nextSectionIndex; index += 1) {
    if (/^\s*codex_hooks\s*=/.test(lines[index] ?? "")) {
      lines[index] = "codex_hooks = true";
      return `${lines.join("\n")}\n`;
    }
  }

  lines.splice(featuresIndex + 1, 0, "codex_hooks = true");
  return `${lines.join("\n")}\n`;
}

function buildHookCommand(
  dataDir?: string,
  options: Pick<
    HookInstallOptions,
    "rewriteGuard" | "rewriteMinScore" | "rewriteLanguage"
  > = {},
): string {
  return buildHookCommandWithOptions("claude-code", dataDir, options);
}

function buildCodexHookCommand(
  dataDir?: string,
  options: Pick<
    HookInstallOptions,
    "rewriteGuard" | "rewriteMinScore" | "rewriteLanguage"
  > = {},
): string {
  return buildHookCommandWithOptions("codex", dataDir, options);
}

function buildHookCommandWithOptions(
  tool: "claude-code" | "codex",
  dataDir?: string,
  options: Pick<
    HookInstallOptions,
    "rewriteGuard" | "rewriteMinScore" | "rewriteLanguage"
  > = {},
): string {
  const dataDirArg = dataDir ? ` --data-dir ${JSON.stringify(dataDir)}` : "";
  const rewriteArgs = buildRewriteGuardArgs(options);
  const marker =
    tool === "claude-code" ? PROMPT_MEMORY_MARKER : CODEX_PROMPT_MEMORY_MARKER;
  return `${markerAssignment(marker)} ${shellQuote(
    process.execPath,
  )} ${shellQuote(cliEntryPath())} hook ${tool}${dataDirArg}${rewriteArgs}`;
}

function buildSessionStartHookCommand(
  tool: "claude-code" | "codex",
  dataDir?: string,
): string {
  const dataDirArg = dataDir ? ` --data-dir ${JSON.stringify(dataDir)}` : "";
  const marker =
    tool === "claude-code"
      ? PROMPT_MEMORY_SESSION_MARKER
      : CODEX_PROMPT_MEMORY_SESSION_MARKER;
  return `${markerAssignment(marker)} ${shellQuote(
    process.execPath,
  )} ${shellQuote(cliEntryPath())} hook session-start ${tool}${dataDirArg} --open-web`;
}

function buildRewriteGuardArgs(
  options: Pick<
    HookInstallOptions,
    "rewriteGuard" | "rewriteMinScore" | "rewriteLanguage"
  >,
): string {
  const args: string[] = [];
  const rewriteGuard = options.rewriteGuard;
  if (isRewriteGuardMode(rewriteGuard)) {
    args.push(` --rewrite-guard ${shellQuote(rewriteGuard)}`);
  }
  if (options.rewriteMinScore !== undefined) {
    args.push(` --rewrite-min-score ${shellQuote(options.rewriteMinScore)}`);
  }
  if (options.rewriteLanguage === "en" || options.rewriteLanguage === "ko") {
    args.push(` --rewrite-language ${shellQuote(options.rewriteLanguage)}`);
  }

  return args.join("");
}

function isRewriteGuardMode(
  value: string | undefined,
): value is "off" | "block-and-copy" | "context" | "ask" {
  return (
    value === "off" ||
    value === "block-and-copy" ||
    value === "context" ||
    value === "ask"
  );
}

function isClaudePromptMemoryHook(command: string): boolean {
  return command.includes(PROMPT_MEMORY_MARKER);
}

function isCodexPromptMemoryHook(command: string): boolean {
  return command.includes(CODEX_PROMPT_MEMORY_MARKER);
}

function markerAssignment(marker: string): string {
  return `PROMPT_MEMORY_HOOK=${shellQuote(marker)}`;
}

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

function cliEntryPath(): string {
  return resolveCliEntryPath(import.meta.url, "../index.js");
}

function readSettings(settingsPath: string): ClaudeSettings {
  if (!existsSync(settingsPath)) {
    return {};
  }

  return JSON.parse(readFileSync(settingsPath, "utf8")) as ClaudeSettings;
}

function readHooksSettings(hooksPath: string): CodexHooksSettings {
  if (!existsSync(hooksPath)) {
    return {};
  }

  return JSON.parse(readFileSync(hooksPath, "utf8")) as CodexHooksSettings;
}

function readText(path: string): string {
  if (!existsSync(path)) {
    return "";
  }

  return readFileSync(path, "utf8");
}

function writeJsonWithBackup(path: string, value: unknown): string | undefined {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const backupPath = backupIfExists(path);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  return backupPath;
}

function writeTextWithBackup(path: string, value: string): string | undefined {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const backupPath = backupIfExists(path);
  writeFileSync(path, value, { mode: 0o600 });
  return backupPath;
}

function backupIfExists(path: string): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  const backupPath = `${path}.prompt-memory.${Date.now()}.bak`;
  copyFileSync(path, backupPath);
  return backupPath;
}

function defaultClaudeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json");
}

function defaultCodexHooksPath(): string {
  return join(homedir(), ".codex", "hooks.json");
}

function defaultCodexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}
