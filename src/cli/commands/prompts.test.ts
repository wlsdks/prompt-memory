import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../../adapters/claude-code.js";
import { initializePromptMemory } from "../../config/config.js";
import { redactPrompt } from "../../redaction/redact.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";
import {
  deletePromptForCli,
  listPromptsForCli,
  openPromptForCli,
  rebuildIndexForCli,
  searchPromptsForCli,
  showPromptForCli,
} from "./prompts.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("prompt CLI commands", () => {
  it("lists, searches, shows, deletes, opens, and rebuilds prompts", async () => {
    const dataDir = createTempDir();
    const ids = await createCliFixture(dataDir);

    expect(
      JSON.parse(listPromptsForCli({ dataDir, limit: 2, json: true })),
    ).toMatchObject({
      items: [{ id: ids.gamma }, { id: ids.beta }],
    });
    expect(
      JSON.parse(searchPromptsForCli("beta", { dataDir, json: true })).items,
    ).toMatchObject([{ id: ids.beta }]);

    const shown = JSON.parse(
      showPromptForCli(ids.beta, { dataDir, json: true }),
    );
    expect(shown).toMatchObject({
      id: ids.beta,
      markdown: expect.stringContaining("beta prompt"),
    });

    expect(openPromptForCli(ids.beta, { dataDir })).toBe(
      `http://127.0.0.1:17373/prompts/${ids.beta}`,
    );
    expect(
      JSON.parse(rebuildIndexForCli({ dataDir, json: true })),
    ).toMatchObject({
      rebuilt: expect.arrayContaining([ids.alpha, ids.beta, ids.gamma]),
      hashMismatches: [],
    });
    expect(
      JSON.parse(deletePromptForCli(ids.beta, { dataDir, json: true })),
    ).toEqual({
      deleted: true,
    });
    expect(() => showPromptForCli(ids.beta, { dataDir, json: true })).toThrow(
      "Prompt not found",
    );
  });

  it("explains an empty list result instead of printing a blank line", () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    expect(listPromptsForCli({ dataDir })).toBe("no prompts captured yet.");
    expect(
      JSON.parse(listPromptsForCli({ dataDir, json: true })),
    ).toMatchObject({ items: [] });
  });

  it("echoes the search query when nothing matches", () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    expect(searchPromptsForCli("definitely-no-match", { dataDir })).toBe(
      'no prompts matching "definitely-no-match".',
    );
    expect(
      JSON.parse(
        searchPromptsForCli("definitely-no-match", { dataDir, json: true }),
      ),
    ).toMatchObject({ items: [] });
  });

  it("explains the score breakdown when --explain is passed to show", async () => {
    const dataDir = createTempDir();
    const ids = await createCliFixture(dataDir);

    const explanation = showPromptForCli(ids.beta, { dataDir, explain: true });

    expect(explanation).toMatch(
      /^Score: \d+\/100 \((excellent|good|needs_work|weak)\)/,
    );
    expect(explanation).toContain("Breakdown:");
    expect(explanation).toContain("Goal clarity");
    expect(explanation).toContain("Verification criteria");
  });

  it("shows drafts:N suffix on list rows that have saved improvement drafts", async () => {
    const dataDir = createTempDir();
    const ids = await createCliFixture(dataDir);
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
    });
    try {
      storage.createPromptImprovementDraft(ids.beta, {
        draft_text: "draft body",
        analyzer: "clarifications-v1",
        changed_sections: [],
        safety_notes: [],
        accepted: true,
      });
    } finally {
      storage.close();
    }

    const listing = listPromptsForCli({ dataDir, limit: 10 });
    const betaLine = listing
      .split("\n")
      .find((line) => line.includes(ids.beta));
    expect(betaLine).toBeDefined();
    expect(betaLine).toContain("drafts:1");
    // Rows without drafts should not get the suffix.
    const otherRows = listing
      .split("\n")
      .filter((line) => line.includes("\t") && !line.includes(ids.beta));
    for (const row of otherRows) {
      expect(row).not.toContain("drafts:");
    }
  });

  it("appends saved drafts with friendly analyzer labels to --explain output", async () => {
    const dataDir = createTempDir();
    const ids = await createCliFixture(dataDir);
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
    });
    try {
      storage.createPromptImprovementDraft(ids.beta, {
        draft_text: "## Goal\nFix the delete API.",
        analyzer: "clarifications-v1",
        changed_sections: ["goal_clarity"],
        safety_notes: [],
        accepted: true,
      });
      storage.createPromptImprovementDraft(ids.beta, {
        draft_text: "## Goal\nGeneric structure",
        analyzer: "local-rules-v1",
        changed_sections: ["scope_limits"],
        safety_notes: [],
      });
    } finally {
      storage.close();
    }

    const explanation = showPromptForCli(ids.beta, { dataDir, explain: true });

    expect(explanation).toContain("Saved drafts:");
    expect(explanation).toContain("[From your answers]");
    expect(explanation).toContain("[Auto rewrite]");
    expect(explanation).toContain("goal_clarity");
    // Body must not be echoed in the CLI explanation.
    expect(explanation).not.toContain("Fix the delete API.");
  });

  it("refuses to print an open URL for an unknown prompt id", () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    expect(() => openPromptForCli("prmt_does_not_exist", { dataDir })).toThrow(
      "Prompt not found",
    );
  });

  it("hints at a runnable list command in Prompt not found errors", () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    expect(() => showPromptForCli("prmt_missing", { dataDir })).toThrow(
      /prompt-memory list/,
    );
    expect(() => deletePromptForCli("prmt_missing", { dataDir })).toThrow(
      /prompt-memory list/,
    );
    expect(() => openPromptForCli("prmt_missing", { dataDir })).toThrow(
      /prompt-memory list/,
    );
  });

  it("prefixes list results with a count and a more-available hint", async () => {
    const dataDir = createTempDir();
    await createCliFixture(dataDir);

    const limited = listPromptsForCli({ dataDir, limit: 2 });
    expect(limited).toMatch(/^2 prompts \(more available/);

    const all = listPromptsForCli({ dataDir, limit: 10 });
    expect(all).toMatch(/^3 prompts:/);
    expect(all).not.toContain("more available");
  });

  it("prefixes search results with a count and the echoed query", async () => {
    const dataDir = createTempDir();
    await createCliFixture(dataDir);

    const result = searchPromptsForCli("beta", { dataDir });

    expect(result).toMatch(/^1 match for "beta":/);
  });

  it("warns when a query exceeds the FTS token cap", async () => {
    const dataDir = createTempDir();
    await createCliFixture(dataDir);

    const longQuery =
      "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda";
    const result = searchPromptsForCli(longQuery, { dataDir });

    expect(result).toMatch(/using first 8 of 11 query words/);
  });
});

