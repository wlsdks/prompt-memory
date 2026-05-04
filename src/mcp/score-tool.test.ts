import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { normalizeClaudeCodePayload } from "../adapters/claude-code.js";
import { initializePromptMemory } from "../config/config.js";
import { redactPrompt } from "../redaction/redact.js";
import { createSqlitePromptStorage } from "../storage/sqlite.js";
import { SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION } from "./score-tool-definitions.js";
import {
  coachPromptTool,
  prepareAgentRewriteTool,
  prepareAgentJudgeBatchTool,
  getPromptMemoryStatusTool,
  improvePromptTool,
  recordAgentRewriteTool,
  recordAgentJudgmentsTool,
  reviewProjectInstructionsTool,
  scorePromptArchiveTool,
  scorePromptTool,
} from "./score-tool.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("scorePromptTool", () => {
  it("scores direct prompt text without echoing the raw prompt", () => {
    const result = scorePromptTool({
      prompt:
        "Because export review is unclear, inspect src/web/src/App.tsx only, run pnpm test, and return a Markdown summary.",
    });
    const serialized = JSON.stringify(result);

    expect(result.source).toBe("text");
    expect(result.quality_score.value).toBeGreaterThanOrEqual(85);
    expect(result.privacy).toEqual({
      local_only: true,
      stores_input: false,
      external_calls: false,
      returns_prompt_body: false,
    });
    expect(serialized).not.toContain("src/web/src/App.tsx only");
  });

  it("scores the latest stored prompt by id without returning the prompt body", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-02T10:00:00.000Z"),
    });
    const event = normalizeClaudeCodePayload(
      {
        session_id: "session-mcp",
        transcript_path: "/Users/example/.claude/session.jsonl",
        cwd: "/Users/example/project",
        permission_mode: "default",
        hook_event_name: "UserPromptSubmit",
        prompt: "Make this better",
      },
      new Date("2026-05-02T09:59:00.000Z"),
    );
    const stored = await storage.storePrompt({
      event,
      redaction: redactPrompt(event.prompt, "mask"),
    });
    storage.close();

    const result = scorePromptTool({ latest: true }, { dataDir });
    const serialized = JSON.stringify(result);

    expect(result.source).toBe("latest");
    expect(result.prompt_id).toBe(stored.id);
    expect(result.quality_score.value).toBeLessThanOrEqual(20);
    expect(serialized).not.toContain("Make this better");
  });

  it("scores the stored prompt archive without returning bodies or raw paths", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: nextDate(["2026-05-02T10:00:00.000Z", "2026-05-02T10:01:00.000Z"]),
    });
    const weak = await storeClaudePrompt(
      storage,
      "Make this better",
      "2026-05-02T09:59:00.000Z",
    );
    await storeClaudePrompt(
      storage,
      "Review src/mcp/score-tool.ts, keep changes scoped to MCP scoring, run pnpm vitest run src/mcp/score-tool.test.ts, and return risk notes.",
      "2026-05-02T10:00:00.000Z",
    );
    storage.close();

    const result = scorePromptArchiveTool(
      { max_prompts: 100, low_score_limit: 1 },
      { dataDir },
    );
    const serialized = JSON.stringify(result);

    expect(result.archive_score.scored_prompts).toBe(2);
    expect(result.low_score_prompts).toEqual([
      expect.objectContaining({
        id: weak.id,
        project: "project",
      }),
    ]);
    expect(result.practice_plan[0]).toEqual(
      expect.objectContaining({
        priority: 1,
        prompt_rule: expect.any(String),
      }),
    );
    expect(result.next_prompt_template).toContain("Goal:");
    expect(result.privacy).toMatchObject({
      local_only: true,
      external_calls: false,
      returns_prompt_bodies: false,
      returns_raw_paths: false,
    });
    expect(serialized).not.toContain("Make this better");
    expect(serialized).not.toContain("/Users/example");
  });

  it("declares the language argument in the score_prompt_archive MCP schema", () => {
    const properties = (
      SCORE_PROMPT_ARCHIVE_TOOL_DEFINITION.inputSchema as {
        properties?: Record<string, { enum?: string[] }>;
      }
    ).properties;

    expect(properties?.language).toBeDefined();
    expect(properties?.language?.enum).toEqual(["en", "ko"]);
  });

  it("renders archive practice plan in Korean when language=ko is passed", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-04T10:00:00.000Z"),
    });
    await storeClaudePrompt(
      storage,
      "Make this better",
      "2026-05-04T09:59:00.000Z",
    );
    storage.close();

    const result = scorePromptArchiveTool(
      { max_prompts: 100, low_score_limit: 1, language: "ko" },
      { dataDir },
    );

    expect(result.next_prompt_template).toContain("목표:");
    expect(result.next_prompt_template).not.toContain("Goal:");
    expect(result.practice_plan[0]?.prompt_rule).toMatch(/[가-힣]/);
  });

  it("returns an actionable tool error for ambiguous input", () => {
    const result = scorePromptTool({});

    expect(result.is_error).toBe(true);
    expect(result.error_code).toBe("invalid_input");
    expect(result.message).toContain("Provide exactly one");
  });

  it("does not include raw data directory paths in storage errors", () => {
    const dataDir = join(tmpdir(), `prompt-memory-missing-${randomUUID()}`);
    const result = scorePromptTool({ latest: true }, { dataDir });
    const serialized = JSON.stringify(result);

    expect(result.is_error).toBe(true);
    expect(result.error_code).toBe("storage_unavailable");
    expect(serialized).not.toContain(dataDir);
    expect(serialized).not.toContain("/tmp/");
  });

  it("hints next actions when latest=true on an empty archive", () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    const result = scorePromptTool({ latest: true }, { dataDir });

    expect(result.is_error).toBe(true);
    expect(result.error_code).toBe("not_found");
    expect(result.message).toContain("Capture a Claude Code or Codex prompt");
    expect(result.message).toContain("`prompt` text argument");
  });
});

