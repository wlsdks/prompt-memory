#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Command } from "commander";

import { registerBuddyCommand } from "./commands/buddy.js";
import { registerCoachCommand } from "./commands/coach.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerExportCommand } from "./commands/export.js";
import { registerHookCommand } from "./commands/hook.js";
import { registerImproveCommand } from "./commands/improve.js";
import { registerImportCommand } from "./commands/import.js";
import { registerInstallHookCommands } from "./commands/install-hook.js";
import { registerInitCommand } from "./commands/init.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerPromptCommands } from "./commands/prompts.js";
import { registerScoreCommand } from "./commands/score.js";
import { registerServerCommand } from "./commands/server.js";
import { registerServiceCommand } from "./commands/service.js";
import { registerSetupCommand } from "./commands/setup.js";
import { registerStartCommand } from "./commands/start.js";
import { registerStatusLineCommand } from "./commands/statusline.js";
import { VERSION } from "../shared/version.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("prompt-memory")
    .description("Local-first prompt archive for AI coding tools.")
    .version(VERSION);

  registerBuddyCommand(program);
  registerInitCommand(program);
  registerHookCommand(program);
  registerCoachCommand(program);
  registerExportCommand(program);
  registerImproveCommand(program);
  registerImportCommand(program);
  registerInstallHookCommands(program);
  registerMcpCommand(program);
  registerStartCommand(program);
  registerSetupCommand(program);
  registerDoctorCommand(program);
  registerServerCommand(program);
  registerServiceCommand(program);
  registerStatusLineCommand(program);
  registerPromptCommands(program);
  registerScoreCommand(program);

  return program;
}

function runCli(argv: string[]): void {
  const program = createProgram();

  if (argv.length <= 2) {
    program.help();
  }

  program.parse(argv);
}

export function isCliEntryPoint(
  importMetaUrl: string,
  argvPath = process.argv[1],
): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    return (
      realpathSync(fileURLToPath(importMetaUrl)) === realpathSync(argvPath)
    );
  } catch {
    return importMetaUrl === pathToFileURL(argvPath).href;
  }
}

if (isCliEntryPoint(import.meta.url)) {
  runCli(process.argv);
}
