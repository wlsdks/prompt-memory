import type { Command } from "commander";

import { loadHookAuth, loadPromptMemoryConfig } from "../../config/config.js";
import { createSqlitePromptStorage } from "../../storage/sqlite.js";

type PromptCliOptions = {
  dataDir?: string;
  importJob?: string;
  importJobId?: string;
  limit?: string | number;
  json?: boolean;
};

type PromptIdOptions = {
  dataDir?: string;
  json?: boolean;
};

type ShowPromptCliOptions = PromptIdOptions & {
  explain?: boolean;
};

export function registerPromptCommands(program: Command): void {
  program
    .command("list")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--import-job <id>", "Only show prompts produced by an import job.")
    .option("--limit <count>", "Maximum number of prompts to show.")
    .option("--json", "Print JSON.")
    .action((options: PromptCliOptions) => {
      console.log(listPromptsForCli(options));
    });

  program
    .command("search")
    .argument("<query>", "FTS query.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option(
      "--import-job <id>",
      "Only search prompts produced by an import job.",
    )
    .option("--limit <count>", "Maximum number of prompts to show.")
    .option("--json", "Print JSON.")
    .action((query: string, options: PromptCliOptions) => {
      console.log(searchPromptsForCli(query, options));
    });

  program
    .command("show")
    .argument("<id>", "Prompt id.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--json", "Print JSON.")
    .option(
      "--explain",
      "Print the per-criterion score breakdown and analysis reasons.",
    )
    .action((id: string, options: ShowPromptCliOptions) => {
      console.log(showPromptForCli(id, options));
    });

  program
    .command("delete")
    .argument("<id>", "Prompt id.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--json", "Print JSON.")
    .action((id: string, options: PromptIdOptions) => {
      console.log(deletePromptForCli(id, options));
    });

  program
    .command("open")
    .argument("<id>", "Prompt id.")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .action((id: string, options: PromptIdOptions) => {
      console.log(openPromptForCli(id, options));
    });

  program
    .command("rebuild-index")
    .option("--data-dir <path>", "Override the prompt-memory data directory.")
    .option("--json", "Print JSON.")
    .action((options: PromptIdOptions) => {
      console.log(rebuildIndexForCli(options));
    });
}

export function listPromptsForCli(options: PromptCliOptions = {}): string {
  return withStorage(options.dataDir, (storage) => {
    const result = storage.listPrompts({
      importJobId: options.importJobId ?? options.importJob,
      limit: parseLimit(options.limit),
    });
    if (options.json) {
      return JSON.stringify(result, null, 2);
    }
    if (result.items.length === 0) {
      return "no prompts captured yet.";
    }
    const draftCounts = storage.countImprovementDraftsByPromptIds(
      result.items.map((row) => row.id),
    );
    return formatHumanResult(result, draftCounts, {
      header: `${result.items.length} prompt${result.items.length === 1 ? "" : "s"}`,
      moreHint: "more available — pass --limit higher to see more",
    });
  });
}

// Keep in sync with toSafeFtsQuery's slice(0, 8) in src/storage/sqlite.ts.
const FTS_QUERY_TOKEN_LIMIT = 8;

export function searchPromptsForCli(
  query: string,
  options: PromptCliOptions = {},
): string {
  return withStorage(options.dataDir, (storage) => {
    const result = storage.searchPrompts(query, {
      importJobId: options.importJobId ?? options.importJob,
      limit: parseLimit(options.limit),
    });
    if (options.json) {
      return JSON.stringify(result, null, 2);
    }
    const tokenCount = (query.match(/[\p{L}\p{N}_-]+/gu) ?? []).length;
    const truncatedTokens =
      tokenCount > FTS_QUERY_TOKEN_LIMIT
        ? `using first ${FTS_QUERY_TOKEN_LIMIT} of ${tokenCount} query words — drop the extras for a tighter match`
        : undefined;
    if (result.items.length === 0) {
      return truncatedTokens
        ? `no prompts matching "${query}" (${truncatedTokens}).`
        : `no prompts matching "${query}".`;
    }
    const draftCounts = storage.countImprovementDraftsByPromptIds(
      result.items.map((row) => row.id),
    );
    return formatHumanResult(result, draftCounts, {
      header: `${result.items.length} match${result.items.length === 1 ? "" : "es"} for "${query}"`,
      moreHint: "more available — narrow the query or pass --limit higher",
      extraHint: truncatedTokens,
    });
  });
}

function formatHumanResult(
  result: ReturnType<
    ReturnType<typeof createSqlitePromptStorage>["listPrompts"]
  >,
  draftCounts: Map<string, number>,
  labels: { header: string; moreHint: string; extraHint?: string },
): string {
  const hints = [
    result.nextCursor ? labels.moreHint : undefined,
    labels.extraHint,
  ].filter((value): value is string => Boolean(value));
  const heading =
    hints.length > 0
      ? `${labels.header} (${hints.join("; ")}):`
      : `${labels.header}:`;
  return `${heading}\n${formatPromptRows(result.items, draftCounts)}`;
}

