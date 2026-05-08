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
    expect(output.indexOf("prompt-memory coach")).toBeLessThan(
      output.indexOf("Troubleshooting"),
    );
    expect(output.indexOf("prompt-memory doctor claude-code")).toBeGreaterThan(
      output.indexOf("Troubleshooting"),
    );
    expect(output.indexOf("claude mcp add")).toBeGreaterThan(
      output.indexOf("Troubleshooting"),
    );
    expect(output).toContain("prompt-memory server");
    expect(output).not.toContain("prompt-memory open");
  });

  it("can focus on one tool without hiding the coach flow", () => {
    const guide = buildStartGuide({ tool: "codex" });
    const output = formatStartGuide(guide);

    expect(guide.tools).toEqual(["codex"]);
    expect(output).toContain("codex mcp add prompt-memory");
    expect(output).toContain("prompt-memory doctor codex");
    expect(output).toContain("prompt-memory coach");
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
      "prompt-memory setup --profile coach --register-mcp --open-web",
    ]);
    expect(output).toContain("opens the web workspace automatically");
    expect(output.indexOf("--open-web")).toBeLessThan(
      output.indexOf("Troubleshooting"),
    );
  });
});
