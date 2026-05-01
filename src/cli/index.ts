#!/usr/bin/env node
import { pathToFileURL } from "node:url";

import { Command } from "commander";

import { VERSION } from "../shared/version.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("prompt-memory")
    .description("Local-first prompt archive for AI coding tools.")
    .version(VERSION);

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
