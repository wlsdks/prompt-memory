import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import {
  installPromptMemorySlashCommands,
  type SlashCommandInstallResult,
} from "./install-slash-commands.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("installPromptMemorySlashCommands", () => {
  it("copies every *.md file from sourceDir to <targetDir>/prompt-memory/", () => {
    const { sourceDir, targetDir } = makeFixture();
    seedSource(sourceDir, [
      ["guard.md", "# guard\n"],
      ["improve-last.md", "# improve-last\n"],
    ]);

    const result = installPromptMemorySlashCommands({
      sourceDir,
      targetDir,
    });

    expectInstalled(result, ["guard.md", "improve-last.md"]);
    expect(result.changed).toBe(true);
    const namespaceDir = join(targetDir, "prompt-memory");
    expect(readdirSync(namespaceDir).sort()).toEqual([
      "guard.md",
      "improve-last.md",
    ]);
    expect(readFileSync(join(namespaceDir, "guard.md"), "utf8")).toBe(
      "# guard\n",
    );
  });

  it("skips files that already exist with identical content", () => {
    const { sourceDir, targetDir } = makeFixture();
    seedSource(sourceDir, [["guard.md", "# guard\n"]]);
    const namespaceDir = join(targetDir, "prompt-memory");
    mkdirSync(namespaceDir, { recursive: true });
    writeFileSync(join(namespaceDir, "guard.md"), "# guard\n");

    const result = installPromptMemorySlashCommands({
      sourceDir,
      targetDir,
    });

    expect(result.installed).toEqual([]);
    expect(result.skipped).toEqual(["guard.md"]);
    expect(result.changed).toBe(false);
  });

  it("rewrites files whose content drifted from the source (force = true default for prompt-memory namespace)", () => {
    const { sourceDir, targetDir } = makeFixture();
    seedSource(sourceDir, [["guard.md", "# guard new\n"]]);
    const namespaceDir = join(targetDir, "prompt-memory");
    mkdirSync(namespaceDir, { recursive: true });
    writeFileSync(join(namespaceDir, "guard.md"), "# guard old\n");

    const result = installPromptMemorySlashCommands({
      sourceDir,
      targetDir,
    });

    expect(result.installed).toEqual(["guard.md"]);
    expect(result.skipped).toEqual([]);
    expect(result.changed).toBe(true);
    expect(readFileSync(join(namespaceDir, "guard.md"), "utf8")).toBe(
      "# guard new\n",
    );
  });

  it("dry-run reports the same shape but writes nothing", () => {
    const { sourceDir, targetDir } = makeFixture();
    seedSource(sourceDir, [["guard.md", "# guard\n"]]);

    const result = installPromptMemorySlashCommands({
      sourceDir,
      targetDir,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.installed).toEqual(["guard.md"]);
    expect(() => readdirSync(join(targetDir, "prompt-memory"))).toThrow();
  });

  it("returns an empty result when sourceDir does not exist", () => {
    const targetDir = createTempDir();

    const result = installPromptMemorySlashCommands({
      sourceDir: join(targetDir, "missing-source"),
      targetDir,
    });

    expect(result.installed).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.changed).toBe(false);
  });

  it("removes stale prompt-memory commands that no longer exist in the source", () => {
    const { sourceDir, targetDir } = makeFixture();
    seedSource(sourceDir, [["guard.md", "# guard\n"]]);
    const namespaceDir = join(targetDir, "prompt-memory");
    mkdirSync(namespaceDir, { recursive: true });
    writeFileSync(join(namespaceDir, "guard.md"), "# guard\n");
    writeFileSync(join(namespaceDir, "score-last.md"), "# stale score-last\n");
    writeFileSync(join(namespaceDir, "rules.md"), "# stale rules\n");

    const result = installPromptMemorySlashCommands({
      sourceDir,
      targetDir,
    });

    expect(result.removed?.sort()).toEqual(["rules.md", "score-last.md"]);
    expect(result.changed).toBe(true);
    expect(readdirSync(namespaceDir).sort()).toEqual(["guard.md"]);
  });

  it("dry-run reports stale removals without touching disk", () => {
    const { sourceDir, targetDir } = makeFixture();
    seedSource(sourceDir, [["guard.md", "# guard\n"]]);
    const namespaceDir = join(targetDir, "prompt-memory");
    mkdirSync(namespaceDir, { recursive: true });
    writeFileSync(join(namespaceDir, "guard.md"), "# guard\n");
    writeFileSync(join(namespaceDir, "score-last.md"), "# stale\n");

    const result = installPromptMemorySlashCommands({
      sourceDir,
      targetDir,
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.removed).toEqual(["score-last.md"]);
    expect(readdirSync(namespaceDir).sort()).toEqual([
      "guard.md",
      "score-last.md",
    ]);
  });

  it("ignores non-markdown files in the source dir", () => {
    const { sourceDir, targetDir } = makeFixture();
    seedSource(sourceDir, [
      ["guard.md", "# guard\n"],
      ["README.txt", "ignore me\n"],
      ["notes.json", "{}\n"],
    ]);

    const result = installPromptMemorySlashCommands({
      sourceDir,
      targetDir,
    });

    expect(result.installed).toEqual(["guard.md"]);
    expect(readdirSync(join(targetDir, "prompt-memory"))).toEqual(["guard.md"]);
  });
});

function expectInstalled(
  result: SlashCommandInstallResult,
  names: readonly string[],
): void {
  expect(result.installed.sort()).toEqual([...names].sort());
}

function makeFixture(): { sourceDir: string; targetDir: string } {
  const sourceDir = createTempDir();
  const targetDir = createTempDir();
  return { sourceDir, targetDir };
}

function seedSource(dir: string, files: ReadonlyArray<[string, string]>): void {
  for (const [name, content] of files) {
    writeFileSync(join(dir, name), content);
  }
}

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-slash-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
