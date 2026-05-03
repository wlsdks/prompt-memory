import {
  Copy,
  Gauge,
  PanelTop,
  Plug,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useState } from "react";

import type { ArchiveScoreReport, QualityDashboard } from "./api.js";
import { copyTextToClipboard } from "./clipboard.js";
import "./agent-command-center.css";

type AgentCommand = {
  id: string;
  command: string;
  detail: string;
  label: string;
  surface: "Claude Code" | "MCP" | "CLI";
};

export type AgentCommandSnapshot = {
  score: string;
  scoredPrompts: string;
  nextAction: string;
  commands: AgentCommand[];
};

export function createAgentCommandSnapshot({
  archiveScore,
  dashboard,
}: {
  archiveScore?: ArchiveScoreReport;
  dashboard?: QualityDashboard;
}): AgentCommandSnapshot {
  const average =
    archiveScore?.archive_score.average ?? dashboard?.quality_score.average;
  const scored =
    archiveScore?.archive_score.scored_prompts ??
    dashboard?.quality_score.scored_prompts ??
    0;
  const total =
    archiveScore?.archive_score.total_prompts ?? dashboard?.total_prompts ?? 0;
  const reviewCount =
    archiveScore?.low_score_prompts.filter(
      (prompt) => prompt.quality_score_band === "weak",
    ).length ?? 0;
  const topGap =
    archiveScore?.top_gaps[0]?.label ?? dashboard?.missing_items[0]?.label;

  return {
    score: average === undefined ? "-" : `${average}`,
    scoredPrompts: `${scored}/${total}`,
    nextAction: topGap
      ? `Review ${topGap}`
      : reviewCount > 0
        ? `${reviewCount} weak prompts`
        : "Capture one real prompt",
    commands: [
      {
        id: "coach",
        command: "/prompt-memory:coach",
        detail:
          "One-call score, habits, rewrite guidance, and next request brief.",
        label: "Coach latest prompt",
        surface: "Claude Code",
      },
      {
        id: "score-last",
        command: "/prompt-memory:score-last",
        detail: "Check the prompt you just sent without opening the web UI.",
        label: "Score last prompt",
        surface: "Claude Code",
      },
      {
        id: "improve-last",
        command: "/prompt-memory:improve-last",
        detail:
          "Generate an approval-ready improvement draft for manual paste.",
        label: "Improve last prompt",
        surface: "Claude Code",
      },
      {
        id: "mcp-coach",
        command:
          "prompt-memory:coach_prompt include_latest_score=true include_archive=true",
        detail:
          "Use the MCP tool from Claude Code or Codex for one-call score, habits, and next request guidance.",
        label: "MCP coach workflow",
        surface: "MCP",
      },
      {
        id: "mcp-score-latest",
        command: "prompt-memory:score_prompt latest=true",
        detail: "Use the MCP tool when you only need the latest prompt score.",
        label: "MCP score latest",
        surface: "MCP",
      },
      {
        id: "buddy",
        command: "prompt-memory buddy",
        detail:
          "Keep a compact always-on prompt score companion in a side pane.",
        label: "Open side buddy",
        surface: "CLI",
      },
      {
        id: "statusline",
        command: "prompt-memory install-statusline claude-code",
        detail:
          "Add prompt-memory under the existing Claude HUD without replacing it.",
        label: "Install HUD line",
        surface: "CLI",
      },
    ],
  };
}

export function AgentCommandCenter({
  archiveScore,
  dashboard,
}: {
  archiveScore?: ArchiveScoreReport;
  dashboard?: QualityDashboard;
}) {
  const snapshot = createAgentCommandSnapshot({ archiveScore, dashboard });
  const [copiedCommandId, setCopiedCommandId] = useState<string | undefined>();

  async function copyCommand(command: AgentCommand): Promise<void> {
    const copied = await copyTextToClipboard(command.command);
    if (!copied) {
      return;
    }

    setCopiedCommandId(command.id);
    window.setTimeout(() => setCopiedCommandId(undefined), 1800);
  }

  return (
    <section
      className="agent-command-center panel"
      aria-label="Agent command center"
    >
      <div className="agent-command-header">
        <div>
          <p className="eyebrow">Agent cockpit</p>
          <h2>Use prompt-memory inside Claude Code or Codex</h2>
          <span>
            Keep the web UI for review, then run these commands directly in the
            coding agent loop.
          </span>
          <p className="agent-command-privacy">
            <ShieldCheck size={14} /> Local-only shortcuts. This panel does not
            render prompt bodies, raw paths, or tokens.
          </p>
        </div>
        <div
          className="agent-command-snapshot"
          aria-label="Current coaching snapshot"
        >
          <span>
            <Gauge size={14} /> score <strong>{snapshot.score}</strong>
          </span>
          <span>
            <PanelTop size={14} /> scored{" "}
            <strong>{snapshot.scoredPrompts}</strong>
          </span>
          <span>
            <Plug size={14} /> next <strong>{snapshot.nextAction}</strong>
          </span>
        </div>
      </div>

      <div className="agent-command-body">
        <div className="agent-command-next">
          <span>Next best move</span>
          <strong>{snapshot.nextAction}</strong>
          <p>
            Start with Coach in the agent session, then use the web dashboard
            only when you want to review history or trends.
          </p>
        </div>
        <div className="agent-command-list" role="list">
          {snapshot.commands.map((command) => (
            <article
              className="agent-command-card"
              key={command.id}
              role="listitem"
            >
              <div>
                <span className="agent-command-surface">
                  <Terminal size={14} />
                  {command.surface}
                </span>
                <strong>{command.label}</strong>
                <p>
                  {copiedCommandId === command.id
                    ? "Copied command"
                    : command.detail}
                </p>
              </div>
              <div className="agent-command-copyline">
                <code>{command.command}</code>
                <button
                  aria-label={`Copy ${command.label}`}
                  className="icon-button"
                  onClick={() => void copyCommand(command)}
                  type="button"
                >
                  <Copy size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
