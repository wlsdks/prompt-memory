import { describe, expect, it } from "vitest";

import {
  defaultPromptMemoryEntry,
  mcpRegistrationCommand,
  mcpRegistrationSpec,
} from "./agent-access.js";

describe("defaultPromptMemoryEntry", () => {
  it("falls back to a PATH-based prompt-memory binary when argv[1] is not a dist entrypoint", () => {
    const entry = defaultPromptMemoryEntry();
    expect(entry).toEqual({ command: "prompt-memory", args: [] });
  });
});

describe("mcpRegistrationSpec with an explicit entry", () => {
  it("registers Codex with the absolute node + dist path so PATH lookup is not required", () => {
    const spec = mcpRegistrationSpec("codex", {
      command: "/usr/local/bin/node",
      args: ["/Users/example/repo/dist/cli/index.js"],
    });

    expect(spec).toEqual({
      command: "codex",
      args: [
        "mcp",
        "add",
        "prompt-memory",
        "--",
        "/usr/local/bin/node",
        "/Users/example/repo/dist/cli/index.js",
        "mcp",
      ],
    });
  });

  it("registers Claude Code with the absolute node + dist path so PATH lookup is not required", () => {
    const spec = mcpRegistrationSpec("claude-code", {
      command: "/usr/local/bin/node",
      args: ["/Users/example/repo/dist/cli/index.js"],
    });

    expect(spec).toEqual({
      command: "claude",
      args: [
        "mcp",
        "add",
        "--transport",
        "stdio",
        "prompt-memory",
        "--",
        "/usr/local/bin/node",
        "/Users/example/repo/dist/cli/index.js",
        "mcp",
      ],
    });
  });

  it("preserves the existing PATH-based phrasing when entry uses prompt-memory directly", () => {
    expect(
      mcpRegistrationCommand("codex", { command: "prompt-memory", args: [] }),
    ).toBe("codex mcp add prompt-memory -- prompt-memory mcp");
    expect(
      mcpRegistrationCommand("claude-code", {
        command: "prompt-memory",
        args: [],
      }),
    ).toBe(
      "claude mcp add --transport stdio prompt-memory -- prompt-memory mcp",
    );
  });
});
