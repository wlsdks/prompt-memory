import { Copy, ShieldCheck } from "lucide-react";
import { useState } from "react";

import type { QualityDashboard, SettingsResponse } from "./api.js";
import { copyTextToClipboard } from "./clipboard.js";
import {
  MCP_FLOW_STEPS,
  MCP_TOOL_CATALOG,
  createMcpReadiness,
  type McpReadiness,
} from "./mcp-catalog.js";

export function McpToolsView({
  dashboard,
  health,
  settings,
}: {
  dashboard?: QualityDashboard;
  health?: { ok: boolean; version: string };
  settings?: SettingsResponse;
}) {
  const [copiedKey, setCopiedKey] = useState<string | undefined>();
  const readiness = createMcpReadiness({ dashboard, health, settings });

  async function copySnippet(key: string, value: string): Promise<void> {
    const copied = await copyTextToClipboard(value);
    if (!copied) return;
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(undefined), 2200);
  }

  return (
    <div className="mcp-layout">
      <section className="mcp-hero panel">
        <div>
          <p className="eyebrow">Agent tool surface</p>
          <h2>Use prompt-memory from Claude Code or Codex</h2>
          <p>
            Start with status, then choose the scoring or project-rule review
            tool that matches the user request.
          </p>
        </div>
        <div className="mcp-command-stack" aria-label="MCP setup commands">
          <CopyableCommand
            copied={copiedKey === "mcp-command"}
            label="Server command"
            onCopy={() => void copySnippet("mcp-command", "prompt-memory mcp")}
            value="prompt-memory mcp"
          />
          <CopyableCommand
            copied={copiedKey === "claude-command"}
            label="Claude Code"
            onCopy={() =>
              void copySnippet(
                "claude-command",
                "claude mcp add --transport stdio prompt-memory -- prompt-memory mcp",
              )
            }
            value="claude mcp add --transport stdio prompt-memory -- prompt-memory mcp"
          />
          <CopyableCommand
            copied={copiedKey === "codex-command"}
            label="Codex"
            onCopy={() =>
              void copySnippet(
                "codex-command",
                "codex mcp add prompt-memory -- prompt-memory mcp",
              )
            }
            value="codex mcp add prompt-memory -- prompt-memory mcp"
          />
        </div>
      </section>

      <McpReadinessPanel readiness={readiness} />

      <section className="mcp-flow panel" aria-label="Recommended MCP flow">
        <div className="panel-heading-row">
          <h2>Core call order</h2>
          <span>{MCP_FLOW_STEPS.length} core tools</span>
        </div>
        <div className="mcp-flow-steps">
          {MCP_FLOW_STEPS.map((step, index) => (
            <article className="mcp-flow-step" key={step.tool}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.tool}</strong>
                <p>{step.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mcp-tool-grid" aria-label="MCP tool catalog">
        {MCP_TOOL_CATALOG.map((tool) => (
          <article className="mcp-tool-card" key={tool.name}>
            <div className="mcp-tool-header">
              <span className="badge">{tool.kind}</span>
              <code>{tool.name}</code>
            </div>
            <h2>{tool.title}</h2>
            <dl>
              <dt>Use when</dt>
              <dd>{tool.when}</dd>
              <dt>Returns</dt>
              <dd>{tool.returns}</dd>
              <dt>Behavior</dt>
              <dd>
                <span className="mcp-assurance-row">
                  {tool.assurances.map((assurance) => (
                    <span className="mcp-assurance" key={assurance}>
                      {assurance}
                    </span>
                  ))}
                </span>
              </dd>
              <dt>Privacy</dt>
              <dd>{tool.privacy}</dd>
            </dl>
            <div className="mcp-example">
              <span>Agent prompt</span>
              <code>{tool.prompt}</code>
              <button
                aria-label={`Copy ${tool.name} example`}
                className="icon-button"
                onClick={() => void copySnippet(tool.name, tool.prompt)}
                title={`Copy ${tool.name} example`}
                type="button"
              >
                <Copy size={15} />
              </button>
            </div>
            {copiedKey === tool.name && <small>Copied example</small>}
          </article>
        ))}
      </section>
    </div>
  );
}

function McpReadinessPanel({ readiness }: { readiness: McpReadiness }) {
  return (
    <section className="mcp-readiness panel" aria-label="MCP readiness">
      <div className="mcp-readiness-header">
        <div>
          <p className="eyebrow">Live agent preflight</p>
          <h2>MCP readiness</h2>
          <p>{readiness.summary}</p>
        </div>
        <span className={`status-pill ${readiness.tone}`}>
          {readiness.status}
        </span>
      </div>
      <div className="mcp-readiness-grid">
        {readiness.metrics.map((metric) => (
          <div className="mcp-readiness-metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <div className="mcp-next-action">
        <span>First MCP call</span>
        <code>{readiness.firstCall}</code>
        <p>{readiness.nextAction}</p>
      </div>
    </section>
  );
}

function CopyableCommand({
  copied,
  label,
  onCopy,
  value,
}: {
  copied: boolean;
  label: string;
  onCopy(): void;
  value: string;
}) {
  return (
    <div className="copyable-command">
      <span>{label}</span>
      <code>{value}</code>
      <button
        aria-label={`Copy ${label}`}
        className="icon-button"
        onClick={onCopy}
        title={`Copy ${label}`}
        type="button"
      >
        {copied ? <ShieldCheck size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}
