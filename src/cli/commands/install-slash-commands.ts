import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NAMESPACE = "prompt-memory";

export type SlashCommandInstallOptions = {
  sourceDir: string;
  targetDir: string;
  dryRun?: boolean;
};

export type SlashCommandInstallResult = {
  changed: boolean;
  dryRun: boolean;
  namespaceDir: string;
  installed: string[];
  skipped: string[];
};

export function installPromptMemorySlashCommands(
  options: SlashCommandInstallOptions,
): SlashCommandInstallResult {
  const namespaceDir = join(options.targetDir, NAMESPACE);
  const dryRun = Boolean(options.dryRun);
  const installed: string[] = [];
  const skipped: string[] = [];

  if (!existsSync(options.sourceDir)) {
    return {
      changed: false,
      dryRun,
      namespaceDir,
      installed,
      skipped,
    };
  }

  const candidates = readdirSync(options.sourceDir).filter((name) =>
    name.endsWith(".md"),
  );

  for (const name of candidates) {
    const sourcePath = join(options.sourceDir, name);
    const targetPath = join(namespaceDir, name);
    const sourceContent = readFileSync(sourcePath, "utf8");

    if (existsSync(targetPath)) {
      const existing = readFileSync(targetPath, "utf8");
      if (existing === sourceContent) {
        skipped.push(name);
        continue;
      }
    }

    if (!dryRun) {
      mkdirSync(namespaceDir, { recursive: true });
      writeFileSync(targetPath, sourceContent);
    }
    installed.push(name);
  }

  return {
    changed: installed.length > 0,
    dryRun,
    namespaceDir,
    installed,
    skipped,
  };
}

export function defaultClaudeCommandsDir(): string {
  return join(homedir(), ".claude", "commands");
}

export function defaultPromptMemorySlashCommandsSource(): string {
  // dist/cli/commands/install-slash-commands.js  →  ../../../commands
  // src/cli/commands/install-slash-commands.ts   →  ../../../commands
  return join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "commands",
  );
}
