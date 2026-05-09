import { describe, expect, it } from "vitest";

import {
  createPromptAgentActionSnapshot,
  type PromptAgentActionSnapshot,
} from "./prompt-agent-actions.js";
import type { PromptDetail } from "./api.js";

describe("createPromptAgentActionSnapshot", () => {
  it("builds selected-prompt agent actions without prompt bodies or local paths", () => {
    const snapshot = createPromptAgentActionSnapshot(createPromptDetail());

    expect(snapshot.heading).toBe("Continue in Claude Code or Codex");
    expect(snapshot.promptLabel).toBe("claude-code · 44/100 weak");
    expect(command(snapshot, "mcp-score")).toBe(
      "prompt-coach:score_prompt prompt_id=prompt_abc123 include_suggestions=true",
    );
    expect(command(snapshot, "mcp-improve")).toBe(
      "prompt-coach:improve_prompt prompt_id=prompt_abc123",
    );
    expect(command(snapshot, "agent-rewrite")).toBe(
      "prompt-coach:prepare_agent_rewrite prompt_id=prompt_abc123 include_local_baseline=true",
    );
    expect(command(snapshot, "open-stored")).toBe(
      "prompt-coach show prompt_abc123 --json",
    );
    expect(JSON.stringify(snapshot)).not.toContain("/Users/example");
    expect(JSON.stringify(snapshot)).not.toContain("sk-proj");
    expect(JSON.stringify(snapshot)).not.toContain("Fix payment service");
  });
});

function command(snapshot: PromptAgentActionSnapshot, id: string): string {
  return snapshot.actions.find((action) => action.id === id)?.command ?? "";
}

function createPromptDetail(): PromptDetail {
  return {
    adapter_version: "test",
    analysis: undefined,
    created_at: "2026-05-04T00:00:00.000Z",
    cwd: "/Users/example/private",
    duplicate_count: 0,
    excluded_from_analysis: false,
    id: "prompt_abc123",
    improvement_drafts: [],
    index_status: "indexed",
    is_sensitive: false,
    markdown:
      "Fix payment service with sk-proj-123. Goal is vague and output is unclear.",
    prompt_length: 72,
    quality_gaps: ["goal_clarity", "output_format"],
    quality_score: 44,
    quality_score_band: "weak",
    received_at: "2026-05-04T00:00:00.000Z",
    redaction_policy: "mask",
    session_id: "session_1",
    snippet: "Fix payment service",
    source_event: "UserPromptSubmit",
    tags: ["bugfix"],
    tool: "claude-code",
    usefulness: {
      bookmarked: false,
      copied_count: 0,
    },
  };
}
