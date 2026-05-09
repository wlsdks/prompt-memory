import type { QualityDashboard, SettingsResponse } from "./api.js";

export const MCP_FLOW_STEPS = [
  {
    tool: "get_prompt_coach_status",
    detail:
      "Check setup, capture readiness, latest safe metadata, and the next tool to call.",
  },
  {
    tool: "coach_prompt",
    detail:
      "Run the default one-call coach: latest score, rewrite guidance, habit review, project rules, and next request guidance.",
  },
  {
    tool: "score_prompt",
    detail:
      "Score the latest, a pasted prompt, or a stored prompt id when the user asks about one request.",
  },
  {
    tool: "improve_prompt",
    detail:
      "Generate an approval-ready rewritten request when the user wants to resubmit a better prompt.",
  },
  {
    tool: "score_prompt_archive",
    detail:
      "Review accumulated prompt habits, recurring gaps, and low-score review candidates.",
  },
  {
    tool: "review_project_instructions",
    detail:
      "Score AGENTS.md / CLAUDE.md rules when the user asks whether agent instructions are strong enough.",
  },
];

export const MCP_TOOL_CATALOG = [
  {
    kind: "preflight",
    name: "get_prompt_coach_status",
    title: "Check capture readiness first",
    when: "The user asks if prompt-coach is working, whether prompts are being captured, or what to do next.",
    returns:
      "Ready/setup status, safe prompt counts, latest prompt metadata, available tools, and next actions.",
    assurances: ["read-only", "local-only", "structured JSON", "output schema"],
    privacy:
      "No prompt body, no raw absolute path, no external LLM call, no secret value.",
    prompt:
      "Use prompt-coach get_prompt_coach_status and tell me whether capture is working before scoring anything.",
  },
  {
    kind: "coach",
    name: "coach_prompt",
    title: "Run the default prompt coach",
    when: "The user asks to review the latest request, improve the next prompt, summarize habits, or get one agent-native coaching result without opening the web UI.",
    returns:
      "Local readiness, latest prompt score, approval-required rewrite status, archive habit review, project rule review, next actions, and privacy guarantees.",
    assurances: ["read-only", "local-only", "structured JSON", "output schema"],
    privacy:
      "No prompt body, no raw absolute path, no instruction file body, no external LLM call, and no auto-submit.",
    prompt:
      "Use prompt-coach coach_prompt and give me the latest score, first fix, recurring habit gap, and next request guidance.",
  },
  {
    kind: "single prompt",
    name: "score_prompt",
    title: "Evaluate one request",
    when: "The user wants feedback on the current request, a pasted prompt, one stored prompt id, or the latest captured prompt.",
    returns:
      "0-100 quality score, checklist, warnings, and concise improvement suggestions.",
    assurances: ["read-only", "local-only", "structured JSON", "output schema"],
    privacy:
      "Direct prompt input is analyzed locally and not stored by this MCP tool.",
    prompt:
      "Use prompt-coach score_prompt with latest=true and tell me what to improve in my last request.",
  },
  {
    kind: "rewrite",
    name: "improve_prompt",
    title: "Rewrite before resubmission",
    when: "The user wants a clearer prompt draft to approve, copy, and manually resubmit to Claude Code or Codex.",
    returns:
      "Approval-ready improved prompt draft, changed sections, safety notes, and next action.",
    assurances: ["read-only", "local-only", "structured JSON", "output schema"],
    privacy:
      "No auto-submit, no external LLM call, and direct prompt input is not stored.",
    prompt:
      "Use prompt-coach improve_prompt with latest=true and give me an approval-ready draft I can copy and resubmit.",
  },
  {
    kind: "advanced rewrite",
    name: "prepare_agent_rewrite",
    title: "Prepare one prompt for semantic agent rewrite",
    when: "The user explicitly wants Claude Code, Codex, or Gemini CLI to improve a stored prompt beyond the local deterministic rewrite.",
    returns:
      "One redacted prompt packet, local score metadata, local baseline rewrite, rewrite contract, and agent instructions.",
    assurances: ["read-only", "opt-in", "redacted packet", "output schema"],
    privacy:
      "prompt-coach makes no external provider call; the redacted prompt is returned only to the active user-controlled agent session.",
    prompt:
      "Use prompt-coach prepare_agent_rewrite with latest=true. Rewrite that redacted prompt yourself, then ask before saving it.",
  },
  {
    kind: "advanced rewrite",
    name: "record_agent_rewrite",
    title: "Store the agent rewrite draft",
    when: "The active agent has already rewritten a prepare_agent_rewrite packet and the user wants the improved draft saved locally.",
    returns:
      "Saved draft metadata, agent metadata, next action, and privacy guarantees.",
    assurances: ["write tool", "local-only", "redacted draft", "output schema"],
    privacy:
      "Stores a redacted rewrite draft and metadata only; does not store the original prompt body, return the rewrite body, or store raw paths.",
    prompt:
      "After I approve your rewrite, call prompt-coach record_agent_rewrite with provider, prompt_id, improved_prompt, confidence, summary, and changed_sections.",
  },
  {
    kind: "archive",
    name: "score_prompt_archive",
    title: "Find habit patterns",
    when: "The user wants Claude Code or Codex to review many stored prompts and identify repeated weak habits.",
    returns:
      "Aggregate archive score, distribution, recurring gaps, practice plan, next prompt template, and low-score prompt metadata.",
    assurances: ["read-only", "local-only", "structured JSON", "output schema"],
    privacy:
      "Returns metadata only; no prompt bodies and no raw absolute paths.",
    prompt:
      "Use prompt-coach score_prompt_archive for recent Codex prompts and summarize my recurring prompt habit gaps.",
  },
  {
    kind: "project rules",
    name: "review_project_instructions",
    title: "Review AGENTS.md / CLAUDE.md",
    when: "The user asks if coding-agent rules are strong enough for a captured project.",
    returns:
      "Project instruction score, checklist status, file metadata, suggestions, and next action.",
    assurances: ["read-only", "local-only", "structured JSON", "output schema"],
    privacy: "Returns no instruction file bodies and no raw absolute paths.",
    prompt:
      "Use prompt-coach review_project_instructions with latest=true and tell me whether my AGENTS.md/CLAUDE.md rules are strong enough.",
  },
  {
    kind: "advanced judge",
    name: "prepare_agent_judge_batch",
    title: "Prepare low-score prompts for agent judgment",
    when: "The user explicitly asks the active Claude Code, Codex, or Gemini CLI session to judge accumulated prompt quality with an LLM-style review.",
    returns:
      "A bounded packet of locally redacted prompt bodies, local score metadata, quality gaps, and a rubric for the active agent session.",
    assurances: ["read-only", "opt-in", "redacted packet", "output schema"],
    privacy:
      "prompt-coach makes no external provider call; redacted prompt bodies are returned only for the active user-controlled agent session.",
    prompt:
      "Use prompt-coach prepare_agent_judge_batch with selection=low_score and max_prompts=5. Judge those redacted prompts yourself.",
  },
  {
    kind: "advanced judge",
    name: "record_agent_judgments",
    title: "Store advisory agent judgment scores",
    when: "The active agent has already evaluated a prepare_agent_judge_batch packet and the user wants those advisory scores saved locally.",
    returns:
      "Recorded count, saved judgment metadata, failed prompt ids, and the next action.",
    assurances: ["write tool", "local-only", "metadata only", "output schema"],
    privacy:
      "Stores scores, confidence, risks, and suggestions only; no prompt bodies, raw paths, or provider credentials.",
    prompt:
      "After judging the prepared packet, call prompt-coach record_agent_judgments with one score, confidence, summary, risks, and suggestions per prompt_id.",
  },
];

