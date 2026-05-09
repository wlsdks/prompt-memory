# DESIGN.md

`prompt-coach`의 전용 웹 UI 디자인 시스템이다. AI 에이전트는 UI 작업 전에 이 문서를 읽고, 로컬 우선 프롬프트 아카이브에 맞는 조용하고 정밀한 developer tool UI를 만든다.

이 문서는 `/Users/jinan/side-project/oh-my-ontology`의 Linear-base dark indigo 디자인 시스템을 1차 기준으로 삼는다. 로컬 디자인 가이드 컬렉션 `/Users/jinan/ai/awesome-design-md`는 보조 reference다. 특정 브랜드를 복제하지 않지만, `oh-my-ontology`의 절제된 흑백, 단일 인디고, mono caption, hairline surface hierarchy를 `prompt-coach`의 developer tool 화면에 맞게 적용한다.

UI를 크게 바꾸는 작업, 특히 Dashboard, onboarding, detail coach 화면은 먼저 `/Users/jinan/ai/awesome-design-md`에서 관련 reference를 확인한다. 로컬 파일이 stub이면 `getdesign`으로 해당 reference를 확인하고, 적용한 판단은 `docs/design-references/` 또는 이 문서에 남긴다.

## 1. Visual Theme & Atmosphere

### Product Feeling

- 로컬 저장소를 열어 프롬프트 기록, 품질 신호, 민감정보 상태를 점검하는 "developer workbench"처럼 보여야 한다.
- 첫 화면은 항상 실제 archive/list다. 마케팅 hero, 소개 랜딩, 장식용 illustration을 만들지 않는다.
- 전체 분위기는 차분하고 촘촘하다. 화면을 예쁘게 비우는 것보다 빠르게 스캔하고 조작하는 밀도를 우선한다.
- 기본은 dark canvas다. `#08090a` 계열 canvas, `#0f1011` panel, `#191a1b` elevated surface, 단일 indigo accent를 사용한다.
- 채색은 indigo 하나가 원칙이다. warning/danger 상태만 예외로 쓰고, decorative color나 teal/purple-pink gradient를 만들지 않는다.
- 카드형 대시보드가 필요할 때도 "floating marketing card"처럼 보이면 안 된다. 경계선, 낮은 대비, 안정적인 grid로 운영 도구처럼 보이게 한다.
- Dashboard의 첫 영역은 단순 metric card 묶음이 아니라 prompt habit command center여야 한다. score, 반복 약점, 다음에 고칠 문장, 낮은 점수 review queue가 한 화면에서 연결되어야 한다.

### Visual Keywords

- warm local
- precise archive
- quiet diagnostics
- code-native
- dense but readable

### Surface Hierarchy

1. **Workbench background**: 앱 전체 배경. 아주 미세한 warm tint.
2. **Rail surface**: 좌측 nav. 본문보다 약간 밝고 고정된 도구 영역.
3. **Data surface**: table, panels, detail reader. 흰색에 가까운 작업 표면.
4. **Inset surface**: prompt body, code, copyable suggestions. 낮은 대비의 recessed block.
5. **Active surface**: selected nav, selected filter, hover row. teal tint를 얇게 사용.

## 2. Color Palette & Roles

| Token | Hex | Role |
| --- | --- | --- |
| `--pc-bg` | `#F6F4EF` | Workbench page background |
| `--pc-rail` | `#FBFAF6` | Sidebar and fixed chrome |
| `--pc-surface` | `#FFFFFF` | Primary data surfaces |
| `--pc-surface-muted` | `#EEECE6` | Inset blocks, inactive controls |
| `--pc-surface-raised` | `#FFFEFA` | Slightly raised panels |
| `--pc-border` | `#D8D4CA` | Default separators |
| `--pc-border-strong` | `#B9B2A5` | Active/focus borders |
| `--pc-text` | `#171816` | Primary body text |
| `--pc-text-muted` | `#64665F` | Secondary copy |
| `--pc-text-subtle` | `#8A887F` | Metadata, labels |
| `--pc-accent` | `#1F6F64` | Primary selection/action |
| `--pc-accent-strong` | `#154F48` | Strong active text |
| `--pc-accent-weak` | `#DDECE7` | Selected rows/nav |
| `--pc-info` | `#315F8C` | Informational diagnostics |
| `--pc-warning` | `#9A5B00` | Weak quality signal |
| `--pc-warning-weak` | `#F5E6C8` | Warning background |
| `--pc-danger` | `#B42318` | Delete/destructive state |
| `--pc-danger-weak` | `#FDE7E4` | Danger background |
| `--pc-code-bg` | `#E9E8E1` | Prompt/code/suggestion blocks |
| `--pc-shadow` | `0 1px 2px rgb(27 25 20 / 0.06)` | Minimal elevation |

### Color Rules

- Indigo is for current location, selected state, primary focus, and coach emphasis.
- Amber is only for weak/missing quality states or diagnostic warnings.
- Red is only for destructive actions and security-sensitive warnings.
- Tags use muted neutral pills by default. A tag must not look like a primary button.
- Do not create purple/pink gradients, glassmorphism, glow pulse, neon, animated aurora, or multi-color AI-looking dashboards.

## 3. Typography Rules

Use system fonts for UI and monospace for prompt content. The UI must work on Korean and English mixed text without custom font loading.

```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Apple SD Gothic Neo", Pretendard, "Segoe UI", sans-serif;
```

For prompt bodies and code:

