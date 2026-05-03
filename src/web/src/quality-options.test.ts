import { describe, expect, it } from "vitest";

import {
  exportFieldLabel,
  isQualityGapKey,
  qualityGapKeyFromLabel,
  qualityGapLabel,
} from "./quality-options.js";

describe("quality options", () => {
  it("round-trips quality gap keys and labels", () => {
    expect(isQualityGapKey("goal_clarity")).toBe(true);
    expect(qualityGapLabel("verification_criteria")).toBe(
      "Verification criteria",
    );
    expect(qualityGapKeyFromLabel("Output format")).toBe("output_format");
  });

  it("keeps anonymized export field labels readable", () => {
    expect(exportFieldLabel("stable_prompt_id")).toBe("stable prompt id");
    expect(exportFieldLabel("custom_field")).toBe("custom_field");
  });
});
