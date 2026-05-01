# DESIGN.md

이 문서는 `prompt-memory` 웹 UI의 기준 디자인 시스템이다. AI 에이전트는 UI 작업 전에 이 파일을 먼저 읽고, 특정 브랜드를 복제하지 않는 독자적인 developer tool UI를 만든다.

초기 형식은 MIT 라이선스의 `awesome-design-md` 컬렉션이 제안하는 DESIGN.md 구조를 참고했다. 색상, 타이포그래피, 컴포넌트 토큰은 이 제품의 목적에 맞게 새로 정의한다.

## 1. 제품 분위기

- 로컬 우선 프롬프트 아카이브이므로 신뢰감, 차분함, 검색 가능성, 데이터 밀도를 우선한다.
- 운영형 SaaS와 개발자 도구의 중간 톤을 사용한다.
- 화면은 "프롬프트를 모으고 다시 읽는 작업대"처럼 느껴져야 한다.
- 랜딩 페이지식 hero, 장식용 gradient orb, 과한 그림, 카드 안의 카드 구조를 피한다.
- 첫 화면은 실제 prompt list 또는 빈 archive 상태여야 한다.

## 2. 색상 토큰

기본은 밝은 테마이며, 이후 dark mode를 확장할 수 있게 의미 토큰으로 작성한다.

| Token | Hex | 용도 |
| --- | --- | --- |
| `--pm-bg` | `#F7F7F4` | 앱 배경 |
| `--pm-surface` | `#FFFFFF` | 테이블, 패널, 모달 |
| `--pm-surface-muted` | `#EFEFED` | 보조 영역, 비활성 배경 |
| `--pm-border` | `#D8D8D2` | 경계선 |
| `--pm-border-strong` | `#B8B8AE` | 선택/포커스 경계 |
| `--pm-text` | `#181A1B` | 본문 |
| `--pm-text-muted` | `#626663` | 보조 텍스트 |
| `--pm-text-subtle` | `#8A8E89` | 메타데이터 |
| `--pm-accent` | `#256B5F` | 주요 액션, 선택 상태 |
| `--pm-accent-weak` | `#DCEBE7` | 선택 행 배경 |
| `--pm-danger` | `#B42318` | 삭제, 위험 |
| `--pm-danger-weak` | `#FDE7E4` | 위험 배경 |
| `--pm-warning` | `#9A5B00` | 진단 경고 |
| `--pm-code-bg` | `#ECEDE8` | 코드/프롬프트 블록 배경 |

## 3. 타이포그래피

- 시스템 폰트를 사용한다: `Inter`, `ui-sans-serif`, `system-ui`, `Apple SD Gothic Neo`, `Pretendard`, `sans-serif`.
- 코드와 prompt body는 `JetBrains Mono`, `SFMono-Regular`, `ui-monospace`, `monospace`.
- 글자 간격은 기본 `0`을 유지한다.
- viewport width에 따라 폰트 크기를 직접 스케일하지 않는다.

| 역할 | 크기 | 굵기 | 줄높이 |
| --- | --- | --- | --- |
| Page title | 24px | 650 | 32px |
| Section title | 18px | 650 | 26px |
| Table/body | 14px | 400 | 22px |
| Metadata | 12px | 450 | 18px |
| Code/prompt | 13px | 400 | 21px |
| Button | 13px | 600 | 18px |

## 4. 레이아웃

- 앱 shell은 좌측 navigation 240px, 본문 fluid layout을 기본으로 한다.
- 본문 최대 폭은 목록 화면에서 1440px, 상세 읽기 화면에서 1080px.
- spacing scale: `4, 8, 12, 16, 20, 24, 32, 40`.
- border radius는 기본 6px, 모달과 큰 패널은 8px까지 허용한다.
- 반복 item card는 허용하지만 page section 자체를 floating card로 만들지 않는다.
- 데이터 테이블은 행 높이 44-52px를 기준으로 하고 hover/selection에서 높이가 변하지 않아야 한다.

## 5. 주요 화면

### Prompt List

- 첫 화면이다.
- 상단에는 검색 input, tool filter, sensitivity filter, date range, doctor status indicator를 둔다.
- 목록은 newest-first이며 id, tool, cwd/project, received time, redaction/index status, prompt length를 보여준다.
- 긴 cwd와 prompt preview는 한 줄 말줄임 처리한다.
- 빈 상태는 짧은 문장과 `install-hook claude-code` 안내 명령만 보여준다.

### Prompt Detail

- 좌측은 metadata, 우측은 Markdown/prompt body를 읽는 구조를 우선한다.
- prompt body는 monospace, line wrap, copy button, redaction badge를 제공한다.
- 삭제 버튼은 danger style이며 확인 모달을 거친다.

### Settings / Doctor

- 설정은 capture status, data directory, hook install status, last ingest status, redaction mode를 보여준다.
- 정상/경고/실패 상태를 색상만으로 구분하지 말고 텍스트와 아이콘을 함께 쓴다.

## 6. 컴포넌트

- Button: 높이 32px, padding 10-12px, radius 6px. 아이콘이 있으면 lucide 계열 아이콘을 우선한다.
- Input: 높이 36px, 배경 `--pm-surface`, border `--pm-border`, focus border `--pm-accent`.
- Table: header는 12px uppercase를 피하고 일반 metadata style로 간결하게 둔다.
- Badge: radius 999px는 status badge에만 허용한다.
- Modal: 배경 dim은 낮게, danger confirmation은 삭제 대상 id를 명확히 보여준다.
- Toast: 오른쪽 하단, 4초 후 사라짐, 에러는 사용자가 닫을 수 있어야 한다.

## 7. 상호작용

- 모든 destructive action은 대상과 결과를 명확히 확인한다.
- 검색은 입력 중 debounce를 적용하고, 빈 query는 기본 목록으로 돌아간다.
- 로딩 상태는 skeleton보다 작은 progress row 또는 inline spinner를 우선한다.
- keyboard navigation을 고려해 focus outline을 숨기지 않는다.

## 8. 반응형

- 1024px 이상: 좌측 nav + 본문 2열 가능.
- 768-1023px: nav 축소, detail metadata는 상단 summary로 이동.
- 767px 이하: 단일 column, table은 list row 형태로 전환.
- touch target은 최소 40px.
- 모바일에서 텍스트가 버튼/배지 밖으로 넘치면 줄바꿈하거나 축약한다.

## 9. 금지 사항

- 프롬프트 원문을 로그, 오류, URL query에 노출하지 않는다.
- UI에 "이 기능은..." 같은 설명문을 과하게 넣지 않는다.
- 보라/남색 gradient 중심의 한 가지 색감으로 전체를 덮지 않는다.
- 장식용 orb, bokeh, 불필요한 hero, 카드 중첩을 만들지 않는다.
- 외부 이미지를 prompt preview 안에서 자동 로드하지 않는다.

## 10. 구현 후 검증

UI 변경 후 다음을 확인한다.

- Playwright MCP desktop 1440x900 screenshot.
- Playwright MCP mobile 390x844 screenshot.
- accessibility snapshot에서 주요 버튼과 링크 이름 확인.
- 목록, 검색, 상세, 삭제 확인 모달, 빈 상태가 실제로 동작하는지 확인.
- 텍스트 겹침, 버튼 overflow, 빈 canvas, hydration 오류가 없는지 확인.
