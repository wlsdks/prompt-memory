import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { createProgram, isCliEntryPoint, runCli } from "./index.js";
import { UserError } from "./user-error.js";

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
    const link = join(dir, "node_modules", ".bin", "prompt-coach");
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
      // `prompt-coach --help` is self-explanatory.
      if (command.name() === "help") continue;
      if (!command.description() || command.description().trim() === "") {
        missing.push(command.name());
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("runCli error handling", () => {
  it("renders UserError as a friendly stderr message and exits with code 1", async () => {
    const stderr = createCaptureStream();

    const exitCode = await runCli(
      ["node", "prompt-coach", "start", "--tool", "made-up-tool"],
      { stderr: stderr.stream },
    );

    expect(exitCode).toBe(1);
    expect(stderr.text).toContain("Unsupported tool: made-up-tool");
    expect(stderr.text).not.toMatch(/\n\s+at\s/);
  });

  it("rethrows non-UserError so programmer bugs keep their stack trace", async () => {
    const stderr = createCaptureStream();
    const program = createProgram();
    program.command("__throws-plain").action(() => {
      throw new Error("plain bug");
    });

    await expect(
      runCli(["node", "prompt-coach", "__throws-plain"], {
        stderr: stderr.stream,
        program,
      }),
    ).rejects.toThrow("plain bug");
    expect(stderr.text).toBe("");
  });

  it("does not redact UserError thrown from a custom command", async () => {
    const stderr = createCaptureStream();
    const program = createProgram();
    program.command("__throws-user").action(() => {
      throw new UserError(
        "missing --target. Try: prompt-coach __throws-user --target X",
      );
    });

    const exitCode = await runCli(["node", "prompt-coach", "__throws-user"], {
      stderr: stderr.stream,
      program,
    });

    expect(exitCode).toBe(1);
    expect(stderr.text).toContain(
      "missing --target. Try: prompt-coach __throws-user --target X",
    );
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-cli-entry-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function createCaptureStream(): { stream: Writable; readonly text: string } {
  let captured = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      captured += chunk.toString();
      callback();
    },
  });
  return {
    stream,
    get text() {
      return captured;
    },
  };
}
