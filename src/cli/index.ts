#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { Command } from "commander";

import { registerDoctorCommand } from "./commands/doctor.js";
import { registerHookCommand } from "./commands/hook.js";
import { registerInstallHookCommands } from "./commands/install-hook.js";
import { registerInitCommand } from "./commands/init.js";
import { registerPromptCommands } from "./commands/prompts.js";
import { registerServerCommand } from "./commands/server.js";
import { registerServiceCommand } from "./commands/service.js";
import { registerSetupCommand } from "./commands/setup.js";
import { VERSION } from "../shared/version.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("prompt-memory")
    .description("Local-first prompt archive for AI coding tools.")
    .version(VERSION);

  registerInitCommand(program);
  registerHookCommand(program);
  registerInstallHookCommands(program);
  registerSetupCommand(program);
  registerDoctorCommand(program);
  registerServerCommand(program);
  registerServiceCommand(program);
  registerPromptCommands(program);

  return program;
}

function runCli(argv: string[]): void {
  const program = createProgram();

  if (argv.length <= 2) {
    program.help();
  }

  program.parse(argv);
}

const entryUrl = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (import.meta.url === entryUrl) {
  runCli(process.argv);
}
