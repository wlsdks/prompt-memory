import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { initializePromptMemory } from "../../config/config.js";
import { redactPrompt } from "../../redaction/redact.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import { createProgram } from "../index.js";
import { improvePromptForCli } from "./improve.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("improve CLI", () => {
  it("describes the improve command in top-level help", () => {
    const help = createProgram().helpInformation();

    expect(help).toMatch(
      /improve \[options\]\s+Generate an approval-ready improved prompt locally\./,
    );
  });

  it("prints JSON improvement results from text input", () => {
    const output = improvePromptForCli({
      json: true,
      text: "Make this better",
    });
    const parsed = JSON.parse(output) as {
      improved_prompt: string;
      requires_user_approval: boolean;
    };

    expect(parsed.requires_user_approval).toBe(true);
    expect(parsed.improved_prompt).toContain("Verification");
    expect(parsed.improved_prompt).toContain("Output");
  });

  it("requires explicit text or stdin", () => {
    expect(() => improvePromptForCli({ json: true })).toThrow(
      "--text or --stdin is required",
    );
  });

  it("includes a runnable example in the missing-input error", () => {
    expect(() => improvePromptForCli({ json: true })).toThrow(
      /prompt-memory improve --text/,
    );
  });

  it("renders clarifying questions in the human output for weak prompts (ASK-FIRST)", () => {
    const output = improvePromptForCli({ text: "Make this better" });

    // Without this, ASK-FIRST is invisible to terminal users — the JSON
    // path always carried clarifying_questions, but the human formatter
    // dropped them.
    expect(output).toMatch(/Clarifying questions/i);
    expect(output).toMatch(/^\s*1\./m);
  });

  it("renders Korean clarifying questions for Korean prompts in human output", () => {
    const output = improvePromptForCli({ text: "더 잘 만들어주세요" });

    expect(output).toContain("확인");
    expect(output).toMatch(/[가-힣]/);
    expect(output).toMatch(/^\s*1\./m);
  });

  it("omits the clarifying-questions section when none are needed", () => {
    const output = improvePromptForCli({
      text: "Because the export review is unclear, inspect src/web/src/App.tsx only, run pnpm test, and return a Markdown summary.",
    });

    expect(output).not.toMatch(/Clarifying questions/i);
    expect(output).not.toMatch(/명확화 질문|확인 질문/);
  });

  it("prints a privacy-safe improvement for the latest stored prompt", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T14:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-latest-improve",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/private-project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Make this better with token sk-proj-1234567890abcdef",
      },
      new Date("2026-05-03T13:59:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();

    const json = improvePromptForCli({ dataDir, json: true, latest: true });
    const result = JSON.parse(json) as {
      source: string;
      mode: string;
      requires_user_approval: boolean;
      improved_prompt: string;
      privacy: { returns_stored_prompt_body: boolean };
    };

    expect(result.source).toBe("latest");
    expect(result.mode).toBe("copy");
    expect(result.requires_user_approval).toBe(true);
    expect(result.improved_prompt).toContain("Verification");
    expect(result.privacy.returns_stored_prompt_body).toBe(false);
    expect(json).not.toContain("sk-proj-1234567890abcdef");
    expect(json).not.toContain("/Users/example");
  });

  it("applies user --answer values verbatim into the improved draft (ASK-FIRST round-trip)", () => {
    const json = improvePromptForCli({
      json: true,
      text: "fix the bug",
      answer: [
        "goal=Fix the 500 in DELETE /api/v1/prompts/:id route handler.",
        "context=Delete returns 500 because FTS sync is missing after the row deletes.",
      ],
    });
    const result = JSON.parse(json) as {
      improved_prompt: string;
      changed_sections: string[];
      clarifying_questions: Array<{ axis: string }>;
    };

    expect(result.improved_prompt).toContain("DELETE /api/v1/prompts/:id");
    expect(result.improved_prompt).toContain(
      "Delete returns 500 because FTS sync",
    );
    expect(result.clarifying_questions.map((q) => q.axis)).not.toContain(
      "goal_clarity",
    );
    expect(result.clarifying_questions.map((q) => q.axis)).not.toContain(
      "background_context",
    );
  });

  it("accepts --answer with axis aliases and Korean answer text", () => {
    const text = improvePromptForCli({
      text: "버그 고쳐줘",
      language: "ko",
      answer: [
        "goal=src/server/routes/prompts.ts 의 DELETE 핸들러 500 에러를 고쳐주세요.",
        "background=삭제 후 FTS 동기화가 빠져 500이 떨어지고 있습니다.",
      ],
    });

    expect(text).toContain("## 목표");
    expect(text).toContain("DELETE 핸들러 500");
    expect(text).toContain("## 맥락");
    expect(text).toContain("FTS 동기화가 빠져");
  });

  it("rejects --answer with unknown axis or empty value", () => {
    expect(() =>
      improvePromptForCli({ text: "fix", answer: ["unknown=hi"] }),
    ).toThrow(/axis "unknown" is not recognized/);

    expect(() =>
      improvePromptForCli({ text: "fix", answer: ["goal="] }),
    ).toThrow(/--answer for "goal" is empty/);

    expect(() =>
      improvePromptForCli({ text: "fix", answer: ["just-a-bare-string"] }),
    ).toThrow(/--answer expects "axis=text"/);
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-improve-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
