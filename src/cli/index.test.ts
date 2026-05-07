import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { createProgram, isCliEntryPoint } from "./index.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("CLI entrypoint detection", () => {
  it("treats npm bin symlinks as the CLI entrypoint", () => {
    const dir = createTempDir();
    const target = join(dir, "dist", "cli", "index.js");
    const link = join(dir, "node_modules", ".bin", "prompt-memory");
    mkdirSync(join(dir, "dist", "cli"), { recursive: true });
    mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
    writeFileSync(target, "#!/usr/bin/env node\n");
    symlinkSync(target, link);

    expect(isCliEntryPoint(pathToFileURL(target).href, link)).toBe(true);
  });
});

describe("CLI command surface", () => {
  it("registers the agent-facing commands", () => {
    const commands = createProgram()
      .commands.map((command) => command.name())
      .sort();

    expect(commands).toContain("mcp");
    expect(commands).toContain("start");
  });

  it("gives every top-level command a non-empty description", () => {
    const program = createProgram();
    const missing: string[] = [];
    for (const command of program.commands) {
      // The implicit `help` subcommand commander auto-generates does not need
      // a description from us — Commander labels it as "display help for
      // command" itself. Every other command must have one so
      // `prompt-memory --help` is self-explanatory.
      if (command.name() === "help") continue;
      if (!command.description() || command.description().trim() === "") {
        missing.push(command.name());
      }
    }
    expect(missing).toEqual([]);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-cli-entry-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
