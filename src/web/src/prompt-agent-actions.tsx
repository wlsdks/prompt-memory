import { Copy, FileJson, Sparkles, Target, WandSparkles } from "lucide-react";
import { useState } from "react";

import type { PromptDetail } from "./api.js";
import { copyTextToClipboard } from "./clipboard.js";
import "./prompt-agent-actions.css";

type PromptAgentAction = {
  id: string;
  command: string;
  detail: string;
  icon: "score" | "improve" | "agent" | "json";
  label: string;
  surface: "MCP" | "CLI";
};

export type PromptAgentActionSnapshot = {
  heading: string;
  promptLabel: string;
  actions: PromptAgentAction[];
};

type PromptAgentActionInput = Pick<
  PromptDetail,
  "id" | "quality_score" | "quality_score_band" | "tool"
>;

export function createPromptAgentActionSnapshot(
  prompt: PromptAgentActionInput,
): PromptAgentActionSnapshot {
  return {
    heading: "Continue in Claude Code or Codex",
    promptLabel: `${prompt.tool} · ${prompt.quality_score}/100 ${prompt.quality_score_band}`,
    actions: [
      {
        id: "mcp-score",
        command: `prompt-memory:score_prompt prompt_id=${prompt.id} include_suggestions=true`,
        detail: "Re-score this stored prompt and return the exact weak fields.",
        icon: "score",
        label: "Score selected prompt",
        surface: "MCP",
      },
      {
        id: "mcp-improve",
        command: `prompt-memory:improve_prompt prompt_id=${prompt.id}`,
        detail: "Create a copy-ready local rewrite without auto-submitting it.",
        icon: "improve",
        label: "Create local rewrite",
        surface: "MCP",
      },
      {
        id: "agent-rewrite",
        command: `prompt-memory:prepare_agent_rewrite prompt_id=${prompt.id} include_local_baseline=true`,
        detail:
          "Ask the active agent session to rewrite the redacted packet, then record the result if useful.",
        icon: "agent",
        label: "Agent-assisted rewrite",
        surface: "MCP",
      },
      {
        id: "open-stored",
        command: `prompt-memory show ${prompt.id} --json`,
        detail: "Inspect the stored metadata from the terminal when debugging.",
        icon: "json",
        label: "Inspect stored record",
        surface: "CLI",
      },
    ],
  };
}

export function PromptAgentActionsPanel({ prompt }: { prompt: PromptDetail }) {
  const snapshot = createPromptAgentActionSnapshot(prompt);
  const [copiedActionId, setCopiedActionId] = useState<string | undefined>();

  async function copyAction(action: PromptAgentAction): Promise<void> {
    const copied = await copyTextToClipboard(action.command);
    if (!copied) {
      return;
    }

    setCopiedActionId(action.id);
    window.setTimeout(() => setCopiedActionId(undefined), 1800);
  }

  return (
    <section
      aria-label="Selected prompt agent actions"
      className="prompt-agent-actions"
    >
      <div className="prompt-agent-actions-header">
        <div>
          <p className="eyebrow">Agent follow-up</p>
          <h2>{snapshot.heading}</h2>
          <span>{snapshot.promptLabel}</span>
        </div>
        <p>
          Copy one command into Claude Code or Codex. These commands use only
          the stored prompt id.
        </p>
      </div>
      <div className="prompt-agent-action-grid" role="list">
        {snapshot.actions.map((action) => (
          <article
            className="prompt-agent-action-card"
            key={action.id}
            role="listitem"
          >
            <div className="prompt-agent-action-title">
              <PromptAgentActionIcon icon={action.icon} />
              <div>
                <span>{action.surface}</span>
                <strong>{action.label}</strong>
              </div>
            </div>
            <p>
              {copiedActionId === action.id ? "Copied command" : action.detail}
            </p>
            <div className="prompt-agent-action-command">
              <code>{action.command}</code>
              <button
                aria-label={`Copy ${action.label}`}
                className="icon-button"
                onClick={() => void copyAction(action)}
                type="button"
              >
                <Copy size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PromptAgentActionIcon({ icon }: { icon: PromptAgentAction["icon"] }) {
  if (icon === "score") return <Target size={16} />;
  if (icon === "improve") return <WandSparkles size={16} />;
  if (icon === "agent") return <Sparkles size={16} />;
  return <FileJson size={16} />;
}
