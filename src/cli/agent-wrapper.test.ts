import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import {
  createAgentWrapperPlan,
  parseWrapperArgs,
  runAgentWrapper,
} from "./agent-wrapper.js";

describe("agent wrapper", () => {
  it("rewrites Claude initial prompt in auto mode without leaking raw secrets", async () => {
    const parsed = parseWrapperArgs("claude", [
      "--pm-mode",
      "auto",
      "--pm-min-score",
      "100",
      "--model",
      "sonnet",
      "fix this with sk-proj-1234567890abcdef",
    ]);

    const plan = await createAgentWrapperPlan(parsed, {
      tool: "claude",
      now: new Date("2026-05-03T00:00:00.000Z"),
      isTTY: false,
      stdin: process.stdin,
      stdout: process.stdout,
    });

    expect(plan.command).toBe("claude");
    expect(plan.args[1]).toBe("sonnet");
    expect(plan.prompt?.changed).toBe(true);
    expect(plan.prompt?.reason).toBe("rewritten");
    expect(plan.prompt?.selectedPrompt).toContain("Please work from");
    expect(plan.prompt?.selectedPrompt).not.toContain(
      "sk-proj-1234567890abcdef",
    );
  });

  it("treats Claude -p as a forwarded flag and still rewrites the following prompt", async () => {
    const parsed = parseWrapperArgs("claude", [
      "--pm-auto",
      "-p",
      "fix this with sk-proj-1234567890abcdef",
    ]);

    const plan = await createAgentWrapperPlan(parsed, {
      tool: "claude",
      now: new Date("2026-05-03T00:00:00.000Z"),
      isTTY: false,
      stdin: process.stdin,
      stdout: process.stdout,
    });

    expect(plan.args[0]).toBe("-p");
    expect(plan.prompt?.originalIndex).toBe(1);
    expect(plan.prompt?.changed).toBe(true);
    expect(plan.prompt?.selectedPrompt).not.toContain(
      "sk-proj-1234567890abcdef",
    );
  });

  it("rewrites Codex default initial prompt and preserves forwarded options", async () => {
    const parsed = parseWrapperArgs("codex", [
      "--pm-auto",
      "-m",
      "gpt-5.5",
      "-C",
      "/tmp/project",
      "fix",
    ]);

    const plan = await createAgentWrapperPlan(parsed, {
      tool: "codex",
      now: new Date("2026-05-03T00:00:00.000Z"),
      isTTY: false,
      stdin: process.stdin,
      stdout: process.stdout,
    });

    expect(plan.args.slice(0, 4)).toEqual([
      "-m",
      "gpt-5.5",
      "-C",
      "/tmp/project",
    ]);
    expect(plan.prompt?.originalIndex).toBe(4);
    expect(plan.prompt?.changed).toBe(true);
  });

  it("rewrites Codex exec prompts but passes through management subcommands", async () => {
    const execPlan = await createAgentWrapperPlan(
      parseWrapperArgs("codex", ["--pm-mode", "auto", "exec", "fix"]),
      {
        tool: "codex",
        now: new Date("2026-05-03T00:00:00.000Z"),
        isTTY: false,
        stdin: process.stdin,
        stdout: process.stdout,
      },
    );
    const mcpPlan = await createAgentWrapperPlan(
      parseWrapperArgs("codex", ["--pm-mode", "auto", "mcp", "list"]),
      {
        tool: "codex",
        now: new Date("2026-05-03T00:00:00.000Z"),
        isTTY: false,
        stdin: process.stdin,
        stdout: process.stdout,
      },
    );

    expect(execPlan.prompt?.changed).toBe(true);
    expect(execPlan.args[0]).toBe("exec");
    expect(mcpPlan.prompt).toBeUndefined();
    expect(mcpPlan.args).toEqual(["mcp", "list"]);
  });

  it("--pm-help prints working examples for each pm-* flag", async () => {
    const stdout = new MemoryWritable();
    const spawn = vi.fn();

    const exitCode = await runAgentWrapper({
      tool: "claude",
      argv: ["--pm-help"],
      stdout: stdout as NodeJS.WriteStream,
      stdin: process.stdin,
      isTTY: false,
      spawn,
    });

    expect(exitCode).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
    expect(stdout.output).toContain("Examples:");
    expect(stdout.output).toContain("--pm-mode off");
    expect(stdout.output).toContain("--pm-language ko");
    expect(stdout.output).toContain("--pm-dry-run");
  });

  it("dry-run prints the selected prompt plan and does not spawn the agent", async () => {
    const stdout = new MemoryWritable();
    const spawn = vi.fn();

    const exitCode = await runAgentWrapper({
      tool: "claude",
      argv: ["--pm-mode", "auto", "--pm-dry-run", "fix"],
      now: new Date("2026-05-03T00:00:00.000Z"),
      stdout: stdout as NodeJS.WriteStream,
      stdin: process.stdin,
      isTTY: false,
      spawn,
    });
    const payload = JSON.parse(stdout.output) as {
      prompt: { changed: boolean; selected_prompt: string };
    };

    expect(exitCode).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
    expect(payload.prompt.changed).toBe(true);
    expect(payload.prompt.selected_prompt).toContain("Please work from");
  });

  it("rejects an unsupported --pm-mode value instead of silently keeping the default", () => {
    expect(() =>
      parseWrapperArgs("claude", ["--pm-mode", "madeup", "fix"]),
    ).toThrow(/Unsupported --pm-mode: madeup\. Use ask, auto, or off\./);
    expect(() =>
      parseWrapperArgs("claude", ["--pm-mode", "asks", "fix"]),
    ).toThrow(/Unsupported --pm-mode: asks/);
    // Valid modes still parse.
    expect(
      parseWrapperArgs("claude", ["--pm-mode", "ask", "fix"]).wrapper.mode,
    ).toBe("ask");
    expect(
      parseWrapperArgs("claude", ["--pm-mode", "auto", "fix"]).wrapper.mode,
    ).toBe("auto");
    expect(
      parseWrapperArgs("claude", ["--pm-mode", "off", "fix"]).wrapper.mode,
    ).toBe("off");
  });
});

class MemoryWritable extends Writable {
  output = "";

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.output += chunk.toString();
    callback();
  }
}
