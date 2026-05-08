import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parsePromptMarkdown } from "./markdown.js";

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "prompt-memory-md-parse-"));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe("parsePromptMarkdown", () => {
  it("returns frontmatter and body for a well-formed file", () => {
    const path = join(sandbox, "good.md");
    writeFileSync(
      path,
      "---\nid: prmt_123\ntool: claude-code\n---\n\nhello world\n",
    );

    const parsed = parsePromptMarkdown(path);

    expect(parsed.frontmatter).toMatchObject({
      id: "prmt_123",
      tool: "claude-code",
    });
    expect(parsed.body.trim()).toBe("hello world");
  });

  it("falls back to empty frontmatter when YAML is corrupt instead of throwing", () => {
    const path = join(sandbox, "broken.md");
    writeFileSync(
      path,
      "---\nbroken: : :\nyaml: [\n---\nbody after broken header\n",
    );

    expect(() => parsePromptMarkdown(path)).not.toThrow();
    const parsed = parsePromptMarkdown(path);
    expect(parsed.frontmatter).toEqual({});
    expect(parsed.body).toContain("body after broken header");
  });
});
