export type RedactionFinding = {
  detector_type: string;
  range_start: number;
  range_end: number;
  replacement: string;
};

type Detector = {
  type: string;
  pattern: RegExp;
};

const DETECTORS: Detector[] = [
  {
    type: "private_key",
    pattern:
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  { type: "bearer_token", pattern: /\bbearer\s+[a-z0-9._~+/=-]+/gi },
  {
    type: "jwt",
    pattern: /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
  },
  {
    type: "api_key",
    pattern: /\b(?:sk|pk|ghp|github_pat|xoxb|AKIA)[a-zA-Z0-9_-]{8,}\b/g,
  },
  {
    type: "secret_assignment",
    pattern:
      /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*["']?[^\s"',;]+["']?/gi,
  },
  {
    type: "database_url",
    pattern: /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s]+/gi,
  },
  { type: "webhook_url", pattern: /https:\/\/hooks\.[^\s]+/gi },
  { type: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  { type: "phone", pattern: /\+?\d[\d\s().-]{7,}\d/g },
];

export function detectSensitiveValues(text: string): RedactionFinding[] {
  const findings: RedactionFinding[] = [];

  for (const detector of DETECTORS) {
    for (const match of text.matchAll(detector.pattern)) {
      if (match.index === undefined || !match[0]) {
        continue;
      }

      findings.push({
        detector_type: detector.type,
        range_start: match.index,
        range_end: match.index + match[0].length,
        replacement: `[REDACTED:${detector.type}]`,
      });
    }
  }

  return dedupeOverlaps(findings);
}

function dedupeOverlaps(findings: RedactionFinding[]): RedactionFinding[] {
  return findings
    .sort((a, b) => a.range_start - b.range_start || b.range_end - a.range_end)
    .reduce<RedactionFinding[]>((accepted, finding) => {
      const overlaps = accepted.some(
        (existing) =>
          finding.range_start < existing.range_end &&
          finding.range_end > existing.range_start,
      );

      if (!overlaps) {
        accepted.push(finding);
      }

      return accepted;
    }, []);
}