async function createCliFixture(dataDir: string) {
  initializePromptMemory({ dataDir });
  const storage = createSqlitePromptStorage({
    dataDir,
    hmacSecret: "test-secret",
    now: nextDate([
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T10:01:00.000Z",
      "2026-05-01T10:02:00.000Z",
    ]),
  });

  try {
    const alpha = await storeClaudePrompt(
      storage,
      "alpha prompt",
      "2026-05-01T10:00:00.000Z",
    );
    const beta = await storeClaudePrompt(
      storage,
      "beta prompt",
      "2026-05-01T10:01:00.000Z",
    );
    const gamma = await storeClaudePrompt(
      storage,
      "gamma prompt",
      "2026-05-01T10:02:00.000Z",
    );

    return {
      alpha: alpha.id,
      beta: beta.id,
      gamma: gamma.id,
    };
  } finally {
    storage.close();
  }
}

async function storeClaudePrompt(
  storage: ReturnType<typeof createSqlitePromptStorage>,
  prompt: string,
  receivedAt: string,
) {
  const event = normalizeClaudeCodePayload(
    {
      session_id: `session-${receivedAt}`,
      transcript_path: "/Users/example/.claude/session.jsonl",
      cwd: "/Users/example/project",
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt,
    },
    new Date(receivedAt),
  );

  return storage.storePrompt({
    event,
    redaction: redactPrompt(event.prompt, "mask"),
  });
}

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-cli-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

function nextDate(values: string[]): () => Date {
  let index = 0;

  return () => new Date(values[index++] ?? values.at(-1)!);
}
