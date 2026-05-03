import { afterEach, describe, expect, it, vi } from "vitest";

import {
  filtersFromLocation,
  routeFromLocation,
  writeFiltersToLocation,
} from "./routing.js";

function stubLocation(pathname: string, search = "") {
  const replaceState = vi.fn();
  vi.stubGlobal("window", {
    history: { replaceState },
    location: { pathname, search },
  });
  return { replaceState };
}

describe("routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses stable top-level routes", () => {
    stubLocation("/mcp");
    expect(routeFromLocation()).toEqual({ name: "mcp" });

    stubLocation("/prompts/prompt%201");
    expect(routeFromLocation()).toEqual({ id: "prompt 1", name: "detail" });
  });

  it("parses list filters from the URL", () => {
    stubLocation(
      "/",
      "?q=refactor&tool=codex&focus=quality-gap&gap=scope_limits&sensitive=false",
    );

    expect(filtersFromLocation()).toMatchObject({
      focus: "quality-gap",
      isSensitive: "false",
      qualityGap: "scope_limits",
      query: "refactor",
      tool: "codex",
    });
  });

  it("writes compact list filter URLs", () => {
    const { replaceState } = stubLocation("/", "");

    writeFiltersToLocation({
      isSensitive: "all",
      qualityGap: "verification_criteria",
      query: " tests ",
      tool: "claude-code",
    });

    expect(replaceState).toHaveBeenCalledWith(
      {},
      "",
      "/?q=tests&tool=claude-code&gap=verification_criteria",
    );
  });
});
