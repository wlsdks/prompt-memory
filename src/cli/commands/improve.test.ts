import { describe, expect, it } from "vitest";

import { createProgram } from "../index.js";
import { improvePromptForCli } from "./improve.js";

describe("improve CLI", () => {
  it("describes the improve command in top-level help", () => {
    const help = createProgram().helpInformation();

    expect(help).toMatch(
      /improve \[options\]\s+Generate an approval-ready improved prompt locally\./,
    );
  });

  it("prints JSON improvement results from text input", () => {
    const output = improvePromptForCli({
      json: true,
      text: "이거 좀 고쳐줘",
    });
    const parsed = JSON.parse(output) as {
      improved_prompt: string;
      requires_user_approval: boolean;
    };

    expect(parsed.requires_user_approval).toBe(true);
    expect(parsed.improved_prompt).toContain("검증");
    expect(parsed.improved_prompt).toContain("출력");
  });

  it("requires explicit text or stdin", () => {
    expect(() => improvePromptForCli({ json: true })).toThrow(
      "--text or --stdin is required",
    );
  });
});
