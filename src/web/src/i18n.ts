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
  if (/^View .+: .+$/.test(value)) {
    return value.replace(/^View (.+): (.+)$/, "$1 보기: $2");
  }
  if (/^(.+): view (\d+) for (.+)$/.test(value)) {
    return value.replace(/^(.+): view (\d+) for (.+)$/, "$1: $3 $2개 보기");
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
  if (/^\d+ reuse candidates$/.test(value)) {
    return value.replace(/^(\d+) reuse candidates$/, "재사용 후보 $1개");
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

const UI_TRANSLATIONS: Record<string, string> = {
  "Skip to content": "본문으로 건너뛰기",
  "Primary navigation": "주요 탐색",
  Prompts: "프롬프트",
  Dashboard: "대시보드",
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
  redacted: "마스킹됨",
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
  "Prompt coach": "프롬프트 코치",
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
  "Prompt quality metrics": "프롬프트 품질 지표",
  "Total prompts": "전체 프롬프트",
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
  "Project quality profile": "프로젝트 품질 프로필",
  "No project quality signals yet.": "프로젝트별 품질 신호가 아직 없습니다.",
  "View all": "전체 보기",
  Sensitive: "민감정보",
  "Recent quality trend": "최근 품질 트렌드",
  "7 days": "7일",
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