type McpReadinessTone = "ready" | "warning" | "muted";

export type McpReadiness = {
  status: string;
  tone: McpReadinessTone;
  summary: string;
  firstCall: string;
  nextAction: string;
  metrics: Array<{
    label: string;
    value: string;
  }>;
};

export function createMcpReadiness({
  dashboard,
  health,
  settings,
}: {
  dashboard?: QualityDashboard;
  health?: { ok: boolean; version: string };
  settings?: SettingsResponse;
}): McpReadiness {
  const totalPrompts = dashboard?.total_prompts;
  const scoredPrompts = dashboard?.quality_score.scored_prompts;
  const redactionMode = settings?.redaction_mode ?? "-";
  const serverStatus = health?.ok ? "Server OK" : "Checking status";

  let status = "Checking archive";
  let tone: McpReadinessTone = "muted";
  let summary =
    "Load local archive status before asking Claude Code or Codex to score prompt habits.";
  let firstCall = "get_prompt_coach_status";
  let nextAction =
    "Use the status tool first so the agent can confirm capture, scoring, and privacy readiness.";

  if (health && !health.ok) {
    status = "Server unavailable";
    tone = "warning";
    summary =
      "Start the local prompt-coach server before using Claude Code or Codex MCP tools.";
    nextAction =
      "Run prompt-coach server, then call get_prompt_coach_status from the agent.";
  } else if (redactionMode === "raw") {
    status = "Privacy check needed";
    tone = "warning";
    summary =
      "MCP tools avoid prompt bodies, but raw redaction mode should be reviewed before sharing reports.";
    nextAction =
      "Switch redaction to mask or review local settings before asking an agent to summarize results.";
  } else if (totalPrompts === 0) {
    status = "Capture prompts first";
    tone = "warning";
    summary =
      "No stored prompts are available yet, so archive scoring cannot reveal habit patterns.";
    nextAction =
      "Capture a few Claude Code or Codex prompts, then call get_prompt_coach_status again.";
  } else if (scoredPrompts === 0) {
    status = "Ready to score";
    tone = "ready";
    summary =
      "Stored prompts are available; the next useful step is the default one-call coach.";
    firstCall = "coach_prompt";
    nextAction =
      "Ask the agent to run coach_prompt for score, rewrite guidance, and recurring habit gaps.";
  } else if (typeof scoredPrompts === "number" && scoredPrompts > 0) {
    status = "Ready for archive review";
    tone = "ready";
    summary =
      "Stored and scored prompts are ready for Claude Code or Codex habit analysis.";
    firstCall = "coach_prompt";
    nextAction =
      "Run coach_prompt for the default one-call coach, or score_prompt_archive when you only want a pattern review.";
  }

  return {
    firstCall,
    metrics: [
      {
        label: "Stored prompts",
        value: typeof totalPrompts === "number" ? String(totalPrompts) : "-",
      },
      {
        label: "Scored prompts",
        value: typeof scoredPrompts === "number" ? String(scoredPrompts) : "-",
      },
      {
        label: "Redaction",
        value: redactionMode,
      },
      {
        label: "Server",
        value: serverStatus,
      },
    ],
    nextAction,
    status,
    summary,
    tone,
  };
}
