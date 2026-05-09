#!/usr/bin/env node
import { runAgentWrapper } from "./agent-wrapper.js";
import { isCliEntryPoint } from "./index.js";
import { isUserError } from "./user-error.js";

if (isCliEntryPoint(import.meta.url)) {
  try {
    const exitCode = await runAgentWrapper({
      tool: "claude",
      argv: process.argv.slice(2),
    });
    process.exitCode = exitCode;
  } catch (error) {
    if (isUserError(error)) {
      process.stderr.write(`Error: ${error.message}\n`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