describe("improvePromptTool", () => {
  it("returns an approval-ready draft for direct prompt text without storing input", () => {
    const result = improvePromptTool({
      prompt: "Make this better with token sk-proj-1234567890abcdef",
    });
    const serialized = JSON.stringify(result);

    expect(result.source).toBe("text");
    expect(result.requires_user_approval).toBe(true);
    expect(result.improved_prompt).toContain("Please work from");
    expect(result.privacy).toEqual({
      local_only: true,
      stores_input: false,
      external_calls: false,
      returns_stored_prompt_body: false,
    });
    expect(serialized).not.toContain("sk-proj-1234567890abcdef");
  });

  it("improves the latest stored prompt without returning the stored prompt body", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T12:00:00.000Z"),
    });
    await storeClaudePrompt(
      storage,
      "Make this better",
      "2026-05-03T11:59:00.000Z",
    );
    storage.close();

    const result = improvePromptTool({ latest: true }, { dataDir });
    const serialized = JSON.stringify(result);

    expect(result.source).toBe("latest");
    expect(result.prompt_id).toBeTruthy();
    expect(result.improved_prompt).toContain("Goal");
    expect(result.privacy).toMatchObject({
      local_only: true,
      stores_input: false,
      external_calls: false,
      returns_stored_prompt_body: false,
    });
    expect(serialized).not.toContain("Make this better");
    expect(serialized).not.toContain("/Users/example");
  });

  it("improves stored prompts from the redacted archive body instead of the generic analysis summary", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T12:10:00.000Z"),
    });
    const originalPrompt =
      "Review src/mcp/score-tool.ts because latest prompt rewrite ignores stored content. Keep changes scoped to MCP improve_prompt. Run pnpm vitest run src/mcp/score-tool.test.ts. Return a Markdown summary.";
    await storeClaudePrompt(
      storage,
      originalPrompt,
      "2026-05-03T12:09:00.000Z",
    );
    storage.close();

    const result = improvePromptTool({ latest: true }, { dataDir });
    const serialized = JSON.stringify(result);

    expect(result.source).toBe("latest");
    expect(result.improved_prompt).toContain("src/mcp/score-tool.ts");
    expect(result.improved_prompt).toContain("pnpm vitest run");
    expect(result.improved_prompt).not.toContain(originalPrompt);
    expect(result.rewrite_source).toBe("redacted_stored_prompt");
    expect(serialized).not.toContain("/Users/example");
  });

  it("returns an actionable tool error for ambiguous improvement input", () => {
    const result = improvePromptTool({ prompt: "Fix this", latest: true });

    expect(result.is_error).toBe(true);
    expect(result.error_code).toBe("invalid_input");
    expect(result.message).toContain("Provide exactly one");
  });
});

