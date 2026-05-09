import { describe, expect, it } from "vitest";

import { buildStartGuide, formatStartGuide } from "./start.js";

describe("start guide", () => {
  it("puts the first-score happy path before troubleshooting commands", () => {
    const guide = buildStartGuide();
    const output = formatStartGuide(guide);

    expect(guide.goal).toContain("about three minutes");
    expect(guide.tools).toEqual(["claude-code", "codex"]);
    expect(guide.steps.slice(0, 3).map((step) => step.title)).toEqual([
      "Run the coach setup",
      "Send one real coding prompt",
      "See the first score",
    ]);
    expect(output.indexOf("prompt-coach coach")).toBeLessThan(
      output.indexOf("Troubleshooting"),
    );
    expect(output.indexOf("prompt-coach doctor claude-code")).toBeGreaterThan(
      output.indexOf("Troubleshooting"),
    );
    expect(output.indexOf("claude mcp add")).toBeGreaterThan(
      output.indexOf("Troubleshooting"),
    );
    expect(output).toContain("prompt-coach server");
    expect(output).not.toContain("prompt-coach open");

    const sendStep = guide.steps.find(
      (step) => step.title === "Send one real coding prompt",
    );
    expect(sendStep?.detail).toContain("/prompt-coach:improve-last");
    expect(output).toContain("/prompt-coach:improve-last");
  });

  it("can focus on one tool without hiding the coach flow", () => {
    const guide = buildStartGuide({ tool: "codex" });
    const output = formatStartGuide(guide);

    expect(guide.tools).toEqual(["codex"]);
    expect(output).toContain("codex mcp add prompt-coach");
    expect(output).toContain("prompt-coach doctor codex");
    expect(output).toContain("prompt-coach coach");
    expect(output).not.toContain("claude mcp add");
  });

  it("rejects an unsupported --tool value instead of silently falling back", () => {
    expect(() => buildStartGuide({ tool: "madeup" })).toThrow(
      /Unsupported tool: madeup\. Use claude-code or codex\./,
    );
    expect(() => buildStartGuide({ tool: "calude-code" })).toThrow(
      /Unsupported tool: calude-code/,
    );
    expect(buildStartGuide({}).tools).toEqual(["claude-code", "codex"]);
    expect(buildStartGuide({ tool: "claude-code" }).tools).toEqual([
      "claude-code",
    ]);
    expect(buildStartGuide({ tool: "codex" }).tools).toEqual(["codex"]);
  });

  it("can include the opt-in web opener in the first setup command", () => {
    const guide = buildStartGuide({ openWeb: true });
    const output = formatStartGuide(guide);

    expect(guide.steps[0].commands).toEqual([
      "prompt-coach setup --profile coach --register-mcp --open-web",
    ]);
    expect(output).toContain("opens the web workspace automatically");
    expect(output.indexOf("--open-web")).toBeLessThan(
      output.indexOf("Troubleshooting"),
    );
  });

  it("never leaks the local node binary or dist path even when invoked from a built CLI", () => {
    // Simulate running `node /Users/<who>/.../dist/cli/index.js start`. With
    // the previous behavior `defaultPromptCoachEntry` would echo the
    // absolute interpreter and dist path into the guidance, leaking the
    // maintainer's home directory in the copy-paste-friendly command.
    const originalArgv = process.argv;
    process.argv = [
      "/Users/secret-dev/.nvm/versions/node/v20.20.0/bin/node",
      "/Users/secret-dev/side-project/prompt-coach/dist/cli/index.js",
      "start",
    ];
    try {
      const guide = buildStartGuide();
      const output = formatStartGuide(guide);

      expect(output).toContain(
        "claude mcp add --transport stdio prompt-coach -- prompt-coach mcp",
      );
      expect(output).toContain(
        "codex mcp add prompt-coach -- prompt-coach mcp",
      );
      expect(output).not.toContain("/Users/secret-dev/");
      expect(output).not.toMatch(/\bdist\/cli\/index\.js\b/);
    } finally {
      process.argv = originalArgv;
    }
  });
});
