import { describe, expect, it, vi } from "vitest";
import type { SpawnSyncReturns } from "node:child_process";

import { buildJudgePrompt, runAutoJudge } from "./auto-judge.js";

function spawnReturning(
  partial: Partial<SpawnSyncReturns<string>>,
): SpawnSyncReturns<string> {
  return {
    pid: 1,
    output: [],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
    ...partial,
  } as SpawnSyncReturns<string>;
}

describe("runAutoJudge", () => {
  it("parses claude --output-format json wrapper and clamps the score", () => {
    const spawn = vi.fn().mockReturnValue(
      spawnReturning({
        stdout: JSON.stringify({
          type: "result",
          subtype: "success",
          result: '{"score": 145, "reason": "Goal is clear, format missing."}',
        }),
      }),
    );

    const outcome = runAutoJudge({
      tool: "claude",
      redactedPrompt: "Refactor the [REDACTED:path] function.",
      spawn,
    });

    expect(outcome).toEqual({
      kind: "ok",
      score: 100,
      reason: "Goal is clear, format missing.",
    });
    expect(spawn).toHaveBeenCalledWith(
      "claude",
      [
        "-p",
        expect.stringContaining("strict prompt quality judge"),
        "--output-format",
        "json",
      ],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });

  it("parses codex exec stdout when the assistant returns plain JSON", () => {
    const spawn = vi.fn().mockReturnValue(
      spawnReturning({
        stdout: 'Here is my judgement:\n{"score": 72, "reason": "OK."}\n',
      }),
    );

    const outcome = runAutoJudge({
      tool: "codex",
      redactedPrompt: "Add a test for the new helper.",
      spawn,
    });

    expect(outcome).toEqual({
      kind: "ok",
      score: 72,
      reason: "OK.",
    });
    expect(spawn).toHaveBeenCalledWith(
      "codex",
      ["exec", expect.stringContaining("strict prompt quality judge")],
      expect.objectContaining({ encoding: "utf8" }),
    );
  });

  it("skips with cli_missing when spawn reports ENOENT", () => {
    const error = new Error("not found") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    const spawn = vi.fn().mockReturnValue(
      spawnReturning({
        status: null,
        error,
      }),
    );

    const outcome = runAutoJudge({
      tool: "claude",
      redactedPrompt: "anything",
      spawn,
    });

    expect(outcome).toEqual({ kind: "skipped", reason: "cli_missing" });
  });

  it("skips with non_zero_exit when the CLI returns a failure status", () => {
    const spawn = vi.fn().mockReturnValue(
      spawnReturning({
        status: 1,
        stderr: "auth required",
      }),
    );

    const outcome = runAutoJudge({
      tool: "claude",
      redactedPrompt: "anything",
      spawn,
    });

    expect(outcome).toEqual({ kind: "skipped", reason: "non_zero_exit" });
  });

  it("skips with invalid_output when the wrapper JSON is malformed", () => {
    const spawn = vi.fn().mockReturnValue(
      spawnReturning({
        stdout: "not json at all",
      }),
    );

    const outcome = runAutoJudge({
      tool: "claude",
      redactedPrompt: "anything",
      spawn,
    });

    expect(outcome).toEqual({ kind: "skipped", reason: "invalid_output" });
  });

  it("skips with invalid_output when the inner result is missing a score", () => {
    const spawn = vi.fn().mockReturnValue(
      spawnReturning({
        stdout: JSON.stringify({
          result: '{"reason": "no score field"}',
        }),
      }),
    );

    const outcome = runAutoJudge({
      tool: "claude",
      redactedPrompt: "anything",
      spawn,
    });

    expect(outcome).toEqual({ kind: "skipped", reason: "invalid_output" });
  });

  it("skips with timeout when spawn signals SIGTERM", () => {
    const spawn = vi.fn().mockReturnValue(
      spawnReturning({
        status: null,
        signal: "SIGTERM",
      }),
    );

    const outcome = runAutoJudge({
      tool: "claude",
      redactedPrompt: "anything",
      spawn,
      timeoutMs: 1,
    });

    expect(outcome).toEqual({ kind: "skipped", reason: "timeout" });
  });

  it("skips with empty_prompt and never spawns when the redacted prompt is blank", () => {
    const spawn = vi.fn();

    const outcome = runAutoJudge({
      tool: "claude",
      redactedPrompt: "   \n  ",
      spawn,
    });

    expect(outcome).toEqual({ kind: "skipped", reason: "empty_prompt" });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("includes the redacted prompt verbatim in the judge prompt body", () => {
    const judgePrompt = buildJudgePrompt(
      "Add tests for [REDACTED:path] handler",
    );

    expect(judgePrompt).toContain("Add tests for [REDACTED:path] handler");
    expect(judgePrompt).toContain("score");
    expect(judgePrompt).toContain("reason");
  });
});