describe("reviewProjectInstructionsTool", () => {
  it("reviews the latest project instruction files without returning bodies or raw paths", async () => {
    const dataDir = createTempDir();
    const projectDir = join(createTempDir(), "demo-project");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, "AGENTS.md"),
      [
        "# Agent rules",
        "PRIVATE_RULE_BODY_SHOULD_NOT_RETURN",
        "Describe project context, agent workflow, verification with pnpm test, privacy safety, and collaboration output.",
      ].join("\n"),
      "utf8",
    );
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T10:00:00.000Z"),
    });
    await storeClaudePrompt(
      storage,
      "Review AGENTS.md quality and suggest improvements.",
      "2026-05-03T09:59:00.000Z",
      projectDir,
    );
    const project = storage.listProjects().items[0];
    storage.close();

    const result = reviewProjectInstructionsTool(
      { project_id: project?.project_id, analyze: true },
      { dataDir },
    );
    const serialized = JSON.stringify(result);

    expect(result.source).toBe("project_id");
    expect(result.project_id).toBe(project?.project_id);
    expect(result.review.score.value).toBeGreaterThan(60);
    expect(result.review.files_found).toBe(1);
    expect(result.privacy).toMatchObject({
      local_only: true,
      external_calls: false,
      returns_file_bodies: false,
      returns_raw_paths: false,
    });
    expect(serialized).not.toContain("PRIVATE_RULE_BODY_SHOULD_NOT_RETURN");
    expect(serialized).not.toContain(projectDir);
  });

  it("returns an actionable tool error when no project exists", () => {
    const dataDir = createTempDir();
    initializePromptMemory({ dataDir });

    const result = reviewProjectInstructionsTool({ latest: true }, { dataDir });

    expect(result.is_error).toBe(true);
    expect(result.error_code).toBe("not_found");
    expect(result.message).toContain("No stored project");
  });
});

describe("getPromptMemoryStatusTool", () => {
  it("returns local archive readiness without prompt bodies or raw paths", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T11:00:00.000Z"),
    });
    await storeClaudePrompt(
      storage,
      "Review src/mcp/score-tool.ts and run pnpm test.",
      "2026-05-03T10:59:00.000Z",
    );
    storage.close();

    const result = getPromptMemoryStatusTool({}, { dataDir });
    const serialized = JSON.stringify(result);

    expect(result.status).toBe("ready");
    expect(result.total_prompts).toBe(1);
    expect(result.project_count).toBe(1);
    expect(result.latest_prompt).toMatchObject({
      tool: "claude-code",
      project: "project",
    });
    expect(result.available_tools).toContain("score_prompt");
    expect(result.available_tools).toContain("get_prompt_memory_status");
    expect(result.privacy).toEqual({
      local_only: true,
      external_calls: false,
      returns_prompt_bodies: false,
      returns_raw_paths: false,
    });
    expect(serialized).not.toContain("src/mcp/score-tool.ts");
    expect(serialized).not.toContain("/Users/example");
  });

  it("returns a setup-needed status when storage is unavailable", () => {
    const result = getPromptMemoryStatusTool(
      {},
      { dataDir: join(tmpdir(), `prompt-memory-missing-${randomUUID()}`) },
    );

    expect(result.status).toBe("setup_needed");
    expect(result.next_actions[0]).toContain("prompt-memory init");
  });
});

