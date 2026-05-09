import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { initializePromptCoach } from "../../config/config.js";
import { redactPrompt } from "../../redaction/redact.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import { reviewProjectInstructionsForCli } from "./review-project-instructions.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("review-project-instructions CLI", () => {
  it("returns a friendly empty-archive error when no project has been captured", () => {
    const dataDir = createTempDir();
    initializePromptCoach({ dataDir });

    const text = reviewProjectInstructionsForCli({ dataDir });
    expect(text).toContain("Project instruction review");
    expect(text).toMatch(/error not_found/);
    expect(text).toContain("Capture at least one prompt");
    expect(text).toContain("Privacy: local-only");
  });

  it("renders score, checklist, suggestions, and next_action for the latest captured project", async () => {
    const dataDir = createTempDir();
    const projectDir = createTempDir();
    writeFileSync(
      join(projectDir, "AGENTS.md"),
      [
        "# Test Project",
        "",
        "This is a tiny test project for the usability patrol.",
      ].join("\n"),
    );
    await seedOneProject(dataDir, projectDir);

    const text = reviewProjectInstructionsForCli({ dataDir });
    expect(text).toContain("Project instruction review");
    expect(text).toMatch(/\d+\/100 \((excellent|good|needs_work|weak)\)/);
    expect(text).toContain("Checklist");
    expect(text).toMatch(/\[(missing|weak|good)\]/);
    expect(text).toContain("Suggestions");
    expect(text).toContain("Next action");
    expect(text).toContain(
      "Privacy: local-only, no external calls, no instruction file bodies",
    );
  });

  it("returns the same JSON shape as MCP review_project_instructions", async () => {
    const dataDir = createTempDir();
    const projectDir = createTempDir();
    writeFileSync(
      join(projectDir, "AGENTS.md"),
      "# Quick test\n\nMinimal AGENTS.md to exercise the reviewer.\n",
    );
    await seedOneProject(dataDir, projectDir);

    const json = reviewProjectInstructionsForCli({ dataDir, json: true });
    const parsed = JSON.parse(json) as {
      project_id: string;
      review: { score: { value: number }; checklist: unknown[] };
      suggestions: string[];
      next_action: string;
      privacy: { local_only: boolean };
    };

    expect(parsed.project_id).toMatch(/^proj_/);
    expect(parsed.review.checklist.length).toBeGreaterThan(0);
    expect(parsed.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(parsed.next_action).toBeTruthy();
    expect(parsed.privacy.local_only).toBe(true);
  });

  it("--no-analyze reuses cached review instead of re-running the analyzer", async () => {
    const dataDir = createTempDir();
    const projectDir = createTempDir();
    writeFileSync(join(projectDir, "AGENTS.md"), "# Test\n");
    await seedOneProject(dataDir, projectDir);

    // Prime the cache with a fresh analyze.
    reviewProjectInstructionsForCli({ dataDir });

    const json = reviewProjectInstructionsForCli({
      dataDir,
      json: true,
      noAnalyze: true,
    });
    const parsed = JSON.parse(json) as { generated_fresh: boolean };
    expect(parsed.generated_fresh).toBe(false);
  });
});

async function seedOneProject(
  dataDir: string,
  projectCwd: string,
): Promise<void> {
  const init = initializePromptCoach({ dataDir });
  const storage = createSqlitePromptStorage({
    dataDir,
    hmacSecret: init.hookAuth.web_session_secret,
    now: () => new Date("2026-05-09T08:00:00.000Z"),
  });
  try {
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-rpi-cli",
        transcript_path: "/tmp/x/transcript.jsonl",
        cwd: projectCwd,
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Seed prompt for review-project-instructions CLI test.",
      },
      new Date("2026-05-09T08:00:00.000Z"),
    );
    await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
  } finally {
    storage.close();
  }
}

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-rpi-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}
