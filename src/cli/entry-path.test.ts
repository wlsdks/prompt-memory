import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { resolveCliEntryPath } from "./entry-path.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("resolveCliEntryPath", () => {
  it("prefers the built dist CLI when a source module is installing a persistent command", () => {
    const root = createTempDir();
    mkdirSync(join(root, "src", "cli", "commands"), { recursive: true });
    mkdirSync(join(root, "dist", "cli"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify({ name: "prompt-memory" })}\n`,
    );
    writeFileSync(join(root, "dist", "cli", "index.js"), "");

    const entryPath = resolveCliEntryPath(
      pathToFileURL(join(root, "src", "cli", "commands", "install-hook.js"))
        .href,
      "../index.js",
    );

    expect(entryPath).toBe(join(root, "dist", "cli", "index.js"));
  });

  it("keeps the local module-relative CLI path when dist is not built yet", () => {
    const root = createTempDir();
    mkdirSync(join(root, "src", "cli", "commands"), { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      `${JSON.stringify({ name: "prompt-memory" })}\n`,
    );

    const entryPath = resolveCliEntryPath(
      pathToFileURL(join(root, "src", "cli", "commands", "statusline.js")).href,
      "../index.js",
    );

    expect(entryPath).toBe(join(root, "src", "cli", "index.js"));
  });

  it("keeps the module-relative CLI path when already running from dist", () => {
    const root = createTempDir();
    mkdirSync(join(root, "dist", "cli", "commands"), { recursive: true });

    const entryPath = resolveCliEntryPath(
      pathToFileURL(join(root, "dist", "cli", "commands", "statusline.js"))
        .href,
      "../index.js",
    );

    expect(entryPath).toBe(join(root, "dist", "cli", "index.js"));
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-entry-path-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