describe("agent judge MCP tools", () => {
  it("prepares a redacted agent rewrite packet for the latest stored prompt", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: nextDate(["2026-05-03T18:30:00.000Z", "2026-05-03T18:31:00.000Z"]),
    });
    await storeClaudePrompt(
      storage,
      "Fix this with token sk-proj-1234567890abcdef in /Users/example/private-app",
      "2026-05-03T18:29:00.000Z",
    );
    const latest = await storeClaudePrompt(
      storage,
      "Review src/mcp/score-tool.ts, keep the change scoped to MCP rewrite tools, run pnpm vitest run src/mcp/score-tool.test.ts, and return a concise risk summary.",
      "2026-05-03T18:30:00.000Z",
    );
    storage.close();

    const result = prepareAgentRewriteTool(
      { latest: true, language: "en" },
      { dataDir, now: new Date("2026-05-03T18:32:00.000Z") },
    );
    const serialized = JSON.stringify(result);

    expect(result.mode).toBe("agent_rewrite_packet");
    expect(result.prompt.prompt_id).toBe(latest.id);
    expect(result.prompt.redacted_prompt).toContain("src/mcp/score-tool.ts");
    expect(result.local_baseline?.improved_prompt).toContain(
      "src/mcp/score-tool.ts",
    );
    expect(result.rewrite_contract.required_sections).toEqual([
      "Goal",
      "Context",
      "Scope",
      "Verification",
      "Output",
    ]);
    expect(result.agent_instructions).toContain("record_agent_rewrite");
    expect(result.privacy).toEqual({
      local_only: true,
      external_calls_by_prompt_memory: false,
      intended_external_rewriter: "current_agent_session",
      returns_redacted_prompt_body: true,
      returns_raw_prompt_body: false,
      returns_raw_paths: false,
      stores_rewrite_result: false,
      auto_submits: false,
    });
    expect(serialized).not.toContain("sk-proj-1234567890abcdef");
    expect(serialized).not.toContain("/Users/example");
  });

  it("records an agent rewrite as a redacted improvement draft without returning the draft body", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: nextDate(["2026-05-03T19:00:00.000Z", "2026-05-03T19:01:00.000Z"]),
    });
    const prompt = await storeClaudePrompt(
      storage,
      "Make this better with token sk-proj-1234567890abcdef",
      "2026-05-03T18:59:00.000Z",
    );
    storage.close();

    const result = recordAgentRewriteTool(
      {
        provider: "codex",
        judge_model: "gpt-5.5",
        prompt_id: prompt.id,
        improved_prompt:
          "## Goal\nImprove the MCP rewrite flow with token sk-proj-1234567890abcdef.\n## Verification\nRun pnpm vitest run src/mcp/score-tool.test.ts.",
        confidence: 0.84,
        summary:
          "Added a concrete goal and verification command without using sk-proj-1234567890abcdef.",
        changed_sections: ["goal_clarity", "verification_criteria"],
        safety_notes: [
          "Agent rewrite was reviewed with sk-proj-1234567890abcdef redacted.",
        ],
        copied: true,
      },
      { dataDir, now: new Date("2026-05-03T19:02:00.000Z") },
    );
    const serialized = JSON.stringify(result);

    expect(result.recorded).toBe(true);
    expect(result.draft).toEqual(
      expect.objectContaining({
        prompt_id: prompt.id,
        analyzer: "agent-rewrite-v1:codex",
        changed_sections: ["goal_clarity", "verification_criteria"],
        is_sensitive: true,
        copied_at: "2026-05-03T19:02:00.000Z",
      }),
    );
    expect(result.draft).not.toHaveProperty("draft_text");
    expect(result.agent_metadata.summary).toContain("[REDACTED:api_key]");
    expect(result.draft.safety_notes.join("\n")).toContain(
      "[REDACTED:api_key]",
    );
    expect(result.privacy).toEqual({
      local_only: true,
      external_calls_by_prompt_memory: false,
      stores_original_prompt_body: false,
      stores_rewrite_draft: true,
      returns_rewrite_draft: false,
      stores_raw_paths: false,
    });
    expect(serialized).not.toContain("Make this better");
    expect(serialized).not.toContain("Improve the MCP rewrite flow");
    expect(serialized).not.toContain("sk-proj-1234567890abcdef");
  });

  it("rejects invalid agent rewrite input before storage", () => {
    const result = recordAgentRewriteTool({
      provider: "codex",
      prompt_id: "",
      improved_prompt: "",
      confidence: 2,
    });

    expect(result.is_error).toBe(true);
    expect(result.error_code).toBe("invalid_input");
  });

  it("prepares a redacted LLM judge packet for the current agent session", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: nextDate(["2026-05-03T16:00:00.000Z", "2026-05-03T16:01:00.000Z"]),
    });
    const weak = await storeClaudePrompt(
      storage,
      "Fix this with token sk-proj-1234567890abcdef in /Users/example/private-app",
      "2026-05-03T15:59:00.000Z",
    );
    await storeClaudePrompt(
      storage,
      "Review src/mcp/score-tool.ts, keep scope to MCP judge tools, run pnpm vitest run src/mcp/score-tool.test.ts, and return risk notes.",
      "2026-05-03T16:00:00.000Z",
    );
    storage.close();

    const result = prepareAgentJudgeBatchTool(
      {
        max_prompts: 2,
        selection: "low_score",
        include_redacted_prompt: true,
      },
      { dataDir, now: new Date("2026-05-03T16:02:00.000Z") },
    );
    const serialized = JSON.stringify(result);

    expect(result.mode).toBe("agent_judge_packet");
    expect(result.prompts[0]).toEqual(
      expect.objectContaining({
        prompt_id: weak.id,
        local_score: expect.any(Object),
        redacted_prompt: expect.stringContaining("[REDACTED:api_key]"),
      }),
    );
    expect(result.rubric.criteria).toHaveLength(5);
    expect(result.agent_instructions).toContain("record_agent_judgments");
    expect(result.privacy).toEqual({
      local_only: true,
      external_calls_by_prompt_memory: false,
      intended_external_evaluator: "current_agent_session",
      returns_redacted_prompt_bodies: true,
      returns_raw_prompt_bodies: false,
      returns_raw_paths: false,
      stores_judgment_results: false,
      auto_submits: false,
    });
    expect(serialized).not.toContain("sk-proj-1234567890abcdef");
    expect(serialized).not.toContain("/Users/example");
  });

  it("records current-agent judgments without storing prompt bodies", async () => {
    const dataDir = createTempDir();
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: () => new Date("2026-05-03T17:00:00.000Z"),
    });
    const prompt = await storeClaudePrompt(
      storage,
      "Make this better with token sk-proj-1234567890abcdef",
      "2026-05-03T16:59:00.000Z",
    );
    storage.close();

    const result = recordAgentJudgmentsTool(
      {
        provider: "claude-code",
        judge_model: "current-session",
        judgments: [
          {
            prompt_id: prompt.id,
            score: 41,
            confidence: 0.72,
            summary:
              "The request has a goal but lacks scope and verification detail.",
            strengths: ["Goal is short enough to revise."],
            risks: ["Scope is vague."],
            suggestions: ["Add target files and verification command."],
          },
        ],
      },
      { dataDir, now: new Date("2026-05-03T17:01:00.000Z") },
    );
    const serialized = JSON.stringify(result);

    expect(result.recorded).toBe(1);
    expect(result.judgments[0]).toEqual(
      expect.objectContaining({
        prompt_id: prompt.id,
        provider: "claude-code",
        score: 41,
        confidence: 0.72,
      }),
    );
    expect(result.privacy).toEqual({
      local_only: true,
      external_calls_by_prompt_memory: false,
      stores_prompt_bodies: false,
      stores_raw_paths: false,
      stores_judgment_results: true,
    });
    expect(serialized).not.toContain("Make this better");
    expect(serialized).not.toContain("sk-proj-1234567890abcdef");
  });

  it("rejects invalid agent judgment input before storage", () => {
    const result = recordAgentJudgmentsTool({
      provider: "claude-code",
      judgments: [
        {
          prompt_id: "prompt_missing",
          score: 101,
          confidence: 1.1,
          summary: "bad",
          strengths: [],
          risks: [],
          suggestions: [],
        },
      ],
    });

    expect(result.is_error).toBe(true);
    expect(result.error_code).toBe("invalid_input");
  });
});

