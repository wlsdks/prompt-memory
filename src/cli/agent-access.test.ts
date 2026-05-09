import { describe, expect, it } from "vitest";

import {
  defaultPromptCoachEntry,
  mcpRegistrationCommand,
  mcpRegistrationSpec,
} from "./agent-access.js";

describe("defaultPromptCoachEntry", () => {
  it("falls back to a PATH-based prompt-coach binary when argv[1] is not a dist entrypoint", () => {
    const entry = defaultPromptCoachEntry();
    expect(entry).toEqual({ command: "prompt-coach", args: [] });
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
        "prompt-coach",
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
        "prompt-coach",
        "--",
        "/usr/local/bin/node",
        "/Users/example/repo/dist/cli/index.js",
        "mcp",
      ],
    });
  });

  it("preserves the existing PATH-based phrasing when entry uses prompt-coach directly", () => {
    expect(
      mcpRegistrationCommand("codex", { command: "prompt-coach", args: [] }),
    ).toBe("codex mcp add prompt-coach -- prompt-coach mcp");
    expect(
      mcpRegistrationCommand("claude-code", {
        command: "prompt-coach",
        args: [],
      }),
    ).toBe("claude mcp add --transport stdio prompt-coach -- prompt-coach mcp");
  });
});
