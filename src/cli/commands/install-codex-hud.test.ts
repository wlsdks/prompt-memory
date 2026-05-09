import { describe, expect, it } from "vitest";

import {
  buildBuddyArgv,
  buildTmuxSplitArgv,
  detectMultiplexer,
  renderCodexHudInstall,
  type CodexHudOptions,
} from "./install-codex-hud.js";

describe("detectMultiplexer", () => {
  it("returns 'tmux' when TMUX env var is present", () => {
    expect(
      detectMultiplexer({ env: { TMUX: "/tmp/tmux-501/default,123,0" } }),
    ).toBe("tmux");
  });

  it("returns 'cmux' when cmux binary is available and no TMUX env", () => {
    expect(detectMultiplexer({ env: {}, hasCmux: true })).toBe("cmux");
  });

  it("returns 'none' when neither tmux nor cmux is detected", () => {
    expect(detectMultiplexer({ env: {}, hasCmux: false })).toBe("none");
  });

  it("prefers TMUX over cmux when both are present", () => {
    expect(detectMultiplexer({ env: { TMUX: "x" }, hasCmux: true })).toBe(
      "tmux",
    );
  });
});

describe("buildTmuxSplitArgv", () => {
  const buddyArgv = ["/path/node", "/path/cli.js", "buddy", "--style", "block"];

  it("right pane → split-window -h", () => {
    const argv = buildTmuxSplitArgv({ pane: "right", buddyArgv });
    expect(argv[0]).toBe("tmux");
    expect(argv[1]).toBe("split-window");
    expect(argv).toContain("-h");
    expect(argv).not.toContain("-b");
    expect(argv.slice(-buddyArgv.length)).toEqual(buddyArgv);
  });

  it("left pane → split-window -h -b", () => {
    const argv = buildTmuxSplitArgv({ pane: "left", buddyArgv });
    expect(argv).toContain("-h");
    expect(argv).toContain("-b");
  });

  it("top pane → split-window -v -b", () => {
    const argv = buildTmuxSplitArgv({ pane: "top", buddyArgv });
    expect(argv).toContain("-v");
    expect(argv).toContain("-b");
  });

  it("bottom pane → split-window -v", () => {
    const argv = buildTmuxSplitArgv({ pane: "bottom", buddyArgv });
    expect(argv).toContain("-v");
    expect(argv).not.toContain("-b");
  });
});

describe("buildBuddyArgv", () => {
  it("uses absolute node + cli paths and forwards style/interval", () => {
    const argv = buildBuddyArgv({
      nodePath: "/usr/local/bin/node",
      cliEntryPath: "/path/to/cli.js",
      style: "block",
      interval: 5,
    });
    expect(argv).toEqual([
      "/usr/local/bin/node",
      "/path/to/cli.js",
      "buddy",
      "--style",
      "block",
      "--interval",
      "5",
    ]);
  });

  it("forwards --data-dir when provided", () => {
    const argv = buildBuddyArgv({
      nodePath: "/usr/local/bin/node",
      cliEntryPath: "/path/cli.js",
      style: "line",
      interval: 2,
      dataDir: "/tmp/data",
    });
    expect(argv).toContain("--data-dir");
    expect(argv).toContain("/tmp/data");
  });
});

describe("renderCodexHudInstall (dry-run / instructions)", () => {
  const baseOptions: CodexHudOptions = {
    pane: "right",
    style: "block",
    interval: 5,
    dryRun: true,
    nodePath: "/usr/local/bin/node",
    cliEntryPath: "/path/cli.js",
  };

  it("tmux: dry-run prints the tmux split-window argv and does not execute", () => {
    const result = renderCodexHudInstall({
      ...baseOptions,
      multiplexer: "tmux",
    });
    expect(result.executed).toBe(false);
    expect(result.text).toContain("tmux split-window");
    expect(result.text).toContain("buddy");
    expect(result.text).toContain("--style");
    expect(result.text).toContain("block");
  });

  it("cmux: returns instructions to open a pane manually", () => {
    const result = renderCodexHudInstall({
      ...baseOptions,
      multiplexer: "cmux",
    });
    expect(result.executed).toBe(false);
    expect(result.text.toLowerCase()).toContain("cmux");
    expect(result.text).toContain("prompt-coach buddy");
  });

  it("none: returns instructions for a separate terminal pane", () => {
    const result = renderCodexHudInstall({
      ...baseOptions,
      multiplexer: "none",
    });
    expect(result.executed).toBe(false);
    expect(result.text).toContain("prompt-coach buddy");
    expect(result.text.toLowerCase()).toContain("terminal");
  });

  it("--json returns a stable structured payload", () => {
    const result = renderCodexHudInstall({
      ...baseOptions,
      multiplexer: "tmux",
      json: true,
    });
    const parsed = JSON.parse(result.text) as {
      multiplexer: string;
      executed: boolean;
      command: string[];
    };
    expect(parsed.multiplexer).toBe("tmux");
    expect(parsed.executed).toBe(false);
    expect(parsed.command[0]).toBe("tmux");
  });

  it("rejects unsupported --pane values", () => {
    expect(() =>
      renderCodexHudInstall({
        ...baseOptions,
        multiplexer: "tmux",
        pane: "weird" as never,
      }),
    ).toThrow(/pane/);
  });

  it("rejects unsupported --style values", () => {
    expect(() =>
      renderCodexHudInstall({
        ...baseOptions,
        multiplexer: "tmux",
        style: "weird" as never,
      }),
    ).toThrow(/style/);
  });
});
