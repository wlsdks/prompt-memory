import { describe, expect, it } from "vitest";

import {
  createPromptRewriteGuardOutput,
  isAcknowledgment,
} from "./rewrite-guard.js";

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

  describe("ask mode", () => {
    it("does nothing for short prompts even when score is weak", () => {
      const output = createPromptRewriteGuardOutput(
        { prompt: "fix it" },
        { mode: "ask" },
      );

      expect(output).toBeUndefined();
    });

    it("does nothing for leading acknowledgment patterns", () => {
      const output = createPromptRewriteGuardOutput(
        {
          prompt:
            "그래! 이 작업을 진행해주고 끝나면 그 다음 단계도 마저 작업해줘",
        },
        { mode: "ask" },
      );

      expect(output).toBeUndefined();
    });

    it("emits an AskUserQuestion instruction for genuine weak prompts", () => {
      const output = createPromptRewriteGuardOutput(
        {
          prompt: "이 코드 어딘가 이상한데 한번 봐주고 안되면 알아서 고쳐줘",
        },
        { mode: "ask" },
      );

      expect(output).toBeDefined();
      if (output && "hookSpecificOutput" in output && !("decision" in output)) {
        const additionalContext = output.hookSpecificOutput.additionalContext;
        expect(additionalContext).toContain("[prompt-memory coach]");
        expect(additionalContext).toContain("AskUserQuestion");
        expect(additionalContext).toContain("1.");
        expect(additionalContext).not.toContain("decision");
      } else {
        throw new Error("expected ask-mode hook output without decision");
      }
    });

    it("emits English instruction wording for English prompts", () => {
      const output = createPromptRewriteGuardOutput(
        {
          prompt:
            "Refactor the auth middleware and add request rate limiting with sensible defaults.",
        },
        { mode: "ask", language: "en" },
      );

      expect(output).toBeDefined();
      if (output && "hookSpecificOutput" in output && !("decision" in output)) {
        const additionalContext = output.hookSpecificOutput.additionalContext;
        expect(additionalContext).toContain("AskUserQuestion");
        expect(additionalContext).toContain(
          "Do not answer the prompt directly",
        );
      }
    });

    it("does nothing when score already meets the ask threshold", () => {
      const output = createPromptRewriteGuardOutput(
        {
          prompt:
            "Goal: update docs. Context: README changed. Scope: docs only. Verification: run pnpm test. Output: summary.",
        },
        { mode: "ask" },
      );

      expect(output).toBeUndefined();
    });

    it("emits an MCP ask_clarifying_questions instruction for Codex", () => {
      const output = createPromptRewriteGuardOutput(
        {
          prompt: "이 코드 어딘가 이상한데 한번 봐주고 안되면 알아서 고쳐줘",
        },
        { mode: "ask", tool: "codex" },
      );

      expect(output).toBeDefined();
      if (output && "hookSpecificOutput" in output && !("decision" in output)) {
        const additionalContext = output.hookSpecificOutput.additionalContext;
        expect(additionalContext).toContain("ask_clarifying_questions");
        expect(additionalContext).not.toContain("AskUserQuestion 툴을");
      } else {
        throw new Error("expected ask-mode hook output without decision");
      }
    });

    it("keeps the AskUserQuestion instruction for Claude Code", () => {
      const output = createPromptRewriteGuardOutput(
        {
          prompt: "이 코드 어딘가 이상한데 한번 봐주고 안되면 알아서 고쳐줘",
        },
        { mode: "ask", tool: "claude-code" },
      );

      expect(output).toBeDefined();
      if (output && "hookSpecificOutput" in output && !("decision" in output)) {
        const additionalContext = output.hookSpecificOutput.additionalContext;
        expect(additionalContext).toContain("AskUserQuestion");
        expect(additionalContext).not.toContain("ask_clarifying_questions");
      }
    });
  });

  describe("isAcknowledgment", () => {
    it("flags short Korean acknowledgments", () => {
      expect(isAcknowledgment("ㅇㅇ")).toBe(true);
      expect(isAcknowledgment("응")).toBe(true);
      expect(isAcknowledgment("좋아!")).toBe(true);
      expect(isAcknowledgment("고마워")).toBe(true);
      expect(isAcknowledgment("다음으로 가자")).toBe(true);
      expect(isAcknowledgment("그래 진행해줘")).toBe(true);
    });

    it("flags short English acknowledgments", () => {
      expect(isAcknowledgment("ok")).toBe(true);
      expect(isAcknowledgment("yes please")).toBe(true);
      expect(isAcknowledgment("thanks")).toBe(true);
      expect(isAcknowledgment("perfect")).toBe(true);
      expect(isAcknowledgment("let's go")).toBe(true);
    });

    it("does not flag a real ambiguous request", () => {
      expect(
        isAcknowledgment(
          "이 컴포넌트 리팩터링하고 폼 검증도 추가해줘 한국어 에러 메시지로",
        ),
      ).toBe(false);
      expect(
        isAcknowledgment(
          "Refactor the auth middleware and add request rate limiting.",
        ),
      ).toBe(false);
    });

    it("does not treat Korean interrogatives as acknowledgments", () => {
      expect(isAcknowledgment("왜 안되지 한번 봐주고 알아서 고쳐줘")).toBe(
        false,
      );
      expect(isAcknowledgment("뭐가 잘못된 거지 코드 좀 봐줘")).toBe(false);
    });
  });
});
