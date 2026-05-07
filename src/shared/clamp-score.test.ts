import { describe, expect, it } from "vitest";

import { clampScore } from "./clamp-score.js";

describe("clampScore", () => {
  it("rounds in-range values", () => {
    expect(clampScore(49.7)).toBe(50);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(100)).toBe(100);
  });

  it("clamps below zero to zero", () => {
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(-99.9)).toBe(0);
  });

  it("clamps above one hundred to one hundred", () => {
    expect(clampScore(101)).toBe(100);
    expect(clampScore(999)).toBe(100);
  });
});
