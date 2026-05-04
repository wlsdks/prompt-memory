import { Sparkles } from "lucide-react";

import type { PromptDetail, PromptJudgeScore } from "./api.js";
import { formatDate } from "./formatters.js";

const SIGNIFICANT_DELTA = 15;

export function JudgeScorePanel({ prompt }: { prompt: PromptDetail }) {
  if (!prompt.judge_score) {
    return null;
  }

  const judge = prompt.judge_score;
  const localScore = prompt.quality_score;
  const delta = judge.score - localScore;
  const showDelta = Math.abs(delta) >= SIGNIFICANT_DELTA;
  const deltaClass = delta >= 0 ? "judge-delta-up" : "judge-delta-down";

  return (
    <section className="judge-score-panel" aria-label="LLM judge score">
      <header>
        <div>
          <p className="eyebrow">
            <Sparkles size={14} aria-hidden="true" /> LLM judge
          </p>
          <h3>Independent score from {labelForTool(judge.judge_tool)}</h3>
        </div>
        <div className="judge-score-box">
          <span className="judge-score-value">{judge.score}</span>
          <small>
            vs local {localScore}
            {showDelta && (
              <span className={`judge-delta ${deltaClass}`}>
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            )}
          </small>
        </div>
      </header>
      <p className="judge-reason">{judge.reason}</p>
      <footer>
        <span className="judge-meta">
          Scored {formatDate(judge.created_at)}
        </span>
      </footer>
    </section>
  );
}

function labelForTool(tool: PromptJudgeScore["judge_tool"]): string {
  return tool === "claude" ? "Claude Code" : "Codex";
}
