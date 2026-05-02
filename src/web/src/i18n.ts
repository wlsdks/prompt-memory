export type Language = "en" | "ko";

const LANGUAGE_KEY = "prompt-memory.language";

export function detectInitialLanguage(): Language {
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  if (stored === "en" || stored === "ko") {
    return stored;
  }
  return "en";
}

export function persistLanguage(language: Language): void {
  window.localStorage.setItem(LANGUAGE_KEY, language);
}

export function localizeElement(root: HTMLElement, language: Language): void {
  if (language === "en") {
    return;
  }
  translateTextNodes(root);
  translateAttributes(root);
}

function translateTextNodes(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of nodes) {
    if (shouldSkipTextNode(node)) {
      continue;
    }
    const next = translateText(node.nodeValue ?? "");
    if (next !== node.nodeValue) {
      node.nodeValue = next;
    }
  }
}

function shouldSkipTextNode(node: Text): boolean {
  return Boolean(
    node.parentElement?.closest("pre, code, textarea, input, .markdown-body"),
  );
}

function translateAttributes(root: HTMLElement): void {
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    for (const attribute of ["aria-label", "placeholder", "title"]) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translateText(value);
      if (next !== value) {
        element.setAttribute(attribute, next);
      }
    }
  }
}

function translateText(value: string): string {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const trimmed = value.trim();
  const translated = UI_TRANSLATIONS[trimmed] ?? translateDynamic(trimmed);
  return translated ? `${leading}${translated}${trailing}` : value;
}

