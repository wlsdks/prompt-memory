import { describe, expect, it } from "vitest";

import { buildStartGuide, formatStartGuide } from "./start.js";

describe("start guide", () => {
  it("shows the shortest first-success path for both supported agents", () => {
    const guide = buildStartGuide();

    expect(guide.goal).toContain("Capture one real coding prompt");
    expect(guide.tools).toEqual(["claude-code", "codex"]);
    expect(guide.steps.flatMap((step) => step.commands)).toEqual(
      expect.arrayContaining([
        "prompt-memory setup --profile coach",
        "claude mcp add --transport stdio prompt-memory -- prompt-memory mcp",
        "codex mcp add prompt-memory -- prompt-memory mcp",
        "prompt-memory doctor claude-code",
        "prompt-memory doctor codex",
        "prompt-memory coach",
      ]),
    );
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
});
