# Benchmark v1 Spec

Date: 2026-05-02

## Purpose

Benchmark v1 is the local regression benchmark for `prompt-memory`. It checks whether the product is still delivering its core value to Claude Code and Codex users:

- finding previously useful prompts again
- surfacing weak prompting habits
- helping the user write a better next prompt
- preserving the local-first privacy boundary

This benchmark is intentionally local-only. It does not call an external LLM judge, embedding API, analytics service, or telemetry endpoint.

## Command

```sh
pnpm benchmark
pnpm benchmark -- --json
```

The command builds the production app first, creates an isolated temporary data directory, starts the local server on a temporary loopback port, ingests synthetic fixture prompts, and measures API/UI-adjacent behavior through the built app.

## Principles

- Use synthetic fixture prompts only.
- Do not include raw secrets, raw absolute paths, or sensitive prompt text in the report.
- Treat v1 as a regression baseline, not a proof of real-user product-market fit.
- Compare trend and regression across versions rather than treating the absolute score as final quality.

## Metrics

### 1. Privacy Safety

Checks:

- browser prompt list/detail/dashboard API
- anonymized export preview/result
- Markdown archive
- SQLite prompt, analysis, and redaction rows

Metric:

- `privacy_leak_count`

Pass threshold:

- raw API key/token leak count must be `0`
- raw absolute path leak count on browser/export surfaces must be `0`

### 2. Retrieval Quality

Checks:

- known search queries return the expected fixture prompt in the top-k results

Metric:

- `retrieval_top3`

Pass threshold:

- `>= 0.8`

### 3. Prompt Coach Quality

Checks:

- weak prompt fixtures are improved with goal, context, scope, verification, and output-format sections
- raw secrets are not reintroduced into improvement drafts

Metric:

- `coach_gap_fix_rate`

Pass threshold:

- `>= 0.8`

### 4. Analytics Usefulness

Checks:

- total prompt count
- sensitive prompt count
- project distribution
- quality gap summary

Metric:

- `analytics_score`

Pass threshold:

- `>= 0.75`

### 5. Prompt Quality Score Calibration

Checks:

- each fixture prompt receives a deterministic `0-100` prompt quality score
- prompt list and prompt detail expose the same score and band
- vague prompt fixtures score low
- stronger fixtures score meaningfully higher than vague fixtures

Metric:

- `prompt_quality_score_calibration`

Pass threshold:

- `>= 0.8`

### 6. Local Runtime Performance

Checks:

- ingest p95
- search p95
- dashboard latency
- export latency

Pass thresholds:

- `ingest_p95_ms <= 500`
- `search_p95_ms <= 250`
- `dashboard_ms <= 500`
- `export_ms <= 1000`

## Report Shape

```json
{
  "version": "0.1.0-beta.0",
  "dataset": "benchmark-v1",
  "pass": true,
  "scores": {
    "privacy_leak_count": 0,
    "retrieval_top3": 1,
    "coach_gap_fix_rate": 1,
    "prompt_quality_score_calibration": 1,
    "analytics_score": 1,
    "ingest_p95_ms": 21,
    "search_p95_ms": 8,
    "dashboard_ms": 12,
    "export_ms": 16
  },
  "thresholds": {
    "privacy_leak_count": 0,
    "retrieval_top3": 0.8,
    "coach_gap_fix_rate": 0.8,
    "prompt_quality_score_calibration": 0.8,
    "analytics_score": 0.75,
    "ingest_p95_ms": 500,
    "search_p95_ms": 250,
    "dashboard_ms": 500,
    "export_ms": 1000
  }
}
```

## v1 Exclusions

- real user archive evaluation
- external LLM-as-judge
- semantic search quality
- cross-platform performance comparison
- long-term retention analysis

Those items should become opt-in benchmarks after the public beta.