function translateDynamic(value: string): string | undefined {
  if (value.includes(", ")) {
    const parts = value.split(", ");
    const translatedParts = parts.map(translateKnown);
    if (translatedParts.some((part, index) => part !== parts[index])) {
      return translatedParts.join(", ");
    }
  }
  if (/^View .+: .+$/.test(value)) {
    return value.replace(
      /^View (.+): (.+)$/,
      (_match, label: string, metric: string) =>
        `${translateKnown(label)} 보기: ${metric}`,
    );
  }
  if (/^(.+): view (\d+) for (.+)$/.test(value)) {
    return value.replace(
      /^(.+): view (\d+) for (.+)$/,
      (_match, label: string, count: string, name: string) =>
        `${translateKnown(label)}: ${name} ${count}개 보기`,
    );
  }
  if (/^(.+): view (\d+) prompts$/.test(value)) {
    return value.replace(
      /^(.+): view (\d+) prompts$/,
      "$1: 프롬프트 $2개 보기",
    );
  }
  if (/^copy \d+$/.test(value)) {
    return value.replace(/^copy (\d+)$/, "복사 $1");
  }
  if (/^dup \d+$/.test(value)) {
    return value.replace(/^dup (\d+)$/, "중복 $1");
  }
  if (/^\d+ prompts$/.test(value)) {
    return value.replace(/^(\d+) prompts$/, "프롬프트 $1개");
  }
  if (/^\d+ stored$/.test(value)) {
    return value.replace(/^(\d+) stored$/, "$1개 저장됨");
  }
  if (/^\d+ scored( \/ more available)?$/.test(value)) {
    return value.replace(
      /^(\d+) scored( \/ more available)?$/,
      (_match, count: string, hasMore: string | undefined) =>
        hasMore ? `${count}개 평가됨 / 더 있음` : `${count}개 평가됨`,
    );
  }
  if (/^\d+ prompts scored \/ \d+$/.test(value)) {
    return value.replace(
      /^(\d+) prompts scored \/ (\d+)$/,
      "$1개 프롬프트 평가됨 / $2",
    );
  }
  if (/^\d+ scored \/ \d+ stored$/.test(value)) {
    return value.replace(
      /^(\d+) scored \/ (\d+) stored$/,
      "$1개 평가됨 / $2개 저장됨",
    );
  }
  if (/^archive score \/ \d+$/.test(value)) {
    return value.replace(/^archive score \/ (\d+)$/, "아카이브 점수 / $1");
  }
  if (/^\d+% of measured prompts$/.test(value)) {
    return value.replace(
      /^(\d+)% of measured prompts$/,
      "측정된 프롬프트의 $1%",
    );
  }
  if (/^Measured .+$/.test(value)) {
    return value.replace(/^Measured (.+)$/, "$1 측정");
  }
  if (/^Auto-updates every \d+s while open$/.test(value)) {
    return value.replace(
      /^Auto-updates every (\d+)s while open$/,
      "열려 있는 동안 $1초마다 자동 갱신",
    );
  }
  if (/^recent \d+ \/ previous \d+$/.test(value)) {
    return value.replace(
      /^recent (\d+) \/ previous (\d+)$/,
      "최근 $1 / 이전 $2",
    );
  }
  if (/^[+-]\d+ points$/.test(value)) {
    return value.replace(/^([+-]\d+) points$/, "$1점");
  }
  if (/^\d+ prompts \/ \d+%$/.test(value)) {
    return value.replace(/^(\d+) prompts \/ (\d+)%$/, "$1개 프롬프트 / $2%");
  }
  if (/^\d+ prompts need this habit\.$/.test(value)) {
    return value.replace(
      /^(\d+) prompts need this habit\.$/,
      "$1개 프롬프트에 이 습관이 필요합니다.",
    );
  }
  if (/^missing \d+ \/ weak \d+ \d+%$/.test(value)) {
    return value.replace(
      /^missing (\d+) \/ weak (\d+) (\d+)%$/,
      "누락 $1 / 약함 $2 $3%",
    );
  }
  if (/^missing \d+ \/ weak \d+$/.test(value)) {
    return value.replace(/^missing (\d+) \/ weak (\d+)$/, "누락 $1 / 약함 $2");
  }
  if (/^누락 \d+ \/ weak \d+$/.test(value)) {
    return value.replace(/^누락 (\d+) \/ weak (\d+)$/, "누락 $1 / 약함 $2");
  }
  if (/^.+ missing \d+ \/ weak \d+ \d+%$/.test(value)) {
    return value.replace(
      /^(.+) missing (\d+) \/ weak (\d+) (\d+)%$/,
      (_match, label: string, missing: string, weak: string, rate: string) =>
        `${translateKnown(label)} 누락 ${missing} / 약함 ${weak} ${rate}%`,
    );
  }
  if (/^.+ 누락 \d+ \/ weak \d+ \d+%$/.test(value)) {
    return value.replace(
      /^(.+) 누락 (\d+) \/ weak (\d+) (\d+)%$/,
      "$1 누락 $2 / 약함 $3 $4%",
    );
  }
  if (/^.+ has \d+ repeated prompts missing .+\.$/.test(value)) {
    return value.replace(
      /^(.+) has (\d+) repeated prompts missing (.+)\.$/,
      (_match, project: string, count: string, gap: string) =>
        `${project}에서 ${translateKnown(gap)}이 빠진 반복 프롬프트가 ${count}개 있습니다.`,
    );
  }
  if (
    /^.+ has \d+ repeated prompts with unclear goals or targets\.$/.test(value)
  ) {
    return value.replace(
      /^(.+) has (\d+) repeated prompts with unclear goals or targets\.$/,
      "$1에서 목표나 대상이 불명확한 반복 프롬프트가 $2개 있습니다.",
    );
  }
  if (/^.+ often omits test commands or verification criteria\.$/.test(value)) {
    return value.replace(
      /^(.+) often omits test commands or verification criteria\.$/,
      "$1에서 테스트 명령이나 검증 기준이 자주 빠집니다.",
    );
  }
  if (/^.+ is missing or weak in \d+ prompts\.$/.test(value)) {
    return value.replace(
      /^(.+) is missing or weak in (\d+) prompts\.$/,
      (_match, gap: string, count: string) =>
        `${translateKnown(gap)}이 ${count}개 프롬프트에서 누락되었거나 약합니다.`,
    );
  }
  if (/^.+ is repeatedly missing in .+\.$/.test(value)) {
    return value.replace(
      /^(.+) is repeatedly missing in (.+)\.$/,
      (_match, gap: string, project: string) =>
        `${project}에서 ${translateKnown(gap)}이 반복적으로 빠집니다.`,
    );
  }
  if (/^\d+ reuse candidates$/.test(value)) {
    return value.replace(/^(\d+) reuse candidates$/, "재사용 후보 $1개");
  }
  if (/^.+ · \d+ review$/.test(value)) {
    return value.replace(
      /^(.+) · (\d+) review$/,
      (_match, label: string, count: string) =>
        `${translateKnown(label)} · 리뷰 ${count}개`,
    );
  }
  if (/^\d+ low score prompts$/.test(value)) {
    return value.replace(
      /^(\d+) low score prompts$/,
      "낮은 점수 프롬프트 $1개",
    );
  }
  if (/^\d+ prompts need review$/.test(value)) {
    return value.replace(
      /^(\d+) prompts need review$/,
      "리뷰 필요한 프롬프트 $1개",
    );
  }
  if (/^Review \d+ low-score prompt(s)?$/.test(value)) {
    return value.replace(
      /^Review (\d+) low-score prompt(s)?$/,
      "낮은 점수 프롬프트 $1개 리뷰",
    );
  }
  if (/^Fix .+$/.test(value)) {
    return value.replace(/^Fix (.+)$/, (_match, gap: string) => {
      return `${translateKnown(gap)} 고치기`;
    });
  }
  if (/^\d+ projects · \d+ duplicate groups$/.test(value)) {
    return value.replace(
      /^(\d+) projects · (\d+) duplicate groups$/,
      "프로젝트 $1개 · 중복 그룹 $2개",
    );
  }
  if (/^gap \d+%$/.test(value)) {
    return value.replace(/^gap (.+)$/, "부족 $1");
  }
  if (/^sensitive \d+$/.test(value)) {
    return value.replace(/^sensitive (\d+)$/, "민감 $1");
  }
  if (/^saved \d+$/.test(value)) {
    return value.replace(/^saved (\d+)$/, "저장 $1");
  }
  if (/^version .+$/.test(value)) {
    return value.replace(/^version (.+)$/, "버전 $1");
  }
  return undefined;
}

