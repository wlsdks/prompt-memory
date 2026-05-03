#!/usr/bin/env node
import { runAgentWrapper } from "./agent-wrapper.js";
import { isCliEntryPoint } from "./index.js";

if (isCliEntryPoint(import.meta.url)) {
  const exitCode = await runAgentWrapper({
    tool: "claude",
    argv: process.argv.slice(2),
  });
  process.exitCode = exitCode;
}
