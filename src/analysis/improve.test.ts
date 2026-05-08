import { describe, expect, it } from "vitest";

import { applyClarifications, improvePrompt } from "./improve.js";

describe("improvePrompt", () => {
  it("turns vague prompts into an approval-ready structured prompt", () => {
    const result = improvePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-02T10:00:00.000Z",
    });

    expect(result.improved_prompt).toContain("Goal");
    expect(result.improved_prompt).toContain("Scope");
    expect(result.improved_prompt).toContain("Verification");
    expect(result.improved_prompt).toContain("Output");
    expect(result.mode).toBe("copy");
    expect(result.requires_user_approval).toBe(true);
    expect(result.changed_sections).toEqual(
      expect.arrayContaining([
        "goal_clarity",
        "background_context",
        "scope_limits",
        "output_format",
        "verification_criteria",
      ]),
    );
    expect(result.summary).toContain("resubmit");
  });

  it("preserves concrete user intent without inventing files or commands", () => {
    const result = improvePrompt({
      prompt:
        "Fix the delete API bug in src/server/routes/prompts.ts. Run pnpm test and return a summary.",
      createdAt: "2026-05-02T10:00:00.000Z",
    });

    expect(result.improved_prompt).toContain("src/server/routes/prompts.ts");
    expect(result.improved_prompt).toContain("delete API");
    expect(result.improved_prompt).toContain("pnpm test");
    expect(result.improved_prompt).not.toContain("src/storage/sqlite.ts");
    expect(result.changed_sections).not.toContain("goal_clarity");
  });

  it("does not reintroduce raw secret values from redacted prompts", () => {
    const result = improvePrompt({
      prompt: "Debug this request with [REDACTED:api_key]",
      createdAt: "2026-05-02T10:00:00.000Z",
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("sk-proj");
    expect(serialized).not.toContain("[REDACTED:api_key]");
    expect(result.safety_notes).toContain(
      "Sensitive placeholders were not copied into the improvement draft.",
    );
  });

  it("masks raw secrets before building the improved prompt", () => {
    const rawSecret = "sk-proj-1234567890abcdef";
    const result = improvePrompt({
      prompt: `Debug this request with ${rawSecret}`,
      createdAt: "2026-05-02T10:00:00.000Z",
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(rawSecret);
    expect(result.improved_prompt).toContain("sensitive content");
    expect(result.safety_notes).toContain(
      "Sensitive content was represented only after mask redaction.",
    );
  });

  it("auto-detects Korean prompts and produces a Korean draft when language is unset", () => {
    const result = improvePrompt({
      prompt: "더 잘 만들어주세요",
      createdAt: "2026-05-04T00:00:00.000Z",
    });

    expect(result.improved_prompt).toContain("## 목표");
    expect(result.improved_prompt).toContain("## 검증");
    expect(result.improved_prompt).toContain("## 출력");
  });

  it("keeps the English draft for prompts with only a few Korean tokens", () => {
    const result = improvePrompt({
      prompt:
        "Fix the delete API bug in src/server/routes/prompts.ts. Run pnpm test and return a summary. (메모: 한국어 한 줄)",
      createdAt: "2026-05-04T00:00:00.000Z",
    });

    expect(result.improved_prompt).toContain("## Goal");
    expect(result.improved_prompt).not.toContain("## 목표");
  });

  it("respects an explicit language override over auto-detection", () => {
    const result = improvePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-04T00:00:00.000Z",
      language: "ko",
    });

    expect(result.improved_prompt).toContain("## 목표");
    expect(result.improved_prompt).not.toContain("## Goal");
  });

  it("emits up to two clarifying questions for weak prompts and caps the list", () => {
    const result = improvePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "en",
    });

    expect(result.clarifying_questions.length).toBeGreaterThanOrEqual(1);
    expect(result.clarifying_questions.length).toBeLessThanOrEqual(2);
    for (const question of result.clarifying_questions) {
      expect(question.id).toBe(`q_${question.axis}`);
      expect(question.ask.length).toBeGreaterThan(0);
      expect(question.ask).not.toMatch(/^[A-Z][^?]*$/);
    }
    const ids = result.clarifying_questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns no clarifying questions when every quality axis is satisfied", () => {
    const result = improvePrompt({
      prompt:
        "Because the export review is unclear, inspect src/web/src/App.tsx only, run pnpm test, and return a Markdown summary.",
      createdAt: "2026-05-05T00:00:00.000Z",
    });

    expect(result.changed_sections).toEqual([]);
    expect(result.clarifying_questions).toEqual([]);
  });

  it("uses Korean question text for Korean prompts", () => {
    const result = improvePrompt({
      prompt: "더 잘 만들어주세요",
      createdAt: "2026-05-05T00:00:00.000Z",
    });

    expect(result.clarifying_questions.length).toBeGreaterThan(0);
    for (const question of result.clarifying_questions) {
      expect(question.ask).toMatch(/[가-힣]/);
    }
  });

  it("does not leak raw prompt body or secrets into clarifying_questions", () => {
    const result = improvePrompt({
      prompt: "Fix /Users/example/project/src/foo.ts with sk-proj-123abc",
      createdAt: "2026-05-05T00:00:00.000Z",
    });
    const serialized = JSON.stringify(result.clarifying_questions);

    expect(serialized).not.toContain("sk-proj-123abc");
    expect(serialized).not.toContain("/Users/example");
    expect(serialized).not.toContain("foo.ts");
  });

  it("populates answer_schema with non-empty string examples for every clarifying question", () => {
    const result = improvePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "en",
    });

    expect(result.clarifying_questions.length).toBeGreaterThan(0);
    for (const question of result.clarifying_questions) {
      expect(question.answer_schema.type).toBe("string");
      expect(question.answer_schema.examples.length).toBeGreaterThan(0);
      for (const example of question.answer_schema.examples) {
        expect(typeof example).toBe("string");
        expect(example.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("uses Korean examples for Korean prompts", () => {
    const result = improvePrompt({
      prompt: "더 잘 만들어주세요",
      createdAt: "2026-05-05T00:00:00.000Z",
    });

    expect(result.clarifying_questions.length).toBeGreaterThan(0);
    for (const question of result.clarifying_questions) {
      const joined = question.answer_schema.examples.join(" ");
      expect(joined).toMatch(/[가-힣]/);
    }
  });

  it("only emits clarifying questions for axes that are also in changed_sections", () => {
    const samples = [
      "Make this better",
      "Fix the bug",
      "Refactor src/web/src/App.tsx but keep current behavior",
      "Run pnpm test and return Markdown summary",
      "더 잘 만들어주세요",
    ];

    for (const prompt of samples) {
      const result = improvePrompt({
        prompt,
        createdAt: "2026-05-05T00:00:00.000Z",
      });
      const changed = new Set(result.changed_sections);
      for (const question of result.clarifying_questions) {
        expect(changed.has(question.axis)).toBe(true);
      }
    }
  });
});

describe("applyClarifications", () => {
  it("drops a question whose axis the user just answered", () => {
    const baseline = improvePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "en",
    });
    const askedAxis = baseline.clarifying_questions[0]?.axis;
    expect(askedAxis).toBeDefined();

    const answered = applyClarifications({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "en",
      answers: [
        {
          question_id: `q_${askedAxis!}`,
          axis: askedAxis!,
          answer: "Fix the delete API bug in src/server/routes/prompts.ts.",
          origin: "user",
        },
      ],
    });

    expect(
      answered.clarifying_questions.some((q) => q.axis === askedAxis),
    ).toBe(false);
    expect(answered.changed_sections).not.toContain(askedAxis!);
    expect(answered.improved_prompt).toContain("delete API");
  });

  it("returns the baseline improvement when no valid user answers are present", () => {
    const baseline = improvePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "en",
    });
    const noAnswers = applyClarifications({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "en",
      answers: [],
    });

    expect(noAnswers.clarifying_questions).toEqual(
      baseline.clarifying_questions,
    );
    expect(noAnswers.changed_sections).toEqual(baseline.changed_sections);
  });

  it("ignores answers whose origin is not 'user'", () => {
    const baseline = improvePrompt({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "en",
    });
    const askedAxis = baseline.clarifying_questions[0]?.axis;
    expect(askedAxis).toBeDefined();

    const ignored = applyClarifications({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "en",
      answers: [
        {
          question_id: `q_${askedAxis!}`,
          axis: askedAxis!,
          answer: "Fix the delete API bug in src/server/routes/prompts.ts.",
          origin: "agent" as unknown as "user",
        },
      ],
    });

    expect(ignored.clarifying_questions.some((q) => q.axis === askedAxis)).toBe(
      true,
    );
    expect(ignored.changed_sections).toContain(askedAxis!);
  });

  it("redacts secrets pasted into a user answer before composing the draft", () => {
    const result = applyClarifications({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "en",
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

  it("drops every axis the user answered and keeps the unanswered axes in the question list", () => {
    const result = applyClarifications({
      prompt: "Make this better",
      createdAt: "2026-05-05T00:00:00.000Z",
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
            "Current delete returns 500 because of a missing FTS sync after delete.",
          origin: "user",
        },
      ],
    });

    const remainingAxes = new Set(
      result.clarifying_questions.map((question) => question.axis),
    );
    expect(remainingAxes.has("goal_clarity")).toBe(false);
    expect(remainingAxes.has("background_context")).toBe(false);
    expect(result.changed_sections).not.toContain("goal_clarity");
    expect(result.changed_sections).not.toContain("background_context");
    expect(result.improved_prompt).toContain("delete API");
    expect(result.improved_prompt).toContain("FTS sync");
  });

  it("keeps Korean section labels and bodies when language=ko and the answer is Korean", () => {
    const result = applyClarifications({
      prompt: "더 잘 만들어주세요",
      createdAt: "2026-05-05T00:00:00.000Z",
      language: "ko",
      answers: [
        {
          question_id: "q_goal_clarity",
          axis: "goal_clarity",
          answer: "src/server/routes/prompts.ts 의 삭제 API 버그를 고쳐주세요.",
          origin: "user",
        },
      ],
    });

    expect(result.improved_prompt).toContain("## 목표");
    expect(result.improved_prompt).not.toContain("## Goal");
    expect(result.improved_prompt).toContain("삭제 API 버그");
  });
});

