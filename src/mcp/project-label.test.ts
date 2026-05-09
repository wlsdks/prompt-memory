import { describe, expect, it } from "vitest";

import { projectLabel } from "./project-label.js";

describe("projectLabel (mcp)", () => {
  it("returns the last segment of a posix path", () => {
    expect(projectLabel("/Users/example/projects/prompt-coach")).toBe(
      "prompt-coach",
    );
  });

  it("ignores trailing separators", () => {
    expect(projectLabel("/Users/example/foo/")).toBe("foo");
  });

  it("understands backslash-separated paths", () => {
    expect(projectLabel("C:\\Users\\example\\foo")).toBe("foo");
  });

  it("falls back to 'project' when there is no segment", () => {
    expect(projectLabel("")).toBe("project");
    expect(projectLabel("/")).toBe("project");
  });
});
