import { useState } from "react";

import {
  previewImportDryRun,
  type ImportDryRunResult,
  type ImportSourceType,
} from "./api.js";
import "./import-view.css";

const SOURCE_TYPES: Array<{ value: ImportSourceType; label: string }> = [
  { value: "manual-jsonl", label: "Manual JSONL" },
  {
    value: "claude-transcript-best-effort",
    label: "Claude Code transcript (best effort)",
  },
  {
    value: "codex-transcript-best-effort",
    label: "Codex transcript (best effort)",
  },
  { value: "official-hook", label: "Official hook export" },
];

export function ImportView() {
  const [sourceType, setSourceType] =
    useState<ImportSourceType>("manual-jsonl");
  const [fileName, setFileName] = useState<string | undefined>();
  const [content, setContent] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<ImportDryRunResult | undefined>();

  function reset(): void {
    setFileName(undefined);
    setContent("");
    setResult(undefined);
    setError(undefined);
  }

  async function readFile(file: File): Promise<void> {
    setError(undefined);
    setResult(undefined);
    try {
      const text = await file.text();
      setFileName(file.name);
      setContent(text);
    } catch {
      setError("Could not read the selected file.");
    }
  }

  async function runDryRun(): Promise<void> {
    if (!content) return;
    setBusy(true);
    setError(undefined);
    try {
      const summary = await previewImportDryRun({ sourceType, content });
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import dry-run failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-layout">
      <section className="panel" aria-label="Import transcript">
        <div className="analysis-header">
          <div>
            <p className="eyebrow">Transcript import</p>
            <h2>Upload a JSONL transcript for a dry-run</h2>
          </div>
        </div>
        <p className="analysis-summary">
          Pick a `.jsonl` file. The server runs a dry-run only — nothing is
          written to your archive. The file is held in a temporary location and
          removed as soon as the dry-run completes.
        </p>

        <label className="import-source-label" htmlFor="import-source">
          Source type
        </label>
        <select
          id="import-source"
          className="import-source-select"
          value={sourceType}
          onChange={(event) =>
            setSourceType(event.target.value as ImportSourceType)
          }
        >
          {SOURCE_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="import-dropzone" htmlFor="import-file">
          <input
            id="import-file"
            type="file"
            accept=".jsonl,application/jsonlines,application/json,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
          <span>
            {fileName
              ? `Selected: ${fileName} (${formatBytes(content.length)})`
              : "Click to select a .jsonl file"}
          </span>
        </label>

        <div className="import-actions">
          <button
            className="import-primary"
            disabled={!content || busy}
            onClick={() => void runDryRun()}
            type="button"
          >
            {busy ? "Running dry-run..." : "Run dry-run"}
          </button>
          <button
            className="import-secondary"
            disabled={busy}
            onClick={reset}
            type="button"
          >
            Reset
          </button>
        </div>

        {error && <p className="import-error">{error}</p>}

        {result && (
          <section className="import-result" aria-label="Import dry-run result">
            <h3>Dry-run summary</h3>
            <dl>
              <dt>Source type</dt>
              <dd>{result.source_type}</dd>
              <dt>Records read</dt>
              <dd>{result.records_read}</dd>
              <dt>Prompt candidates</dt>
              <dd>{result.prompt_candidates}</dd>
              <dt>Sensitive candidates</dt>
              <dd>{result.sensitive_prompt_count}</dd>
              <dt>Parse errors</dt>
              <dd>{result.parse_errors}</dd>
              <dt>Skipped (assistant/tool)</dt>
              <dd>{result.skipped_records.assistant_or_tool}</dd>
              <dt>Skipped (too large)</dt>
              <dd>{result.skipped_records.too_large}</dd>
            </dl>
            <p className="muted">
              Execute is intentionally CLI-only for now. Use{" "}
              <code>
                prompt-memory import --execute --file ... --source{" "}
                {result.source_type}
              </code>{" "}
              after reviewing this summary.
            </p>
          </section>
        )}
      </section>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