describe("coachPromptTool", () => {
  it("returns a one-call agent coach brief without prompt bodies, file bodies, or raw paths", async () => {
    const dataDir = createTempDir();
    const projectDir = join(createTempDir(), "coach-project");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, "AGENTS.md"),
      [
        "# Agent rules",
        "PRIVATE_AGENT_RULE_BODY",
        "Describe project context, workflow, verification with pnpm test, privacy safety, and final reporting.",
      ].join("\n"),
      "utf8",
    );
    const init = initializePromptMemory({ dataDir });
    const storage = createSqlitePromptStorage({
      dataDir,
      hmacSecret: init.hookAuth.web_session_secret,
      now: nextDate(["2026-05-03T15:00:00.000Z", "2026-05-03T15:01:00.000Z"]),
    });
    await storeClaudePrompt(
      storage,
      "Make this better with token sk-proj-1234567890abcdef",
      "2026-05-03T14:59:00.000Z",
      projectDir,
    );
    await storeClaudePrompt(
      storage,
      "Review src/mcp/score-tool.ts, keep scope to MCP, run pnpm vitest run src/mcp/score-tool.test.ts, and return risk notes.",
      "2026-05-03T15:00:00.000Z",
      projectDir,
    );
    storage.close();

    const result = coachPromptTool(
      { include_project_rules: true, max_prompts: 50 },
      { dataDir },
    );
    const serialized = JSON.stringify(result);

    expect(result.mode).toBe("agent_coach");
    expect(result.status.status).toBe("ready");
    expect(result.latest_score).toEqual(
      expect.objectContaining({
        source: "latest",
        quality_score: expect.any(Object),
      }),
    );
    expect(result.improvement).toEqual(
      expect.objectContaining({
        requires_user_approval: true,
        mode: "copy",
      }),
    );
    expect(result.archive).toEqual(
      expect.objectContaining({
        archive_score: expect.any(Object),
        next_prompt_template: expect.stringContaining("Goal:"),
      }),
    );
    expect(result.project_rules).toEqual(
      expect.objectContaining({
        review: expect.objectContaining({
          files_found: 1,
        }),
      }),
    );
    expect(result.agent_brief.next_actions[0]).toContain("Review");
    expect(result.agent_brief.first_fix).toEqual(
      expect.objectContaining({
        label: expect.any(String),
        instruction: expect.any(String),
      }),
    );
    expect(result.agent_brief.next_request_template).toContain("Goal:");
    expect(result.agent_brief.next_request_template).toContain("Verification:");
    expect(result.agent_brief.review_target).toEqual(
      expect.objectContaining({
        prompt_id: expect.any(String),
        reason: expect.any(String),
      }),
    );
    expect(result.privacy).toEqual({
      local_only: true,
      external_calls: false,
      returns_prompt_bodies: false,
      returns_raw_paths: false,
      returns_instruction_file_bodies: false,
      auto_submits: false,
    });
    expect(serialized).not.toContain("Make this better");
    expect(serialized).not.toContain("sk-proj-1234567890abcdef");
    expect(serialized).not.toContain("PRIVATE_AGENT_RULE_BODY");
    expect(serialized).not.toContain(projectDir);
    expect(serialized).not.toContain("/Users/example");
  });

  it("returns setup guidance instead of a hard error when storage is unavailable", () => {
    const dataDir = join(tmpdir(), `prompt-memory-missing-${randomUUID()}`);
    const result = coachPromptTool({}, { dataDir });
    const serialized = JSON.stringify(result);

    expect(result.mode).toBe("agent_coach");
    expect(result.status.status).toBe("setup_needed");
    expect(result.agent_brief.next_actions).toEqual(
      expect.arrayContaining([
        "Run prompt-memory start to see the shortest setup -> real prompt -> coach path.",
        "Run prompt-memory setup --profile coach --register-mcp, then submit one real Claude Code or Codex prompt.",
        "Run prompt-memory server if connected tools cannot reach the local service.",
      ]),
    );
    expect(serialized).not.toContain(dataDir);
    expect(serialized).not.toContain("/tmp/");
  });
});

function createTempDir(): string {
  const dir = join(tmpdir(), `prompt-memory-mcp-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

async function storeClaudePrompt(
  storage: ReturnType<typeof createSqlitePromptStorage>,
  prompt: string,
  receivedAt: string,
  cwd = "/Users/example/project",
) {
  const event = normalizeClaudeCodePayload(
    {
      session_id: `session-${receivedAt}`,
      transcript_path: "/Users/example/.claude/session.jsonl",
      cwd,
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

function nextDate(values: string[]): () => Date {
  let index = 0;

  return () => new Date(values[index++] ?? values.at(-1)!);
}
