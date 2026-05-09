import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { initializePromptCoach } from "../../config/config.js";
import { redactPrompt } from "../../redaction/redact.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import {
  listProjectsForCli,
  setProjectPolicyForCli,
  showProjectForCli,
} from "./project.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("project CLI command", () => {
  it("lists captured projects with policy summary", async () => {
    const dataDir = createTempDir();
    await seedTwoProjects(dataDir);

    const text = listProjectsForCli({ dataDir });
    expect(text).toContain("Projects");
    expect(text).toMatch(/proj-a/);
    expect(text).toMatch(/proj-b/);

    const json = listProjectsForCli({ dataDir, json: true });
    const parsed = JSON.parse(json) as { items: Array<{ project_id: string }> };
    expect(parsed.items.length).toBe(2);
  });

  it("hints when no projects have been captured yet", () => {
    const dataDir = createTempDir();
    initializePromptCoach({ dataDir });

    const text = listProjectsForCli({ dataDir });
    expect(text).toContain("No projects captured yet.");
  });

  it("toggles capture_disabled via project set --capture-disabled and persists the policy", async () => {
    const dataDir = createTempDir();
    await seedTwoProjects(dataDir);

    const set = setProjectPolicyForCli({
      dataDir,
      cwd: "/tmp/x/proj-a",
      captureDisabled: true,
    });
    expect(set).toContain("Project policy updated");
    expect(set).toContain("capture_disabled: yes");

    const show = showProjectForCli({ dataDir, cwd: "/tmp/x/proj-a" });
    expect(show).toContain("capture_disabled: yes");
    expect(show).toContain("policy_version: 2");

    // Verify the other project is still capturing.
    const showB = showProjectForCli({ dataDir, cwd: "/tmp/x/proj-b" });
    expect(showB).toContain("capture_disabled: no");
  });

  it("supports --no-capture-disabled to re-enable capture", async () => {
    const dataDir = createTempDir();
    await seedTwoProjects(dataDir);

    setProjectPolicyForCli({
      dataDir,
      cwd: "/tmp/x/proj-a",
      captureDisabled: true,
    });
    const reenable = setProjectPolicyForCli({
      dataDir,
      cwd: "/tmp/x/proj-a",
      captureDisabled: false,
    });
    expect(reenable).toContain("capture_disabled: no");
  });

  it("dry-run prints the patch without writing", async () => {
    const dataDir = createTempDir();
    await seedTwoProjects(dataDir);

    const text = setProjectPolicyForCli({
      dataDir,
      cwd: "/tmp/x/proj-a",
      captureDisabled: true,
      retentionDays: "30",
      dryRun: true,
    });
    expect(text).toContain("dry-run: project policy patch");
    expect(text).toContain("capture_disabled: true");
    expect(text).toContain("retention_candidate_days: 30");

    const show = showProjectForCli({ dataDir, cwd: "/tmp/x/proj-a" });
    expect(show).toContain("capture_disabled: no");
    expect(show).toContain("retention_candidate_days: not set");
  });

  it("requires at least one policy flag", () => {
    expect(() =>
      setProjectPolicyForCli({
        cwd: "/tmp/x/proj-a",
      } as Parameters<typeof setProjectPolicyForCli>[0]),
    ).toThrow(/at least one policy flag/);
  });

  it("rejects --retention-days that is not a non-negative integer", async () => {
    const dataDir = createTempDir();
    await seedTwoProjects(dataDir);

    expect(() =>
      setProjectPolicyForCli({
        dataDir,
        cwd: "/tmp/x/proj-a",
        retentionDays: "-3",
      }),
    ).toThrow(/non-negative integer/);

    expect(() =>
      setProjectPolicyForCli({
        dataDir,
        cwd: "/tmp/x/proj-a",
        retentionDays: "abc",
      }),
    ).toThrow(/non-negative integer/);
  });

  it("returns a friendly error when the cwd has no captured prompt yet", async () => {
    const dataDir = createTempDir();
    await seedTwoProjects(dataDir);

    expect(() =>
      showProjectForCli({ dataDir, cwd: "/tmp/x/proj-never-captured" }),
    ).toThrow(/No captured project matches cwd/);

    expect(() =>
      setProjectPolicyForCli({
        dataDir,
        cwd: "/tmp/x/proj-never-captured",
        captureDisabled: true,
      }),
    ).toThrow(/Capture at least one prompt/);
  });
});

async function seedTwoProjects(dataDir: string): Promise<void> {
  const init = initializePromptCoach({ dataDir });
  const storage = createSqlitePromptStorage({
    dataDir,
    hmacSecret: init.hookAuth.web_session_secret,
    now: nextDate(["2026-05-09T07:00:00.000Z", "2026-05-09T07:01:00.000Z"]),
  });
  try {
    for (const cwd of ["/tmp/x/proj-a", "/tmp/x/proj-b"]) {
      const event = normalizeClaudeCodePayload(
        {
          session_id: `session-${cwd}`,
          transcript_path: "/tmp/x/transcript.jsonl",
          cwd,
          permission_mode: "default",
          hook_event_name: "UserPromptSubmit",
          prompt: `Seed prompt for ${cwd}`,
        },
        new Date("2026-05-09T07:00:00.000Z"),
      );
      await storage.storePrompt({
        event,
        redaction: redactPrompt(event.prompt, "mask"),
      });
    }
  } finally {
    storage.close();
  }
}

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-coach-project-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function nextDate(values: string[]): () => Date {
  let index = 0;
  return () => new Date(values[index++] ?? values.at(-1)!);
}