function translateKnown(value: string): string {
  return (
    UI_TRANSLATIONS[value] ??
    QUALITY_LABEL_TRANSLATIONS[value.toLowerCase()] ??
    value
  );
}

const QUALITY_LABEL_TRANSLATIONS: Record<string, string> = {
  "goal clarity": "목표 명확성",
  "background context": "배경 맥락",
  "scope limits": "범위 제한",
  "output format": "출력 형식",
  "verification criteria": "검증 기준",
};

const UI_TRANSLATIONS: Record<string, string> = {
  "Skip to content": "본문으로 건너뛰기",
  "Primary navigation": "주요 탐색",
  Prompts: "프롬프트",
  Dashboard: "대시보드",
  Coach: "코치",
  Scores: "점수",
  Benchmark: "벤치마크",
  Insights: "인사이트",
  Projects: "프로젝트",
  Export: "내보내기",
  Settings: "설정",
  Language: "언어",
  "Server OK": "서버 정상",
  "Checking status": "상태 확인 중",
  "Local prompt archive": "로컬 프롬프트 아카이브",
  "Prompt archive": "프롬프트 아카이브",
  "Prompt detail": "프롬프트 상세",
  "Quality dashboard": "품질 대시보드",
  "Prompt coach": "프롬프트 코치",
  "Prompt scores": "프롬프트 점수",
  "Prompt benchmark": "프롬프트 벤치마크",
  "Prompt insights": "프롬프트 인사이트",
  "Anonymized export": "익명화 Export",
  "Prompts Search": "프롬프트 검색",
  "Prompts Search...": "프롬프트 검색...",
  "Prompts Search…": "프롬프트 검색...",
  "Tool filter": "도구 필터",
  "All tools": "전체 도구",
  "Tag filter": "태그 필터",
  "All tags": "전체 태그",
  "Sensitivity filter": "민감정보 필터",
  "All sensitivity": "전체 민감도",
  "Contains sensitive data": "민감정보 포함",
  "No sensitive data": "민감정보 없음",
  "Focus filter": "포커스 필터",
  "All focus": "전체 Focus",
  Saved: "저장됨",
  Reused: "재사용됨",
  "Duplicate candidates": "중복 후보",
  "Quality gaps": "품질 보강",
  "Quality gap filter": "부족 항목 필터",
  "All quality gaps": "전체 부족 항목",
  "Path prefix filter": "경로 접두사 필터",
  "Start date filter": "시작일 필터",
  "End date filter": "종료일 필터",
  "Prompts Delete": "프롬프트 삭제",
  Cancel: "취소",
  Delete: "삭제",
  "Loading prompts.": "목록을 불러오는 중입니다.",
  Received: "받은 시간",
  Tool: "도구",
  Path: "경로",
  "Tags/status": "태그/상태",
  Length: "길이",
  "Loading...": "불러오는 중...",
  "Load more": "더 보기",
  "Active filters": "활성 필터",
  "Clear filters": "필터 초기화",
  "Loading prompt details.": "상세 정보를 불러오는 중입니다.",
  "Usefulness and duplicate signals": "유용성 및 중복 신호",
  unsaved: "미저장",
  saved: "저장됨",
  scored: "평가됨",
  redacted: "마스킹됨",
  prompts: "프롬프트",
  projects: "프로젝트",
  missing: "누락",
  gap: "부족",
  reuse: "재사용",
  "top gap": "주요 부족",
  "Back to list": "목록으로",
  "Current queue navigation": "현재 큐 탐색",
  "View previous prompt": "이전 프롬프트 보기",
  Previous: "이전",
  "No queue": "큐 없음",
  "View next prompt": "다음 프롬프트 보기",
  Next: "다음",
  "Save for later": "다시 볼 프롬프트",
  "Copy prompt": "프롬프트 복사",
  Copied: "복사됨",
  "Prompt improvement draft": "프롬프트 개선안",
  "Improvement draft for manual resubmission": "승인 후 재입력할 개선안",
  "Copy draft": "개선안 복사",
  "Save draft": "개선안 저장",
  "Saved drafts": "저장된 개선안",
  "Original structure cleanup": "원문 구조 정리",
  "Analysis preview": "분석 preview",
  "Analysis checklist": "분석 체크리스트",
  "View matching prompts": "같은 항목 보기",
  "Automatic tags": "자동 태그",
  Warnings: "주의할 점",
  "Improvement hints": "개선 힌트",
  "Loading dashboard.": "대시보드를 불러오는 중입니다.",
  "Workspace areas": "작업 영역",
  "Live archive measurement": "실시간 아카이브 측정",
  "Live prompt benchmark": "실시간 프롬프트 벤치마크",
  "Measure your prompt habits": "프롬프트 습관 측정",
  "Measure now": "지금 측정하기",
  "Measuring...": "측정 중...",
  "Open review queue": "리뷰 큐 열기",
  "View gap prompts": "부족 항목 프롬프트 보기",
  "Review backlog": "리뷰 백로그",
  "Biggest gap": "가장 큰 부족 항목",
  Coverage: "측정 범위",
  Privacy: "개인정보 보호",
  "Local-only": "로컬 전용",
  "Privacy check needed": "개인정보 점검 필요",
  "No review backlog": "리뷰 백로그 없음",
  "No repeated gap": "반복 부족 항목 없음",
  "Keep capturing more samples": "표본을 더 수집하세요",
  "Current archive sample is fully covered.":
    "현재 아카이브 표본이 모두 측정되었습니다.",
  "Recent sample measured; more prompts are available.":
    "최근 표본만 측정했습니다. 더 많은 프롬프트가 있습니다.",
  "No external calls, prompt bodies, or raw paths in this report.":
    "이 리포트에는 외부 호출, 프롬프트 본문, 원본 경로가 없습니다.",
  "Review measurement output before sharing it.":
    "공유하기 전에 측정 결과를 점검하세요.",
  "Not measured in this session yet": "이번 세션에서 아직 측정하지 않았습니다",
  "Capture prompts first": "먼저 프롬프트를 수집하세요",
  "Run prompt-memory setup, then send a few real coding requests.":
    "prompt-memory setup을 실행한 뒤 실제 코딩 요청을 몇 개 보내세요.",
  "Open the review queue and rewrite one weak prompt into a reusable request.":
    "리뷰 큐를 열고 약한 프롬프트 하나를 재사용 가능한 요청으로 고쳐 쓰세요.",
  "Capture a few Claude Code or Codex prompts before measuring.":
    "측정 전에 Claude Code 또는 Codex 프롬프트를 몇 개 수집하세요.",
  "Review the backlog and fix the most repeated quality gap next.":
    "백로그를 보고 가장 반복되는 부족 항목을 다음에 고치세요.",
  "The archive is scoring well; keep capturing and reusing prompts.":
    "아카이브 점수가 좋습니다. 계속 수집하고 재사용하세요.",
  "Keep measuring weekly": "매주 계속 측정하세요",
  "The archive is healthy; watch for new gaps as projects change.":
    "아카이브 상태가 좋습니다. 프로젝트가 바뀔 때 새 부족 항목을 확인하세요.",
  "What this measures": "무엇을 측정하나",
  "This is your live archive measurement: it scores recent Claude Code and Codex prompts stored locally, finds repeated gaps, and points to the next review action.":
    "로컬에 저장된 최근 Claude Code/Codex 프롬프트를 점수화하고, 반복 부족 항목과 다음 리뷰 행동을 보여주는 실시간 아카이브 측정입니다.",
  "Benchmark v1": "Benchmark v1",
  "The development benchmark still lives in the CLI as":
    "개발용 벤치마크는 여전히 CLI에 있습니다:",
  "It is a regression gate, not a replacement for measuring your real prompt archive here.":
    "이것은 회귀 방지 게이트이며, 여기서 실제 프롬프트 아카이브를 측정하는 흐름을 대체하지 않습니다.",
  "Improve the next prompt": "다음 프롬프트 개선",
  "Review archive quality": "아카이브 품질 검토",
  "Find reuse and project patterns": "재사용과 프로젝트 패턴 찾기",
  "No repeated weakness yet": "아직 반복 약점이 없습니다",
  "habit score": "습관 점수",
  "archive score": "아카이브 점수",
  signals: "신호",
  "Prompt quality metrics": "프롬프트 품질 지표",
  "Prompt habit coach": "프롬프트 습관 코치",
  "Prompt habit command center": "프롬프트 습관 커맨드 센터",
  "Your prompting pattern": "나의 프롬프트 패턴",
  "Strong habits": "좋은 습관",
  Improving: "개선 중",
  "Needs work": "보강 필요",
  "Needs practice": "연습 필요",
  "No data yet": "아직 데이터 없음",
  "Your Prompt Habit Score": "나의 프롬프트 습관 점수",
  "Progress trend": "개선 추세",
  Flat: "정체",
  Sliding: "하락 중",
  "Not enough data": "데이터 부족",
  "Your biggest weakness": "가장 큰 약점",
  "No repeated weakness yet.": "아직 반복 약점이 없습니다.",
  "Fix these next": "다음에 고칠 것",
  "No repeated habit fix is ready yet.":
    "아직 반복 습관 개선 항목이 충분하지 않습니다.",
  "Bad prompt review queue": "낮은 점수 프롬프트 리뷰 큐",
  "No low score prompts need review yet.":
    "리뷰할 낮은 점수 프롬프트가 없습니다.",
  "Most repeated pattern": "가장 반복되는 패턴",
  "No repeated weak prompting pattern has enough samples yet.":
    "아직 반복 약점 패턴을 판단할 표본이 충분하지 않습니다.",
  "Name the exact goal before asking for changes.":
    "변경을 요청하기 전에 정확한 목표를 먼저 적으세요.",
  "Add the relevant context, files, and constraints.":
    "관련 맥락, 파일, 제약 조건을 추가하세요.",
  "State the allowed scope and what should not change.":
    "허용 범위와 바꾸면 안 되는 대상을 명시하세요.",
  "Specify the expected output format.": "원하는 출력 형식을 지정하세요.",
  "Include the verification command or acceptance check.":
    "검증 명령이나 완료 기준을 포함하세요.",
  "Make the missing expectation explicit next time.":
    "다음에는 빠진 기대사항을 명확히 적으세요.",
  "Open and improve": "열어서 개선",
  "Total prompts": "전체 프롬프트",
  "Average prompt score": "평균 프롬프트 점수",
  "Prompt score": "프롬프트 점수",
  "Last 7 days": "최근 7일",
  "Last 30 days": "최근 30일",
  "Tool distribution": "도구별 분포",
  "Project distribution": "프로젝트별 분포",
  "Reuse candidates": "재사용 후보",
  "View list": "목록 보기",
  "Prompts you copied or saved will appear here.":
    "복사하거나 저장한 프롬프트가 여기에 표시됩니다.",
  "No prompts share the same stored body.":
    "같은 저장 본문을 가진 프롬프트가 없습니다.",
  "Frequent quality gaps": "자주 부족한 항목",
  "No repeated gaps yet.": "아직 반복적으로 부족한 항목이 없습니다.",
  "Repeated patterns": "반복 패턴",
  "Project patterns will appear after more samples are captured.":
    "표본이 더 쌓이면 프로젝트별 패턴이 표시됩니다.",
  "AGENTS.md / CLAUDE.md candidates": "AGENTS.md / CLAUDE.md 후보",
  "No recurring improvement suggestions yet.":
    "아직 제안할 반복 개선 포인트가 없습니다.",
  "Copy suggestion": "제안 복사",
  "Include current state, relevant logs, and the background behind the problem.":
    "현재 상태, 관련 로그, 문제 배경을 포함하세요.",
  "When response shape matters, specify the desired structure such as summary, bullets, table, or JSON.":
    "응답 형태가 중요하면 요약, bullet, table, JSON 같은 원하는 구조를 지정하세요.",
  "Separate the files or areas that may be changed from the areas to exclude.":
    "바꿔도 되는 파일/영역과 제외할 영역을 분리해서 적으세요.",
  "Include test commands and expected results as verification criteria.":
    "검증 기준으로 테스트 명령과 기대 결과를 포함하세요.",
  "Project quality profile": "프로젝트 품질 프로필",
  "No project quality signals yet.": "프로젝트별 품질 신호가 아직 없습니다.",
  "View all": "전체 보기",
  Sensitive: "민감정보",
  "Recent quality trend": "최근 품질 트렌드",
  "7 days": "7일",
  "Archive score review": "아카이브 점수 리뷰",
  "Evaluate archive": "아카이브 평가",
  "No archive score report yet.": "아직 아카이브 점수 리포트가 없습니다.",
  "Average archive score": "평균 아카이브 점수",
  "Score distribution": "점수 분포",
  "Top quality gaps": "주요 부족 항목",
  "Prompts to review": "리뷰할 프롬프트",
  "No prompts need score review.": "점수 리뷰가 필요한 프롬프트가 없습니다.",
  excellent: "우수",
  good: "좋음",
  needs_work: "보강 필요",
  weak: "약함",
  score: "점수",
  "No trend data yet.": "트렌드 데이터가 없습니다.",
  "No data.": "데이터가 없습니다.",
  "Onboarding checks": "온보딩 점검",
  Server: "서버",
  Status: "상태",
  OK: "정상",
  Checking: "확인 중",
  Version: "버전",
  "Data directory": "데이터 디렉터리",
  Address: "주소",
  Capture: "수집",
  Redaction: "마스킹",
  "Excluded projects": "수집 제외 프로젝트",
  None: "없음",
  "Last hook delivery": "마지막 hook 전송",
  "No record": "기록 없음",
  "Use the CLI doctor command for detailed diagnostics.":
    "상세 진단은 CLI doctor 명령으로 확인합니다.",
  "No project records yet.": "프로젝트 기록이 없습니다.",
  "Project policy": "프로젝트 정책",
  "Latest capture": "최근 수집",
  "Quality/sensitivity": "품질/민감도",
  Reuse: "재사용",
  "capture on": "수집 중",
  paused: "중지됨",
  "Create JSON from the local archive without raw paths or stable prompt ids.":
    "로컬 archive를 raw path와 stable prompt id 없이 JSON으로 만듭니다.",
  "Create preview": "Preview 생성",
  "Preview job": "Preview 작업",
  "Export JSON": "Export JSON",
  "Export summary": "Export 요약",
  "Stored prompts": "저장된 프롬프트",
  "Preview candidates": "Preview 대상",
  "Small-set warning": "작은 집합 경고",
  "Run export": "Export 실행",
  "Small prompt sets can still carry re-identification risk after anonymization.":
    "작은 prompt 집합은 익명화 후에도 재식별 위험이 있습니다.",
  "Included fields": "포함되는 필드",
  "Excluded fields": "제외되는 필드",
  "Residual identifier count": "잔여 identifier count",
  "No preview yet.": "아직 preview가 없습니다.",
  "Copy JSON": "JSON 복사",
  Download: "다운로드",
  "No detected items.": "검출된 항목 없음",
  "Local server": "로컬 서버",
  "Checking server status.": "서버 상태를 확인하는 중입니다.",
  "Local storage": "로컬 저장소",
  "Checking data directory.": "데이터 디렉터리를 확인하는 중입니다.",
  "Checking storage policy.": "저장 정책을 확인하는 중입니다.",
  "Hook Capture": "Hook 수집",
  "last delivery succeeded": "마지막 전송 성공",
  "last delivery failed": "마지막 전송 실패",
  "No hook delivery has been recorded yet.": "아직 hook 전송 기록이 없습니다.",
  "First prompt stored": "첫 프롬프트 저장",
  "Send a test prompt to complete this check.":
    "테스트 프롬프트를 전송하면 완료됩니다.",
  "Reuse loop": "재사용 루프",
  "No copied or saved prompts yet.":
    "복사하거나 저장한 프롬프트가 아직 없습니다.",
  "Needs attention": "확인 필요",
  Waiting: "대기",
  "Goal clarity": "목표 명확성",
  "Background context": "배경 맥락",
  "Scope limits": "범위 제한",
  "Output format": "출력 형식",
  "Verification criteria": "검증 기준",
  Search: "검색",
  Tag: "태그",
  Sensitivity: "민감도",
  "Quality gap": "부족 항목",
  "No saved prompts.": "저장된 프롬프트가 없습니다.",
  "No reused prompts.": "재사용한 프롬프트가 없습니다.",
  "No duplicate candidates.": "중복 후보가 없습니다.",
  "No prompts need quality improvements.":
    "품질 보강이 필요한 프롬프트가 없습니다.",
  "No prompts stored yet.": "아직 저장된 프롬프트가 없습니다.",
  "Save prompts for later from the detail screen.":
    "상세 화면에서 다시 볼 프롬프트를 저장하세요.",
  "Repeated stored prompt bodies will appear here.":
    "같은 저장 본문이 반복되면 여기에 표시됩니다.",
  "Try adding verification criteria, output format, and scope.":
    "검증 기준, 출력 형식, 범위를 명시해보세요.",
};
