import { describe, expect, it } from "vitest";

import {
  isExportPreviewCounts,
  parseJson,
  parseJsonValue,
  readChecklist,
  readNumberRecord,
  readPromptTags,
  readQualityCriteria,
  readStringArray,
} from "./sqlite-json.js";

describe("sqlite JSON decoders", () => {
  it("falls back for malformed JSON without throwing", () => {
    expect(parseJsonValue("{")).toEqual({});
    expect(parseJson("{", ["fallback"])).toEqual(["fallback"]);
    expect(readStringArray("{")).toEqual([]);
    expect(readChecklist("{")).toEqual([]);
    expect(readNumberRecord("{")).toEqual({});
  });

  it("keeps only expected string, tag, and quality criterion values", () => {
    expect(readStringArray(JSON.stringify(["one", 2, "two"]))).toEqual([
      "one",
      "two",
    ]);
    expect(
      readPromptTags(JSON.stringify(["docs", "unknown", "security"])),
    ).toEqual(["docs", "security"]);
    expect(
      readQualityCriteria(
        JSON.stringify(["goal_clarity", "unknown", "verification_criteria"]),
      ),
    ).toEqual(["goal_clarity", "verification_criteria"]);
  });

  it("validates checklist and export count shapes", () => {
    expect(
      readChecklist(
        JSON.stringify([
          {
            key: "goal_clarity",
            label: "Goal clarity",
            status: "missing",
            reason: "No goal",
          },
          {
            key: "bad",
            label: "Bad item",
          },
        ]),
      ),
    ).toHaveLength(1);

    expect(
      isExportPreviewCounts({
        prompt_count: 2,
        sensitive_count: 1,
        included_fields: ["summary"],
        excluded_fields: ["prompt"],
        residual_identifier_counts: {},
        small_set_warning: false,
      }),
    ).toBe(true);
    expect(isExportPreviewCounts({ prompt_count: 2 })).toBe(false);
  });
});
