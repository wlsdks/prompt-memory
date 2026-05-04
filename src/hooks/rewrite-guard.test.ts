import { describe, expect, it } from "vitest";

import { createPromptRewriteGuardOutput } from "./rewrite-guard.js";

describe("createPromptRewriteGuardOutput", () => {
  const payload = {
    hook_event_name: "UserPromptSubmit",
    session_id: "session-1",
    cwd: "/repo",
    prompt: "fix",
  };

  it("does nothing unless the guard is explicitly enabled", () => {
    expect(createPromptRewriteGuardOutput(payload)).toBeUndefined();
  });

  it("blocks weak prompts and copies a redacted improvement draft", () => {
    const copied: string[] = [];
    const output = createPromptRewriteGuardOutput(
      {
        ...payload,
        prompt: "fix this with sk-proj-1234567890abcdef",
      },
      {
        mode: "block-and-copy",
        minScore: 100,
        now: new Date("2026-05-03T00:00:00.000Z"),
        copyToClipboard: (text) => {
          copied.push(text);
          return true;
        },
      },
    );

    expect(output).toMatchObject({
      decision: "block",
      hookSpecificOutput: { hookEventName: "UserPromptSubmit" },
    });
    expect(output?.reason).toContain("copied to your clipboard");
    expect(output?.reason).toContain("Improved prompt:");
    expect(output?.reason).not.toContain("sk-proj-1234567890abcdef");
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain("Please work from");
    expect(copied[0]).not.toContain("sk-proj-1234567890abcdef");
  });

  it("adds rewrite guidance as context without blocking in context mode", () => {
    const output = createPromptRewriteGuardOutput(payload, {
      mode: "context",
      minScore: 100,
      now: new Date("2026-05-03T00:00:00.000Z"),
    });

    expect(output).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
      },
    });
    expect("decision" in (output ?? {})).toBe(false);
    expect(output?.hookSpecificOutput.additionalContext).toContain(
      "prompt-memory rewrite guidance",
    );
  });

  it("allows prompts that meet the configured score threshold", () => {
    const output = createPromptRewriteGuardOutput(
      {
        ...payload,
        prompt:
          "Goal: update docs. Context: README changed. Scope: docs only. Verification: run pnpm test. Output: summary.",
      },
      {
        mode: "block-and-copy",
        minScore: 10,
      },
    );

    expect(output).toBeUndefined();
  });

  it("uses Korean headers when the submitted prompt is Korean", () => {
    const output = createPromptRewriteGuardOutput(
      {
        prompt: "더 잘 만들어주세요",
      },
      {
        mode: "block-and-copy",
        copyToClipboard: () => true,
      },
    );

    expect(output).toBeDefined();
    if (output && "decision" in output) {
      expect(output.decision).toBe("block");
      expect(output.reason).toContain("개선된 프롬프트:");
      expect(output.reason).toContain("주의사항:");
      expect(output.reason).toContain("prompt-memory가 이 프롬프트를 제출 전");
      expect(output.reason).not.toContain("Improved prompt:");
    }
  });

  it("uses Korean context header when the submitted prompt is Korean", () => {
    const output = createPromptRewriteGuardOutput(
      {
        prompt: "더 잘 만들어주세요",
      },
      { mode: "context" },
    );

    expect(output).toBeDefined();
    if (output && "hookSpecificOutput" in output && !("decision" in output)) {
      expect(output.hookSpecificOutput.additionalContext).toContain(
        "prompt-memory 개선안 가이드",
      );
      expect(output.hookSpecificOutput.additionalContext).not.toContain(
        "prompt-memory rewrite guidance",
      );
    }
  });
});
