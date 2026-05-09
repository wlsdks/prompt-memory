# Web UI Usability Audit (2026-05-08)

## 환경 메모

- 17373 서버는 `/var/folders/.../pm-session-start-u0uk8B/data` 임시 디렉토리를 보고 있어 list/dashboard 모두 0 prompts. 사용자의 실제 `~/.prompt-coach/prompt-coach.sqlite`(active 467개)와 분리됨. 본 감사는 코드 수정 금지/read-only 환경이므로 detail 페이지, 점수별 정렬, fork affordance 등 데이터-필요 동작은 직접 확인하지 못함. 그 사실 자체가 Major 발견점 1.
- desktop 1280x900 + mobile 390x844 두 viewport 확인. 한국어 locale 기준.

## Flow 1: Reuse loop

### 첫인상

- list 페이지가 첫 화면이고 hero/landing이 없음. DESIGN 원칙 일치.
- empty state는 큰 카드 하나 + CLI 명령 5줄. "이미 데이터가 있는데 왜 비었는지"를 판별할 수 있는 단서(데이터 디렉토리, 서버 PID, 마지막 수집 시각)가 0개.
- 필터 8개가 헤더에 한 줄로 노출. quality band 필터는 UI에도 URL params에도 없음(`?quality_band=excellent` 무시되고 `/`로 정리됨).
- 점수/quality band 컬럼 자체가 list 페이지 sort/filter affordance에 없으므로 "잘 썼던 프롬프트"의 진입점이 부족.

### 발견된 friction

| 심각도 | 위치 | 관찰 | 사용자가 막힌 지점 | 추천 fix 방향 |
|---|---|---|---|---|
| Major | `/` 필터 헤더 | quality band 필터·URL param 모두 없음 | "점수 좋은 프롬프트 보기"로 좁힐 수단이 없어 reuse 시작점 자체가 비어있음 | focus/gap 옆에 quality band combobox 추가, `?quality_band=excellent\|good\|...` 지원 |
| Major | `/` empty state | 데이터 디렉토리/서버 출처 미표시. 환경 mismatch를 사용자가 못 알아챔 | 사용자가 collect는 잘 됐는데 다른 서버를 보고 있을 때 "비어있다"만 보임 | empty state 하단에 active data_dir, sqlite path(앞부분만), 마지막 stored_at 메타 노출 |
| Major | detail 페이지 (관찰 보류) | 데이터 0이라 검증 불가. PRD/DESIGN 어디에도 "fork as draft" affordance 명시 없음 | 잘 쓴 프롬프트를 새 작업에 재사용하는 1-click 경로가 있는지 확인 못함. 있더라도 list에서 detail 진입 자체가 점수 정렬 부재로 막힘 | (차후) detail에서 "이 프롬프트로 새 draft 만들기" 명시적 CTA, raw markdown copy 버튼 분리 |
| Minor | list 헤더 | 8개 필터 동등 가중치로 한 줄 배치 | 핵심(검색·tool·focus) 외에 cwd prefix·gap·sensitivity가 똑같이 시야 점유 | 기본 노출은 search+tool+focus, 나머지는 "더 보기" disclosure |

## Flow 2: Search/filter

### 발견된 friction

| 심각도 | 위치 | 관찰 | 사용자가 막힌 지점 | 추천 fix 방향 |
|---|---|---|---|---|
| Major | project 필터 부재 | "특정 프로젝트" 필터가 cwd prefix 자유입력만 있음 | 사용자는 project label/이름을 알지 raw cwd 절대경로를 외우지 못함 | projects API 기반 dropdown(project_label) 추가, free-text는 advanced |
| Minor | active filter chip | 한국어/영어 mix("검색", "도구" vs "Focus", "Start date") | locale 일관성 깨짐, 시각적 노이즈 | i18n 키 누락분 한국어 라벨 추가 |
| Minor | mobile 390px | nav rail이 영구 expanded로 contents 위 stack. 7개 nav 항목 + 언어 토글 후에야 list 보임 | 주요 작업 화면 진입까지 큰 스크롤 | mobile breakpoint에서 rail 자동 collapse 또는 drawer toggle |
| Minor | empty state copy | `Clear filters to return to the full archive.` 만 영어 잔존 | i18n 누락 | 한국어 카피 추가 |
| Polish | filter 토글 반응성 | search·focus 변경 즉시 URL 반영, active filter bar/clear-all 정상 | 좋음 | (유지) |
| Polish | dashboard metric tiles | 0 상태에서도 "전체 프롬프트 0 보기" 버튼이 클릭 가능 | 결과 없는 페이지로 이동만 함 | 0일 때 disabled 또는 데이터 모으는 CTA로 대체 |
| Polish | date input | 한국어 locale에서 `연도. 월. 일.` placeholder, mobile에서 두 줄 차지 | 입력 가능하나 시야 점유 큼 | 단일 range picker로 압축 |

## 종합

### Top 3 우선순위 fix

1. **quality band 필터 + 점수 컬럼/정렬을 list에 노출** — reuse loop의 시작점 자체가 막혀있음. URL param도 함께.
2. **project_label 기반 project 필터 dropdown 추가** — 사용자는 cwd 절대경로가 아니라 project 이름으로 사고함.
3. **empty state에 environment 메타 노출(data_dir, last stored_at, server pid)** — "비었다"가 진짜 0인지 환경 mismatch인지 자가진단 가능하게.

### 다음 세션 추천

- 데이터가 있는 환경(server를 `~/.prompt-coach` data_dir로 띄우거나 fixture seed)에서 detail 페이지 reuse affordance, raw markdown 복사 버튼, score band별 정렬, "이 프롬프트로 새 draft" CTA 유무를 직접 확인.
- coach/projects/settings 페이지의 정보 hierarchy와 dangerous action(삭제 등) 확인.
- keyboard navigation, focus ring, skip-link 동작 정밀 확인(skip-link 자체는 존재 확인됨).
