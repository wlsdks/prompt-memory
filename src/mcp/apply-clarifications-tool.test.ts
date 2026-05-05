import { describe, expect, it } from "vitest";

import { applyClarificationsTool } from "./apply-clarifications-tool.js";

describe("applyClarificationsTool", () => {
  it("composes a draft from the user's verbatim answer and drops the answered question", () => {
    const result = applyClarificationsTool({
      prompt: "Make this better",
      language: "en",
      answers: [
        {
          question_id: "q_verification_criteria",
          axis: "verification_criteria",
          answer: "Run pnpm test and confirm 0 failures.",
          origin: "user",
        },
      ],
    });

    if ("is_error" in result) {
      throw new Error("applyClarificationsTool returned an error");
    }

    expect(result.source).toBe("text");
    expect(result.rewrite_source).toBe("direct_prompt");
    expect(result.answers_count).toBe(1);
    expect(
      result.clarifying_questions.some(
        (q) => q.axis === "verification_criteria",
      ),
    ).toBe(false);
    expect(result.improved_prompt).toContain("pnpm test");
    expect(result.privacy).toEqual({
      local_only: true,
      stores_input: false,
      external_calls: false,
      returns_stored_prompt_body: false,
    });
  });

  it("rejects answers whose origin is not 'user'", () => {
    const result = applyClarificationsTool({
      prompt: "Make this better",
      answers: [
        {
          question_id: "q_verification_criteria",
          axis: "verification_criteria",
          answer: "Run pnpm test",
          origin: "agent",
        },
      ],
    });

    expect("is_error" in result && result.is_error).toBe(true);
    if (!("is_error" in result)) return;
    expect(result.error_code).toBe("invalid_input");
    expect(result.message).toContain("origin");
  });

  it("rejects empty prompt or empty answers", () => {
    const noPrompt = applyClarificationsTool({
      prompt: "",
      answers: [
        {
          question_id: "q_verification_criteria",
          axis: "verification_criteria",
          answer: "Run pnpm test",
          origin: "user",
        },
      ],
    });
    const noAnswers = applyClarificationsTool({
      prompt: "Make this better",
      answers: [],
    });

    expect("is_error" in noPrompt && noPrompt.is_error).toBe(true);
    expect("is_error" in noAnswers && noAnswers.is_error).toBe(true);
  });

  it("switches next_action to copy/resubmit when every clarifying axis is satisfied", () => {
    const result = applyClarificationsTool({
      prompt: "Make this better",
      language: "en",
      answers: [
        {
          question_id: "q_goal_clarity",
          axis: "goal_clarity",
          answer: "Fix the delete API bug in src/server/routes/prompts.ts.",
          origin: "user",
        },
        {
          question_id: "q_background_context",
          axis: "background_context",
          answer:
            "The current delete endpoint returns 500 because of a missing FTS sync.",
          origin: "user",
        },
        {
          question_id: "q_scope_limits",
          axis: "scope_limits",
          answer:
            "Only touch the delete route; keep the rest of storage unchanged.",
          origin: "user",
        },
        {
          question_id: "q_output_format",
          axis: "output_format",
          answer: "Return a Markdown summary of the diff and tests run.",
          origin: "user",
        },
        {
          question_id: "q_verification_criteria",
          axis: "verification_criteria",
          answer: "Run pnpm test and confirm 0 failures.",
          origin: "user",
        },
      ],
    });

    if ("is_error" in result) {
      throw new Error("applyClarificationsTool returned an error");
    }

    expect(result.clarifying_questions).toEqual([]);
    expect(result.next_action).toContain("Review the draft");
    expect(result.next_action).not.toContain("Ask the user");
  });

  it("does not leak raw answer secrets into the rendered draft", () => {
    const result = applyClarificationsTool({
      prompt: "Make this better",
      answers: [
        {
          question_id: "q_verification_criteria",
          axis: "verification_criteria",
          answer: "Run pnpm test with token sk-proj-1234567890abcdef",
          origin: "user",
        },
      ],
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("sk-proj-1234567890abcdef");
  });

  it("rejects whitespace-only answers as invalid input", () => {
    const result = applyClarificationsTool({
      prompt: "Make this better",
      answers: [
        {
          question_id: "q_verification_criteria",
          axis: "verification_criteria",
          answer: "   \n\t  ",
          origin: "user",
        },
      ],
    });

    expect("is_error" in result && result.is_error).toBe(true);
    if (!("is_error" in result)) return;
    expect(result.error_code).toBe("invalid_input");
    expect(result.message).toContain("non-empty");
  });

  it("rejects unknown quality axes as invalid input", () => {
    const result = applyClarificationsTool({
      prompt: "Make this better",
      answers: [
        {
          question_id: "q_unknown",
          axis: "not_a_real_axis",
          answer: "Some answer",
          origin: "user",
        },
      ],
    });

    expect("is_error" in result && result.is_error).toBe(true);
    if (!("is_error" in result)) return;
    expect(result.error_code).toBe("invalid_input");
    expect(result.message.toLowerCase()).toContain("axis");
  });

  it("applies multi-axis answers and reports the remaining axes through next_action", () => {
    const result = applyClarificationsTool({
      prompt: "Make this better",
      language: "en",
      answers: [
        {
          question_id: "q_goal_clarity",
          axis: "goal_clarity",
          answer: "Fix the delete API bug in src/server/routes/prompts.ts.",
          origin: "user",
        },
        {
          question_id: "q_verification_criteria",
          axis: "verification_criteria",
          answer: "Run pnpm test and confirm 0 failures.",
          origin: "user",
        },
      ],
    });

    if ("is_error" in result) {
      throw new Error("applyClarificationsTool returned an error");
    }

    expect(result.answers_count).toBe(2);
    const remaining = new Set(
      result.clarifying_questions.map((question) => question.axis),
    );
    expect(remaining.has("goal_clarity")).toBe(false);
    expect(remaining.has("verification_criteria")).toBe(false);
    if (result.clarifying_questions.length > 0) {
      expect(result.next_action).toContain("Ask the user");
    } else {
      expect(result.next_action).toContain("Review the draft");
    }
  });
});
