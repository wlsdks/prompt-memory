import { describe, expect, it } from "vitest";

import { projectLabel } from "./project-label.js";

describe("projectLabel (storage)", () => {
  it("returns the last segment of a posix path", () => {
    expect(projectLabel("/Users/example/projects/prompt-memory")).toBe(
      "prompt-memory",
    );
  });

  it("strips trailing separators", () => {
    expect(projectLabel("/Users/example/foo/")).toBe("foo");
    expect(projectLabel("/Users/example/foo///")).toBe("foo");
  });

  it("returns the input itself when there is no separator", () => {
    expect(projectLabel("local-project")).toBe("local-project");
  });

  it("falls back to 'unknown' when the input collapses to empty", () => {
    expect(projectLabel("")).toBe("unknown");
    expect(projectLabel("/")).toBe("unknown");
    expect(projectLabel("///")).toBe("unknown");
  });
});
