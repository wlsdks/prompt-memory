import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SOURCE_DIRS = ["scripts", "src"];
const SOURCE_EXTENSIONS = new Set([".css", ".js", ".mjs", ".ts", ".tsx"]);
const LINE_BUDGETS = new Map([
  ["src/web/src/App.tsx", 3000],
  ["src/web/src/habit-coach-panel.tsx", 300],
  ["src/web/src/habit-coach-panel.css", 450],
  ["src/web/src/practice-view.tsx", 520],
  ["src/web/src/practice-view.css", 420],
  ["src/web/src/styles.css", 2750],
  ["src/storage/sqlite-json.ts", 160],
  ["src/storage/sqlite-rows.ts", 180],
  ["src/storage/sqlite.ts", 3350],
  ["src/hooks/rewrite-guard.ts", 180],
  ["src/mcp/score-tool-definitions.ts", 850],
  ["src/mcp/score-tool-types.ts", 220],
  ["src/mcp/score-tool.ts", 750],
]);

const FORBIDDEN_PATTERNS = [
  {
    allowed(path) {
      return (
        path === "scripts/quality-gate.mjs" ||
        path.startsWith("scripts/") ||
        path.startsWith("src/cli/commands/") ||
        path.endsWith(".test.ts")
      );
    },
    pattern: /\bconsole\.log\s*\(/,
    reason: "console.log is allowed only in CLI commands, scripts, and tests",
  },
  {
    allowed(path) {
      return path === "scripts/quality-gate.mjs";
    },
    pattern: /\bdebugger\b/,
    reason: "debugger statements must not be committed",
  },
  {
    allowed(path) {
      return path === "scripts/quality-gate.mjs";
    },
    pattern: /eslint-disable/,
    reason: "eslint-disable needs an explicit architecture discussion first",
  },
  {
    allowed(path) {
      return path === "scripts/quality-gate.mjs" || path.endsWith(".test.ts");
    },
    pattern: /\bas\s+any\b|:\s*any\b|Promise<any>/,
    reason: "avoid untyped any outside tests",
  },
];

const failures = [];

for (const path of walkSourceFiles()) {
  const text = readFileSync(join(ROOT, path), "utf8");
  checkLineBudget(path, text);
  checkForbiddenPatterns(path, text);
}

if (failures.length > 0) {
  console.error("quality gate failed");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("quality gate passed");

function walkSourceFiles() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    collect(join(ROOT, dir), files);
  }
  return files.sort();
}

function collect(path, files) {
  for (const name of readdirSync(path)) {
    const next = join(path, name);
    const stats = statSync(next);
    if (stats.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "coverage") {
        continue;
      }
      collect(next, files);
      continue;
    }

    const extension = next.slice(next.lastIndexOf("."));
    if (SOURCE_EXTENSIONS.has(extension)) {
      files.push(relative(ROOT, next));
    }
  }
}

function checkLineBudget(path, text) {
  const budget = LINE_BUDGETS.get(path);
  if (!budget) return;

  const lineCount = text.split("\n").length;
  if (lineCount > budget) {
    failures.push(`${path} has ${lineCount} lines; budget is ${budget}`);
  }
}

function checkForbiddenPatterns(path, text) {
  for (const { allowed, pattern, reason } of FORBIDDEN_PATTERNS) {
    if (allowed(path)) continue;

    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        failures.push(`${path}:${index + 1} ${reason}`);
      }
    });
  }
}
