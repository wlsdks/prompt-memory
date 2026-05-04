import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { VERSION } from "./version.js";

describe("shared/version VERSION", () => {
  it("matches package.json version so the published CLI reports the same number", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      version: string;
    };

    expect(VERSION).toBe(pkg.version);
  });
});
