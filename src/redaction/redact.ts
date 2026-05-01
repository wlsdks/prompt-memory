import type { RedactionPolicy, RedactionResult } from "../shared/schema.js";
import { detectSensitiveValues } from "./detectors.js";

export function redactPrompt(
  prompt: string,
  policy: RedactionPolicy,
): RedactionResult {
  const findings = detectSensitiveValues(prompt);
  const isSensitive = findings.length > 0;

  if (policy === "raw" || (policy === "reject" && !isSensitive)) {
    return {
      policy,
      stored_text: prompt,
      is_sensitive: isSensitive,
      findings,
    };
  }

  if (policy === "reject") {
    return {
      policy,
      stored_text: "",
      is_sensitive: true,
      findings,
    };
  }

  return {
    policy,
    stored_text: applyMask(prompt, findings),
    is_sensitive: isSensitive,
    findings,
  };
}

function applyMask(
  prompt: string,
  findings: RedactionResult["findings"],
): string {
  let result = prompt;

  for (const finding of [...findings].sort(
    (a, b) => b.range_start - a.range_start,
  )) {
    result =
      result.slice(0, finding.range_start) +
      (finding.replacement ?? `[REDACTED:${finding.detector_type}]`) +
      result.slice(finding.range_end);
  }

  return result;
}
