import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), path), "utf8")) as T;
}

describe("plugin packaging files", () => {
  it("ships a Codex plugin manifest that points at bundled hooks and skills", () => {
    const manifest = readJson<{
      name: string;
      hooks: string;
      skills: string;
      interface: { displayName: string; category: string };
    }>("plugins/prompt-memory/.codex-plugin/plugin.json");

    expect(manifest.name).toBe("prompt-memory");
    expect(manifest.hooks).toBe("./hooks.json");
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.interface.displayName).toBe("Prompt Memory");
    expect(manifest.interface.category).toBe("Coding");
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
    const packageJson = readJson<{ files: string[] }>("package.json");

    expect(packageJson.files).toContain("plugins");
    expect(packageJson.files).toContain("integrations");
    expect(packageJson.files).toContain("docs/PLUGINS.md");
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
