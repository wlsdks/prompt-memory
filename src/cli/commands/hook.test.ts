import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  formatHookStatusReports,
  readHookStatusReports,
  type HookStatusReport,
} from "./hook.js";

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "prompt-memory-hook-status-"));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function writeClaudeSettings(mode: string | undefined): string {
  const path = join(sandbox, "claude.json");
  const flag = mode ? ` --rewrite-guard "${mode}"` : "";
  const value = {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: `PROMPT_MEMORY_HOOK="prompt-memory hook claude-code" /bin/node /tmp/cli.js hook claude-code --data-dir "/tmp/data"${flag}`,
              timeout: 2,
            },
          ],
        },
      ],
    },
  };
  mkdirSync(sandbox, { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

function writeCodexHooks(mode: string | undefined): string {
  const path = join(sandbox, "codex-hooks.json");
  const flag = mode ? ` --rewrite-guard "${mode}"` : "";
  const value = {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: `PROMPT_MEMORY_HOOK="prompt-memory hook codex" /bin/node /tmp/cli.js hook codex --data-dir "/tmp/data"${flag}`,
              timeout: 2,
            },
          ],
        },
      ],
    },
  };
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

describe("readHookStatusReports", () => {
  it("returns not-installed entries when settings files are missing", () => {
    const reports = readHookStatusReports({
      settingsPath: join(sandbox, "missing-claude.json"),
      hooksPath: join(sandbox, "missing-codex.json"),
    });

    expect(reports).toHaveLength(2);
    expect(reports[0]).toMatchObject({
      tool: "claude-code",
      installed: false,
      mode: "unknown",
    });
    expect(reports[1]).toMatchObject({
      tool: "codex",
      installed: false,
      mode: "unknown",
    });
  });

  it("extracts the rewrite-guard mode from each tool's hook command", () => {
    const settingsPath = writeClaudeSettings("ask");
    const hooksPath = writeCodexHooks("context");

    const reports = readHookStatusReports({ settingsPath, hooksPath });

    expect(reports[0]).toMatchObject({
      tool: "claude-code",
      installed: true,
      mode: "ask",
    });
    expect(reports[1]).toMatchObject({
      tool: "codex",
      installed: true,
      mode: "context",
    });
  });

  it("falls back to off when the hook command has no rewrite-guard flag", () => {
    const settingsPath = writeClaudeSettings(undefined);
    const hooksPath = join(sandbox, "missing-codex.json");

    const reports = readHookStatusReports({ settingsPath, hooksPath });

    expect(reports[0]?.mode).toBe("off");
  });

  it("treats a malformed settings file as not-installed instead of throwing", () => {
    const settingsPath = join(sandbox, "claude.json");
    const hooksPath = join(sandbox, "codex-hooks.json");
    writeFileSync(settingsPath, "{not valid json");
    writeFileSync(hooksPath, "[[[oops");

    expect(() =>
      readHookStatusReports({ settingsPath, hooksPath }),
    ).not.toThrow();
    const reports = readHookStatusReports({ settingsPath, hooksPath });
    expect(reports[0]).toMatchObject({
      tool: "claude-code",
      installed: false,
      mode: "unknown",
    });
    expect(reports[1]).toMatchObject({
      tool: "codex",
      installed: false,
      mode: "unknown",
    });
  });
});

describe("formatHookStatusReports", () => {
  it("renders installed and not-installed lines together", () => {
    const reports: HookStatusReport[] = [
      {
        tool: "claude-code",
        installed: true,
        mode: "ask",
        minScore: 80,
        configPath: "/example/.claude/settings.json",
      },
      {
        tool: "codex",
        installed: false,
        mode: "unknown",
        configPath: "/example/.codex/hooks.json",
      },
    ];

    const output = formatHookStatusReports(reports);

    expect(output).toContain("- claude-code: ask");
    expect(output).toContain("minScore=80");
    expect(output).toContain("- codex: not installed");
    expect(output).toContain("/prompt-memory:guard");
  });
});
