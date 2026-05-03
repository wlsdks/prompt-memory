import { describe, expect, it } from "vitest";

import { analyzeProjectInstructionFiles } from "./project-instructions.js";

describe("project instruction analysis", () => {
  it("scores concrete AGENTS.md and CLAUDE.md rules without returning file bodies", () => {
    const review = analyzeProjectInstructionFiles(
      [
        {
          file_name: "AGENTS.md",
          content: [
            "# Project",
            "prompt-memory is a local-first developer tool built with TypeScript and SQLite.",
            "Agents must plan in tasks/todo.md, avoid reverting user changes, commit, and push.",
            "Run pnpm test, pnpm lint, pnpm build, and Playwright E2E after UI changes.",
            "Never log secrets, prompt bodies, raw paths, tokens, stdout, or stderr leaks.",
            "Respond in Korean and report verification evidence in the final summary.",
          ].join("\n"),
          bytes: 512,
          modified_at: "2026-05-03T00:00:00.000Z",
          truncated: false,
        },
      ],
      "2026-05-03T00:00:00.000Z",
    );

    expect(review.score).toMatchObject({
      value: 100,
      max: 100,
      band: "excellent",
    });
    expect(review.files).toEqual([
      expect.objectContaining({
        file_name: "AGENTS.md",
        bytes: 512,
        content_hash: expect.stringMatching(/^[a-f0-9]{16}$/),
      }),
    ]);
    expect(review.privacy).toMatchObject({
      local_only: true,
      stores_file_bodies: false,
      returns_file_bodies: false,
      returns_raw_paths: false,
    });
    expect(JSON.stringify(review)).not.toContain("local-first developer tool");
  });

  it("returns actionable suggestions when no project instruction files exist", () => {
    const review = analyzeProjectInstructionFiles(
      [],
      "2026-05-03T00:00:00.000Z",
    );

    expect(review.score).toMatchObject({ value: 0, band: "weak" });
    expect(review.files_found).toBe(0);
    expect(review.suggestions[0]).toContain("Add AGENTS.md or CLAUDE.md");
  });
});
