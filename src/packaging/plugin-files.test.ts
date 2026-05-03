import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as T;
}

describe("plugin packaging files", () => {
  it("ships a Claude Code plugin marketplace and manifest with slash commands", () => {
    const marketplace = readJson<{
      plugins: Array<{ name: string; source: string; category: string }>;
    }>(".claude-plugin/marketplace.json");
    const manifest = readJson<{
      name: string;
      commands: string[];
    }>(".claude-plugin/plugin.json");

    expect(marketplace.plugins).toContainEqual(
      expect.objectContaining({
        name: "prompt-memory",
        source: "./",
        category: "memory",
      }),
    );
    expect(manifest.name).toBe("prompt-memory");
    expect(manifest.commands).toEqual([
      "./commands/setup.md",
      "./commands/status.md",
      "./commands/buddy.md",
      "./commands/coach.md",
      "./commands/score.md",
      "./commands/judge.md",
      "./commands/score-last.md",
      "./commands/improve-last.md",
      "./commands/agent-improve-last.md",
      "./commands/habits.md",
      "./commands/rules.md",
      "./commands/coach-next.md",
      "./commands/open.md",
    ]);
  });

  it("ships Claude Code command docs for setup, status, score, coach, and open", () => {
    const setup = readFileSync(
      join(process.cwd(), "commands/setup.md"),
      "utf8",
    );
    const status = readFileSync(
      join(process.cwd(), "commands/status.md"),
      "utf8",
    );
    const score = readFileSync(
      join(process.cwd(), "commands/score.md"),
      "utf8",
    );
    const coach = readFileSync(
      join(process.cwd(), "commands/coach.md"),
      "utf8",
    );
    const buddy = readFileSync(
      join(process.cwd(), "commands/buddy.md"),
      "utf8",
    );
    const scoreLast = readFileSync(
      join(process.cwd(), "commands/score-last.md"),
      "utf8",
    );
    const judge = readFileSync(
      join(process.cwd(), "commands/judge.md"),
      "utf8",
    );
    const improveLast = readFileSync(
      join(process.cwd(), "commands/improve-last.md"),
      "utf8",
    );
    const agentImproveLast = readFileSync(
      join(process.cwd(), "commands/agent-improve-last.md"),
      "utf8",
    );
    const habits = readFileSync(
      join(process.cwd(), "commands/habits.md"),
      "utf8",
    );
    const rules = readFileSync(
      join(process.cwd(), "commands/rules.md"),
      "utf8",
    );
    const coachNext = readFileSync(
      join(process.cwd(), "commands/coach-next.md"),
      "utf8",
    );
    const open = readFileSync(join(process.cwd(), "commands/open.md"), "utf8");

    expect(setup).toContain(
      "prompt-memory setup --profile coach --register-mcp --dry-run",
    );
    expect(setup).toContain(
      "prompt-memory setup --profile coach --register-mcp",
    );
    expect(setup).toContain("prompt-memory statusline claude-code");
    expect(status).toContain("prompt-memory doctor claude-code");
    expect(status).toContain("prompt-memory statusline claude-code");
    expect(buddy).toContain("prompt-memory buddy");
    expect(buddy).toContain("prompt-memory buddy --json");
    expect(coach).toContain("prompt-memory:coach_prompt");
    expect(coach).toContain("prompt-memory coach --json");
    expect(score).toContain("prompt-memory score --json");
    expect(score).toContain("prompt-memory:score_prompt_archive");
    expect(judge).toContain("prompt-memory:prepare_agent_judge_batch");
    expect(judge).toContain("prompt-memory:record_agent_judgments");
    expect(judge).toContain(
      "Do not call external providers through prompt-memory",
    );
    expect(scoreLast).toContain("prompt-memory:score_prompt latest=true");
    expect(scoreLast).toContain("prompt-memory score --latest --json");
    expect(improveLast).toContain("prompt-memory:improve_prompt latest=true");
    expect(improveLast).toContain("prompt-memory improve --latest --json");
    expect(agentImproveLast).toContain(
      "prompt-memory:prepare_agent_rewrite latest=true",
    );
    expect(agentImproveLast).toContain("prompt-memory:record_agent_rewrite");
    expect(agentImproveLast).toContain("Do not auto-submit the rewrite");
    expect(habits).toContain("prompt-memory:score_prompt_archive");
    expect(rules).toContain("prompt-memory:review_project_instructions");
    expect(coachNext).toContain("next_prompt_template");
    expect(coachNext).toContain("prompt-memory score --json");
    expect(open).toContain("http://127.0.0.1:17373");
  });

  it("ships a Codex plugin manifest that points at bundled hooks and skills", () => {
    const manifest = readJson<{
      name: string;
      hooks: string;
      skills: string;
      interface: {
        displayName: string;
        category: string;
        defaultPrompt: string[];
      };
    }>("plugins/prompt-memory/.codex-plugin/plugin.json");

    expect(manifest.name).toBe("prompt-memory");
    expect(manifest.hooks).toBe("./hooks.json");
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.interface.displayName).toBe("Prompt Memory");
    expect(manifest.interface.category).toBe("Coding");
    expect(manifest.interface.defaultPrompt).toEqual(
      expect.arrayContaining([
        "Show my prompt-memory buddy side pane command",
        "Score my latest captured prompt",
        "Improve my latest captured prompt",
        "Rewrite my latest captured prompt with the active agent session",
        "Run my full prompt coach workflow",
        "Judge my low-scoring prompts with the active agent session",
        "Summarize my prompt habits",
      ]),
    );
  });

  it("ships a fail-open Codex prompt hook without embedding secrets", () => {
    const hooks = readJson<{
      hooks: {
        UserPromptSubmit: Array<{
          hooks: Array<{ type: string; command: string; timeout: number }>;
        }>;
      };
    }>("plugins/prompt-memory/hooks.json");

    const command = hooks.hooks.UserPromptSubmit[0]?.hooks[0]?.command ?? "";
    expect(command).toContain("prompt-memory hook codex");
    expect(command).toContain("|| true");
    expect(command).not.toMatch(/PROMPT_MEMORY_TOKEN|Bearer|token=/i);
  });

  it("documents Claude Code as a hook integration without embedding secrets", () => {
    const example = readJson<{
      hooks: {
        UserPromptSubmit: Array<{
          hooks: Array<{ command: string }>;
        }>;
      };
    }>("integrations/claude-code/settings.example.json");

    const command = example.hooks.UserPromptSubmit[0]?.hooks[0]?.command ?? "";
    expect(command).toContain("prompt-memory hook claude-code");
    expect(command).toContain("|| true");
    expect(command).not.toMatch(/PROMPT_MEMORY_TOKEN|Bearer|token=/i);
  });

  it("includes plugin artifacts in npm package files", () => {
    const packageJson = readJson<{
      bin: Record<string, string>;
      files: string[];
    }>("package.json");

    expect(packageJson.bin).toMatchObject({
      "prompt-memory": "./dist/cli/index.js",
      "pm-claude": "./dist/cli/pm-claude.js",
      "pm-codex": "./dist/cli/pm-codex.js",
    });
    expect(packageJson.files).toContain(".claude-plugin");
    expect(packageJson.files).toContain("commands");
    expect(packageJson.files).toContain("plugins");
    expect(packageJson.files).toContain("integrations");
    expect(packageJson.files).toContain("docs/ARCHITECTURE.md");
    expect(packageJson.files).toContain("docs/PLUGINS.md");
    expect(packageJson.files).toContain("docs/LEGAL_USAGE_GUIDE.md");
  });

  it("restores executable mode for the npm CLI bin after server builds", () => {
    const packageJson = readJson<{ scripts: Record<string, string> }>(
      "package.json",
    );

    expect(packageJson.scripts["build:server"]).toContain(
      "node scripts/fix-bin-mode.mjs",
    );
    expect(
      readFileSync(join(process.cwd(), "scripts/fix-bin-mode.mjs"), "utf8"),
    ).toContain("chmodSync");
    expect(
      readFileSync(join(process.cwd(), "scripts/fix-bin-mode.mjs"), "utf8"),
    ).toContain("pm-claude.js");
    expect(
      readFileSync(join(process.cwd(), "scripts/fix-bin-mode.mjs"), "utf8"),
    ).toContain("pm-codex.js");
  });

  it("registers the repo-local plugin in the local marketplace file", () => {
    const marketplace = readJson<{
      plugins: Array<{
        name: string;
        source: { source: string; path: string };
        policy: { installation: string; authentication: string };
        category: string;
      }>;
    }>(".agents/plugins/marketplace.json");

    expect(marketplace.plugins).toContainEqual({
      name: "prompt-memory",
      source: { source: "local", path: "./plugins/prompt-memory" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Coding",
    });
  });
});
