import { Copy, Gauge, PanelTop, Plug, Terminal } from "lucide-react";
import { useState } from "react";

import type { ArchiveScoreReport, QualityDashboard } from "./api.js";
import { copyTextToClipboard } from "./clipboard.js";

type AgentCommand = {
  id: string;
  command: string;
  detail: string;
  label: string;
  surface: "Claude Code" | "Codex" | "CLI";
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

      <div className="agent-command-list">
        {snapshot.commands.map((command) => (
          <article className="agent-command-card" key={command.id}>
            <div className="agent-command-card-header">
              <span>
                <Terminal size={14} />
                {command.surface}
              </span>
              <button
                aria-label={`Copy ${command.label}`}
                className="icon-button"
                onClick={() => void copyCommand(command)}
                type="button"
              >
                <Copy size={14} />
              </button>
            </div>
            <strong>{command.label}</strong>
            <code>{command.command}</code>
            <p>
              {copiedCommandId === command.id
                ? "Copied command"
                : command.detail}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