export function showPromptForCli(
  id: string,
  options: ShowPromptCliOptions = {},
): string {
  return withStorage(options.dataDir, (storage) => {
    const prompt = storage.getPrompt(id);

    if (!prompt) {
      throw new Error(`Prompt not found: ${id}`);
    }

    if (options.json) {
      return JSON.stringify(prompt, null, 2);
    }
    if (options.explain) {
      return formatPromptExplanation(prompt);
    }
    return prompt.markdown;
  });
}

function formatPromptExplanation(
  prompt: ReturnType<ReturnType<typeof createSqlitePromptStorage>["getPrompt"]>,
): string {
  if (!prompt) {
    return "";
  }
  const analysis = prompt.analysis;
  if (!analysis) {
    return `${prompt.markdown}\n\n(no analysis available — run pnpm prompt-memory rebuild-index to refresh.)`;
  }
  const score = analysis.quality_score;
  const lines = [`Score: ${score.value}/${score.max} (${score.band})`];
  if (analysis.redaction_notice) {
    lines.push(`Notice: ${analysis.redaction_notice}`);
  }
  lines.push("", "Breakdown:");
  for (const item of analysis.checklist) {
    const points = score.breakdown.find((entry) => entry.key === item.key);
    const pointsLabel = points ? ` ${points.earned}/${points.weight}` : "";
    lines.push(`- ${item.label} [${item.status}]${pointsLabel}`);
    lines.push(`    ${item.reason}`);
    if (item.suggestion) {
      lines.push(`    Try: ${item.suggestion}`);
    }
  }
  if (prompt.improvement_drafts.length > 0) {
    lines.push("");
    lines.push("Saved drafts:");
    for (const draft of prompt.improvement_drafts.slice(0, 5)) {
      const sectionsLabel =
        draft.changed_sections.length > 0
          ? draft.changed_sections.join(", ")
          : "structure-only";
      lines.push(
        `- ${draft.created_at} [${cliDraftAnalyzerLabel(draft.analyzer)}] ${sectionsLabel}`,
      );
    }
  }
  return lines.join("\n");
}

function cliDraftAnalyzerLabel(analyzer: string): string {
  if (analyzer === "clarifications-v1") return "From your answers";
  if (analyzer === "local-rules-v1") return "Auto rewrite";
  return analyzer;
}

export function deletePromptForCli(
  id: string,
  options: PromptIdOptions = {},
): string {
  return withStorage(options.dataDir, (storage) => {
    const result = storage.deletePrompt(id);

    if (!result.deleted) {
      throw new Error(`Prompt not found: ${id}`);
    }

    return options.json ? JSON.stringify(result, null, 2) : `deleted ${id}`;
  });
}

export function openPromptForCli(
  id: string,
  options: PromptIdOptions = {},
): string {
  return withStorage(options.dataDir, (storage) => {
    if (!storage.getPrompt(id)) {
      throw new Error(`Prompt not found: ${id}`);
    }
    const config = loadPromptMemoryConfig(options.dataDir);
    return `http://${config.server.host}:${config.server.port}/prompts/${encodeURIComponent(id)}`;
  });
}

export function rebuildIndexForCli(options: PromptIdOptions = {}): string {
  const config = loadPromptMemoryConfig(options.dataDir);
  return withStorage(options.dataDir, (storage) => {
    const result = storage.rebuildIndex({
      redactionMode: config.redaction_mode,
    });

    return options.json
      ? JSON.stringify(result, null, 2)
      : `rebuilt ${result.rebuilt.length}, hash_mismatches ${result.hashMismatches.length}`;
  });
}

function withStorage<T>(
  dataDir: string | undefined,
  callback: (storage: ReturnType<typeof createSqlitePromptStorage>) => T,
): T {
  const config = loadPromptMemoryConfig(dataDir);
  const hookAuth = loadHookAuth(dataDir);
  const storage = createSqlitePromptStorage({
    dataDir: config.data_dir,
    hmacSecret: hookAuth.web_session_secret,
  });

  try {
    return callback(storage);
  } finally {
    storage.close();
  }
}

function formatPromptRows(
  rows: ReturnType<
    ReturnType<typeof createSqlitePromptStorage>["listPrompts"]
  >["items"],
  draftCounts: Map<string, number>,
): string {
  if (rows.length === 0) {
    return "";
  }

  return rows
    .map((row) => {
      const drafts = draftCounts.get(row.id) ?? 0;
      const draftsLabel = drafts > 0 ? `\tdrafts:${drafts}` : "";
      return `${row.received_at}\t${row.id}\t${row.tool}\t${row.cwd}\t${row.prompt_length}${draftsLabel}`;
    })
    .join("\n");
}

function parseLimit(limit: string | number | undefined): number | undefined {
  if (limit === undefined) {
    return undefined;
  }

  const parsed = typeof limit === "number" ? limit : Number.parseInt(limit, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