```css
font-family: "JetBrains Mono", SFMono-Regular, ui-monospace, Menlo, Consolas,
  monospace;
```

| Role | Size | Weight | Line height | Use |
| --- | --- | --- | --- | --- |
| Page title | 24px | 700 | 32px | Current view title |
| Panel title | 16px | 700 | 24px | Dashboard/detail section title |
| Table body | 14px | 450 | 22px | List row data |
| Body | 14px | 400 | 22px | UI copy |
| Metadata | 12px | 500 | 18px | Labels, timestamps |
| Tiny label | 11px | 650 | 16px | Compact status, metric label |
| Prompt/code | 13px | 400 | 21px | Captured prompt content |
| Button | 13px | 650 | 18px | Commands |

### Typography Rules

- Letter spacing stays `0`. Do not scale type by viewport width.
- Avoid huge display type inside panels. Dense operational screens use compact headings.
- Prompt body wraps lines and never creates horizontal page scroll.
- Metadata labels are readable but visually secondary.

## 4. Component Stylings

### Navigation

- Left rail width: 232-240px desktop.
- Active nav uses `--pc-accent-weak` background and `--pc-accent-strong` text.
- Nav buttons are 36px tall on desktop, at least 40px touch target on mobile.
- Icons from lucide are preferred. Do not draw custom SVG icons when lucide has one.

### Data Table / Prompt List

- Header row uses muted surface and 12px metadata text.
- Rows are 48px minimum height desktop; mobile rows become compact stacked blocks.
- Rows must not change height on hover.
- Show tags/status in a wrap-safe container. Badges must not push length or path columns out of view.
- Newest prompts stay first.

### Panels

- Border radius is 6px for compact panels, 8px maximum for larger panels.
- Panels use a single border and minimal shadow. Do not nest card inside card unless it is a repeated item or copyable suggestion.
- Dashboard metric cards are allowed, but keep them compact and aligned.
- Dashboard의 coach 영역은 nested card grid로 보이면 안 된다. 하나의 단단한 command surface 안에서 hairline separator, compact rows, status rail로 정보를 나눈다.

### Badges

- Status badges may use pill radius.
- Tag badges are neutral and lower contrast.
- `missing`/`weak` quality states use dot + text, not color alone.

### Buttons

- Primary/danger commands include an icon when it improves recognition.
- Copy buttons are square icon buttons with accessible names.
- Destructive commands are red and require confirmation.

### Inputs

- Height: 36px desktop, 40px mobile.
- Focus border uses `--pc-accent`.
- Date inputs and selects must have enough width for Korean placeholder text.

### Prompt Reader

- Prompt content uses monospace and inset background only when needed for code blocks.
- Redacted placeholders can be visible in stored prompt body, but raw secrets must never appear.
- Copy controls may be added later, but must not log prompt content.

## 5. Layout Principles

- Desktop shell: left rail + fluid workspace.
- Workspace max width: 1240px for operational screens, 1080px for detail reader.
- Use 8px grid: `4, 8, 12, 16, 20, 24, 32, 40`.
- Topbar is compact: title left, filters right. Filters wrap before they overflow.
- Dashboard uses 4 metric columns on desktop, 2 columns on tablet, 1 column on mobile.
- Detail page uses metadata sidebar + prompt reader on desktop, single column on mobile.

## 6. Depth & Elevation

- Default elevation is border-only.
- Use `--pc-shadow` only on active surfaces, modals, and table/panel containers.
- Avoid blurred background effects, decorative orbs, bokeh, and gradient blobs.
- Separators should be visible enough for scanability but never heavy black.

## 7. Do's and Don'ts

### Do

- Build actual archive, search, detail, dashboard, settings, and diagnostic screens.
- Prefer dense tables, compact panels, and precise labels.
- Keep raw prompt text out of logs, errors, URL query, and analytics.
- Use copyable suggestions for AGENTS.md / CLAUDE.md candidates; do not auto-edit instruction files.
- Validate desktop and mobile rendering with Playwright.

### Don't

- Do not create a landing page.
- Do not use one-note purple/blue gradients.
- Do not put page sections inside decorative nested cards.
- Do not use color alone for status.
- Do not allow buttons, badges, paths, or Korean labels to overflow their containers.
- Do not fetch or render external media inside prompt previews.

## 8. Responsive Behavior

| Breakpoint | Behavior |
| --- | --- |
| `>= 1024px` | Full left rail, compact topbar filters, table layout |
| `768-1023px` | Rail stays visible, dashboard uses 2 columns, detail may narrow |
| `< 768px` | Single column, rail becomes top block, filters stack, table rows become list rows |

Mobile rules:

- Touch targets are at least 40px.
- Badges wrap.
- Long IDs, paths, and prompts use `overflow-wrap: anywhere`.
- No horizontal page scroll.

## 9. Agent Prompt Guide

When implementing UI in this repo:

1. Read `DESIGN.md` before editing UI.
2. Keep the first screen as the prompt archive or a functional empty archive.
3. Use the warm workbench palette and compact data surfaces.
4. Prefer lucide icons for commands and navigation.
5. Confirm with Playwright desktop and mobile screenshots.
6. If a design choice conflicts with data density or local-first safety, choose safety and density.

Useful quick prompt:

> Restyle this screen as a warm, precise local developer workbench. Keep the real archive/dashboard workflow first, avoid hero layouts, use compact bordered data surfaces, and make every status/tag/filter wrap safely on mobile.
