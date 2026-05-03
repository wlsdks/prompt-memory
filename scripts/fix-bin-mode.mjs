#!/usr/bin/env node
import { chmodSync, existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";

const binPaths = [
  join(process.cwd(), "dist", "cli", "index.js"),
  join(process.cwd(), "dist", "cli", "pm-claude.js"),
  join(process.cwd(), "dist", "cli", "pm-codex.js"),
];

if (platform() !== "win32") {
  for (const binPath of binPaths) {
    if (existsSync(binPath)) {
      chmodSync(binPath, 0o755);
    }
  }
}
