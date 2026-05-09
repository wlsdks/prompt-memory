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
        name: "prompt-coach",
        source: "./",
        category: "memory",
      }),
    );
    expect(manifest.name).toBe("prompt-coach");
    expect(manifest.commands).toEqual([
      "./commands/setup.md",
      "./commands/status.md",
      "./commands/guard.md",
      "./commands/buddy.md",
      "./commands/coach.md",
      "./commands/score.md",
      "./commands/judge.md",
      "./commands/improve-last.md",
      "./commands/habits.md",
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
    const judge = readFileSync(
      join(process.cwd(), "commands/judge.md"),
      "utf8",
    );
    const improveLast = readFileSync(
      join(process.cwd(), "commands/improve-last.md"),
      "utf8",
    );
    const habits = readFileSync(
      join(process.cwd(), "commands/habits.md"),
      "utf8",
    );
    const open = readFileSync(join(process.cwd(), "commands/open.md"), "utf8");
    const guard = readFileSync(
      join(process.cwd(), "commands/guard.md"),
      "utf8",
    );

    expect(guard).toContain(
      "prompt-coach setup --profile coach --rewrite-guard <chosen>",
    );
    expect(guard).toContain("AskUserQuestion");
    expect(guard).toMatch(/off.*context.*ask.*block-and-copy/s);

    expect(setup).toContain(
      "prompt-coach setup --profile coach --register-mcp --dry-run",
    );
    expect(setup).toContain(
      "prompt-coach setup --profile coach --register-mcp",
    );
    expect(setup).toContain("prompt-coach statusline claude-code");
    expect(status).toContain("prompt-coach doctor claude-code");
    expect(status).toContain("prompt-coach statusline claude-code");
    expect(buddy).toContain("prompt-coach buddy");
    expect(buddy).toContain("prompt-coach buddy --json");
    expect(coach).toContain("prompt-coach:coach_prompt");
    expect(coach).toContain("prompt-coach coach --json");
    expect(score).toContain("prompt-coach score --json");
    expect(score).toContain("prompt-coach:score_prompt_archive");
    expect(judge).toContain("prompt-coach:prepare_agent_judge_batch");
    expect(judge).toContain("prompt-coach:record_agent_judgments");
    expect(judge).toContain(
      "Do not call external providers through prompt-coach",
    );
    expect(score).toContain("prompt-coach:score_prompt latest=true");
    expect(score).toContain("prompt-coach score --latest --json");
    expect(improveLast).toContain("AskUserQuestion");
    expect(improveLast).toContain("prompt-coach:improve_prompt latest=true");
    expect(improveLast).toContain("prompt-coach improve --latest --json");
    expect(improveLast).toContain(
      "prompt-coach:prepare_agent_rewrite latest=true",
    );
    expect(improveLast).toContain("prompt-coach:record_agent_rewrite");
    expect(improveLast).toContain("Do not auto-submit the rewrite");
    expect(habits).toContain("prompt-coach:score_prompt_archive");
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
    }>("plugins/prompt-coach/.codex-plugin/plugin.json");

    expect(manifest.name).toBe("prompt-coach");
    expect(manifest.hooks).toBe("./hooks.json");
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.interface.displayName).toBe("Prompt Memory");
    expect(manifest.interface.category).toBe("Coding");
    expect(manifest.interface.defaultPrompt).toEqual(
      expect.arrayContaining([
        "Show my prompt-coach buddy side pane command",
        "Show my prompt-coach hook rewrite-guard mode",
        "Toggle the prompt-coach rewrite guard between off / context / ask / block-and-copy",
        "Score my latest captured prompt",
        "Improve my latest captured prompt",
        "Run my full prompt coach workflow",
        "Judge my low-scoring prompts with the active agent session",
        "Summarize my prompt habits",
      ]),
    );
    expect(manifest.interface.defaultPrompt).not.toContain(
      "Rewrite my latest captured prompt with the active agent session",
    );
    expect(manifest.interface.defaultPrompt).not.toContain(
      "Review my current project AGENTS.md or CLAUDE.md rules",
    );
  });

  it("ships a fail-open Codex prompt hook without embedding secrets", () => {
    const hooks = readJson<{
      hooks: {
        UserPromptSubmit: Array<{
          hooks: Array<{ type: string; command: string; timeout: number }>;
        }>;
      };
    }>("plugins/prompt-coach/hooks.json");

    const command = hooks.hooks.UserPromptSubmit[0]?.hooks[0]?.command ?? "";
    expect(command).toContain("prompt-coach hook codex");
    expect(command).toContain("|| true");
    expect(command).not.toMatch(/PROMPT_COACH_TOKEN|Bearer|token=/i);
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
    expect(command).toContain("prompt-coach hook claude-code");
    expect(command).toContain("|| true");
    expect(command).not.toMatch(/PROMPT_COACH_TOKEN|Bearer|token=/i);
  });

  it("includes plugin artifacts in npm package files", () => {
    const packageJson = readJson<{
      bin: Record<string, string>;
      files: string[];
    }>("package.json");

    expect(packageJson.bin).toMatchObject({
      "prompt-coach": "./dist/cli/index.js",
      "pc-claude": "./dist/cli/pc-claude.js",
      "pc-codex": "./dist/cli/pc-codex.js",
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
    ).toContain("pc-claude.js");
    expect(
      readFileSync(join(process.cwd(), "scripts/fix-bin-mode.mjs"), "utf8"),
    ).toContain("pc-codex.js");
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
      name: "prompt-coach",
      source: { source: "local", path: "./plugins/prompt-coach" },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Coding",
    });
  });
});