describe("improvePrompt — Korean template doesn't fabricate certainty about axes that just happen to score well", () => {
  it("does not echo the raw prompt under ## 목표 when goal_clarity is judged OK (the prompt is already shown under ## 원문)", () => {
    const prompt =
      "Refactor authentication module: goal=migrate to OAuth 2.0. Background: legacy session-based. Scope: only auth dir. Output: PR with tests. Verify: pnpm test green.";

    const result = improvePrompt({
      prompt,
      createdAt: "2026-05-08T00:00:00.000Z",
      language: "ko",
    });

    expect(result.changed_sections).toEqual([]);

    const goalSection = result.improved_prompt
      .split("\n## ")
      .find((part) => part.startsWith("목표"));
    expect(goalSection).toBeDefined();
    expect(goalSection ?? "").not.toContain("Refactor authentication module");
  });

  it("does not claim '원문에 명시된 검증 명령' when the original prompt provides no concrete command", () => {
    const prompt =
      "Refactor authentication module: goal=migrate to OAuth 2.0. Background: legacy session-based. Scope: only auth dir. Output: PR with tests. Verify: pnpm test green.";

    const result = improvePrompt({
      prompt,
      createdAt: "2026-05-08T00:00:00.000Z",
      language: "ko",
    });

    expect(result.improved_prompt).not.toContain("원문에 명시된");
  });
});
