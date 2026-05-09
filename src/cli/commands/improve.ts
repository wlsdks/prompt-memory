import { readFileSync } from "node:fs";
import type { Command } from "commander";

import {
  applyClarifications,
  improvePrompt,
  type ClarifyingAnswer,
  type PromptImprovement,
} from "../../analysis/improve.js";
import {
  improvePromptTool,
  type ImprovePromptToolResult,
} from "../../mcp/score-tool.js";
import { UserError } from "../user-error.js";
import type { PromptQualityCriterion } from "../../shared/schema.js";

type ImproveCliOptions = {
  dataDir?: string;
  json?: boolean;
  latest?: boolean;
  promptId?: string;
  stdin?: boolean;
  text?: string;
  answer?: string[];
  language?: string;
};

const VALID_AXES = new Set<PromptQualityCriterion>([
  "goal_clarity",
  "background_context",
  "scope_limits",
  "output_format",
  "verification_criteria",
]);

const AXIS_ALIASES: Record<string, PromptQualityCriterion> = {
  goal: "goal_clarity",
  goal_clarity: "goal_clarity",
  context: "background_context",
  background: "background_context",
  background_context: "background_context",
  scope: "scope_limits",
  scope_limits: "scope_limits",
  output: "output_format",
  output_format: "output_format",
  verification: "verification_criteria",
  verification_criteria: "verification_criteria",
};

export function registerImproveCommand(program: Command): void {
  program
    .command("improve")
    .description("Generate an approval-ready improved prompt locally.")
    .option("--data-dir <path>", "Override the prompt-coach data directory.")
    .option("--text <prompt>", "Prompt text to improve.")
    .option("--stdin", "Read prompt text from stdin.")
    .option("--latest", "Improve the latest stored prompt without printing it.")
    .option(
      "--prompt-id <id>",
      "Improve one stored prompt without printing the original prompt body.",
    )
    .option(
      "--answer <axis=text>",
      "Verbatim answer to a clarifying question (repeatable, axis ∈ goal | context | scope | output | verification).",
      (value: string, accumulated: string[] = []) => [...accumulated, value],
      [] as string[],
    )
    .option(
      "--language <lang>",
      "Improvement draft language: en or ko. Auto-detected when omitted.",
    )
    .option("--json", "Print JSON.")
    .action((options: ImproveCliOptions) => {
      console.log(improvePromptForCli(options));
    });
}

export function improvePromptForCli(options: ImproveCliOptions): string {
  if (options.latest || options.promptId) {
    const result = improvePromptTool(
      options.latest
        ? { latest: true }
        : { prompt_id: options.promptId as string },
      { dataDir: options.dataDir },
    );

    return options.json
      ? JSON.stringify(result, null, 2)
      : formatStoredImprovement(result);
  }

  const prompt = readPromptInput(options);
  const language = parseLanguage(options.language);
  const answers = parseAnswers(options.answer);
  const result =
    answers.length > 0
      ? applyClarifications({
          prompt,
          createdAt: new Date().toISOString(),
          language,
          answers,
        })
      : improvePrompt({
          prompt,
          createdAt: new Date().toISOString(),
          language,
        });

  return options.json
    ? JSON.stringify(result, null, 2)
    : formatImprovement(result);
}

function parseLanguage(value: string | undefined): "en" | "ko" | undefined {
  if (value === undefined) return undefined;
  if (value === "en" || value === "ko") return value;
  // Stay consistent with the rest of the CLI: --language is documented to
  // silently fall back to auto-detection rather than rejecting unknown
  // values (lock-tested project policy).
  return undefined;
}

function parseAnswers(values: string[] | undefined): ClarifyingAnswer[] {
  if (!values || values.length === 0) return [];

  const answers: ClarifyingAnswer[] = [];
  for (const raw of values) {
    const equalsIndex = raw.indexOf("=");
    if (equalsIndex <= 0) {
      throw new UserError(
        `--answer expects "axis=text" but got "${raw}". Try: --answer goal="fix the delete API 500"`,
      );
    }
    const rawAxis = raw.slice(0, equalsIndex).trim();
    const text = raw.slice(equalsIndex + 1);
    const axis = AXIS_ALIASES[rawAxis];
    if (!axis || !VALID_AXES.has(axis)) {
      throw new UserError(
        `--answer axis "${rawAxis}" is not recognized. Valid axes: goal, context, scope, output, verification.`,
      );
    }
    if (!text.trim()) {
      throw new UserError(
        `--answer for "${rawAxis}" is empty. Pass a non-empty answer text after =.`,
      );
    }
    answers.push({
      question_id: `q_${axis}`,
      axis,
      answer: text,
      origin: "user",
    });
  }
  return answers;
}

function formatStoredImprovement(result: ImprovePromptToolResult): string {
  if ("is_error" in result) {
    return [
      "Prompt improvement",
      `error ${result.error_code}: ${result.message}`,
      "",
      "Privacy: local-only, no external calls, no stored prompt body.",
    ].join("\n");
  }

  return [
    result.summary,
    "",
    result.improved_prompt,
    "",
    "Next action",
    result.next_action,
    "",
    "Safety",
    ...result.safety_notes.map((note) => `- ${note}`),
    "",
    "Privacy: local-only, no external calls, no stored prompt body.",
  ].join("\n");
}

function readPromptInput(options: ImproveCliOptions): string {
  if (options.text !== undefined) {
    return options.text;
  }

  if (options.stdin) {
    return readFileSync(0, "utf8");
  }

  throw new UserError(
    '--text or --stdin is required for prompt improvement. Try: prompt-coach improve --text "add caching to fetchUser"',
  );
}

function formatImprovement(result: PromptImprovement): string {
  const language = inferLanguageFromQuestions(result);
  const lines: string[] = [result.summary, "", result.improved_prompt];

  if (result.clarifying_questions.length > 0) {
    lines.push(
      "",
      language === "ko" ? "확인 질문" : "Clarifying questions",
      ...result.clarifying_questions.map(
        (question, index) =>
          `${index + 1}. [${SECTION_HEADERS[language][question.axis]}] ${question.ask}`,
      ),
    );
  }

  lines.push("", language === "ko" ? "안전 메모" : "Safety");
  for (const note of result.safety_notes) {
    lines.push(`- ${note}`);
  }

  return lines.join("\n");
}

const SECTION_HEADERS: Record<
  "en" | "ko",
  Record<PromptImprovement["clarifying_questions"][number]["axis"], string>
> = {
  en: {
    goal_clarity: "Goal",
    background_context: "Context",
    scope_limits: "Scope",
    output_format: "Output",
    verification_criteria: "Verification",
  },
  ko: {
    goal_clarity: "목표",
    background_context: "맥락",
    scope_limits: "범위",
    output_format: "출력",
    verification_criteria: "검증",
  },
};

function inferLanguageFromQuestions(result: PromptImprovement): "en" | "ko" {
  for (const question of result.clarifying_questions) {
    if (/[가-힣]/.test(question.ask)) return "ko";
  }
  return /[가-힣]/.test(result.improved_prompt) ? "ko" : "en";
}
