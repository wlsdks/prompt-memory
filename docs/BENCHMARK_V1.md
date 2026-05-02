# Benchmark v1 Spec

작성일: 2026-05-02

## 목적

Benchmark v1은 `prompt-memory`가 Claude Code/Codex 사용자에게 실제로 유용한지 숫자로 확인하기 위한 로컬 평가 도구다.

이 벤치마크는 전통적인 성능 측정만 보지 않는다. 제품 핵심 가치인 "다시 찾기", "나쁜 습관 보기", "다음 prompt 개선", "local-first privacy"를 함께 측정한다.

## 원칙

- 기본 실행은 local-only다.
- 외부 LLM judge, embedding API, telemetry 전송은 사용하지 않는다.
- fixture prompt는 synthetic 데이터만 쓴다.
- benchmark report에는 raw secret, raw absolute path, 원문 민감정보를 남기지 않는다.
- v1은 회귀 방지와 baseline 수립이 목적이다. 절대 점수보다 버전 간 변화가 더 중요하다.

## 실행

```sh
pnpm benchmark
pnpm benchmark -- --json
```

`pnpm benchmark`는 먼저 production build를 만들고, 임시 data dir과 임시 localhost port에서 서버를 실행한다.

## 측정 영역

### 1. Privacy Safety

확인 대상:

- browser prompt list/detail/dashboard API
- anonymized export preview/result
- Markdown archive
- SQLite prompt/analysis/redaction rows

측정값:

- `privacy_leak_count`

통과 기준:

- raw API key/token leak count는 0이어야 한다.
- browser/export surface의 raw absolute path leak count는 0이어야 한다.

### 2. Retrieval Quality

확인 대상:

- API search 결과에서 known query가 기대 prompt를 top-k 안에 찾는지 본다.

측정값:

- `retrieval_top3`

통과 기준:

- v1 기준 `>= 0.8`

### 3. Prompt Coach Quality

확인 대상:

- weak prompt를 `local-rules-v1` 개선안으로 바꿨을 때 목표, 맥락, 범위, 검증, 출력 형식 섹션이 보강되는지 본다.
- raw secret이 개선안에 다시 들어가지 않는지 본다.

측정값:

- `coach_gap_fix_rate`

통과 기준:

- v1 기준 `>= 0.8`

### 4. Analytics Usefulness

확인 대상:

- total prompt count
- sensitive prompt count
- project distribution
- quality gap summary

측정값:

- `analytics_score`

통과 기준:

- v1 기준 `>= 0.75`

### 5. Local Runtime Performance

확인 대상:

- ingest p95
- search p95
- dashboard latency
- export latency

통과 기준:

- `ingest_p95_ms <= 500`
- `search_p95_ms <= 250`
- `dashboard_ms <= 500`
- `export_ms <= 1000`

## Report Shape

```json
{
  "version": "0.0.0",
  "dataset": "benchmark-v1",
  "pass": true,
  "scores": {
    "privacy_leak_count": 0,
    "retrieval_top3": 1,
    "coach_gap_fix_rate": 1,
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
    "analytics_score": 0.75,
    "ingest_p95_ms": 500,
    "search_p95_ms": 250,
    "dashboard_ms": 500,
    "export_ms": 1000
  }
}
```

## v1 제외 범위

- 실제 사용자 archive 평가
- 외부 LLM-as-judge
- semantic search 품질
- cross-platform performance 비교
- 장기 사용 retention 분석

이 항목들은 public beta 이후 opt-in benchmark로 분리한다.
