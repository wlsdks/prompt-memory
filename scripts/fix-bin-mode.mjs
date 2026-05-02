#!/usr/bin/env node
import { chmodSync, existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";

const binPath = join(process.cwd(), "dist", "cli", "index.js");

if (platform() !== "win32" && existsSync(binPath)) {
  chmodSync(binPath, 0o755);
}
