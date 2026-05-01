import {
  AlertTriangle,
  BarChart3,
  Copy,
  Database,
  FileText,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  deletePrompt,
  getHealth,
  getPrompt,
  getQualityDashboard,
  getSettings,
  listPrompts,
  type QualityDashboard,
  type PromptFilters,
  type PromptDetail,
  type PromptSummary,
  type SettingsResponse,
} from "./api.js";
import { SafeMarkdown } from "./markdown.js";

type View =
  | { name: "list" }
  | { name: "detail"; id: string }
  | { name: "dashboard" }
  | { name: "settings" };

export function App() {
  const [view, setView] = useState<View>({ name: "list" });
  const [filters, setFilters] = useState<PromptFilters>({
    isSensitive: "all",
  });
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [selected, setSelected] = useState<PromptDetail | undefined>();
  const [health, setHealth] = useState<
    { ok: boolean; version: string; data_dir: string } | undefined
  >();
  const [settings, setSettings] = useState<SettingsResponse | undefined>();
  const [dashboard, setDashboard] = useState<QualityDashboard | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [pendingDelete, setPendingDelete] = useState<
    PromptDetail | undefined
  >();

  useEffect(() => {
    const handlePop = () => setView(routeFromLocation());
    setView(routeFromLocation());
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshList(filters);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    void getHealth()
      .then(setHealth)
      .catch(() => undefined);
    void getSettings()
      .then(setSettings)
      .catch(() => undefined);
    void getQualityDashboard()
      .then(setDashboard)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (view.name !== "detail") {
      setSelected(undefined);
      return;
    }

    void getPrompt(view.id)
      .then(setSelected)
      .catch(() => setError("프롬프트를 찾을 수 없습니다."));
  }, [view]);

  const visibleTitle = useMemo(() => {
    if (view.name === "settings") return "설정";
    if (view.name === "detail") return "프롬프트 상세";
    if (view.name === "dashboard") return "품질 대시보드";
    return "프롬프트 아카이브";
  }, [view]);

  async function refreshList(nextFilters = filters): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      const result = await listPrompts(nextFilters);
      setPrompts(result.items);
    } catch {
      setError("프롬프트 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete) {
      return;
    }

    await deletePrompt(pendingDelete.id);
    setPendingDelete(undefined);
    navigate({ name: "list" });
    await refreshList();
    void getQualityDashboard()
      .then(setDashboard)
      .catch(() => undefined);
  }

  function updateFilters(next: Partial<PromptFilters>): void {
    setFilters((current) => ({ ...current, ...next }));
  }

  function navigate(next: View): void {
    const path =
      next.name === "detail"
        ? `/prompts/${next.id}`
        : next.name === "dashboard"
          ? "/dashboard"
          : next.name === "settings"
            ? "/settings"
            : "/";
    window.history.pushState({}, "", path);
    setView(next);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="주요 탐색">
        <div className="brand">
          <Database size={18} />
          <span>prompt-memory</span>
        </div>
        <button
          className={`nav-button ${view.name === "list" ? "active" : ""}`}
          onClick={() => navigate({ name: "list" })}
        >
          <FileText size={16} /> 프롬프트
        </button>
        <button
          className={`nav-button ${view.name === "dashboard" ? "active" : ""}`}
          onClick={() => navigate({ name: "dashboard" })}
        >
          <BarChart3 size={16} /> 대시보드
        </button>
        <button
          className={`nav-button ${view.name === "settings" ? "active" : ""}`}
          onClick={() => navigate({ name: "settings" })}
        >
          <Settings size={16} /> 설정
        </button>
        <div className="capture-status">
          {health?.ok ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
          <span>{health?.ok ? "서버 정상" : "상태 확인 중"}</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Local prompt archive</p>
            <h1>{visibleTitle}</h1>
          </div>
          {view.name === "list" && (
            <div className="filter-bar">
              <label className="search-box">
                <Search size={16} />
                <input
                  aria-label="프롬프트 검색"
                  name="prompt-search"
                  onChange={(event) =>
                    updateFilters({ query: event.target.value })
                  }
                  placeholder="프롬프트 검색"
                  value={filters.query ?? ""}
                />
              </label>
              <select
                aria-label="도구 필터"
                name="tool-filter"
                onChange={(event) =>
                  updateFilters({ tool: event.target.value })
                }
                value={filters.tool ?? ""}
              >
                <option value="">전체 도구</option>
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
              </select>
              <select
                aria-label="태그 필터"
                name="tag-filter"
                onChange={(event) => updateFilters({ tag: event.target.value })}
                value={filters.tag ?? ""}
              >
                <option value="">전체 태그</option>
                {PROMPT_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <select
                aria-label="민감정보 필터"
                name="sensitivity-filter"
                onChange={(event) =>
                  updateFilters({
                    isSensitive: event.target
                      .value as PromptFilters["isSensitive"],
                  })
                }
                value={filters.isSensitive ?? "all"}
              >
                <option value="all">전체 민감도</option>
                <option value="true">민감정보 포함</option>
                <option value="false">민감정보 없음</option>
              </select>
              <input
                aria-label="경로 접두사 필터"
                className="path-filter"
                name="cwd-prefix-filter"
                onChange={(event) =>
                  updateFilters({ cwdPrefix: event.target.value })
                }
                placeholder="cwd prefix"
                value={filters.cwdPrefix ?? ""}
              />
              <input
                aria-label="시작일 필터"
                name="received-from-filter"
                onChange={(event) =>
                  updateFilters({ receivedFrom: event.target.value })
                }
                type="date"
                value={filters.receivedFrom ?? ""}
              />
              <input
                aria-label="종료일 필터"
                name="received-to-filter"
                onChange={(event) =>
                  updateFilters({ receivedTo: event.target.value })
                }
                type="date"
                value={filters.receivedTo ?? ""}
              />
            </div>
          )}
        </header>

        {error && <div className="error-line">{error}</div>}
        {view.name === "list" && (
          <PromptList
            loading={loading}
            onSelect={(id) => navigate({ name: "detail", id })}
            prompts={prompts}
          />
        )}
        {view.name === "detail" && (
          <PromptDetailView onDelete={setPendingDelete} prompt={selected} />
        )}
        {view.name === "dashboard" && (
          <DashboardView dashboard={dashboard} loading={!dashboard} />
        )}
        {view.name === "settings" && (
          <SettingsView health={health} settings={settings} />
        )}
      </section>

      {pendingDelete && (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <h2>프롬프트 삭제</h2>
            <p>
              <code>{pendingDelete.id}</code> 를 삭제합니다. Markdown과 색인도
              함께 정리됩니다.
            </p>
            <div className="modal-actions">
              <button onClick={() => setPendingDelete(undefined)}>취소</button>
              <button className="danger" onClick={() => void confirmDelete()}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PromptList({
  loading,
  onSelect,
  prompts,
}: {
  loading: boolean;
  onSelect(id: string): void;
  prompts: PromptSummary[];
}) {
  if (loading) {
    return <div className="panel empty">목록을 불러오는 중입니다.</div>;
  }

  if (prompts.length === 0) {
    return (
      <div className="panel empty">
        <h2>아직 저장된 프롬프트가 없습니다.</h2>
        <code>prompt-memory install-hook claude-code</code>
      </div>
    );
  }

  return (
    <div className="prompt-table" role="table">
      <div className="table-row table-head" role="row">
        <span>받은 시간</span>
        <span>도구</span>
        <span>경로</span>
        <span>태그/상태</span>
        <span>길이</span>
      </div>
      {prompts.map((prompt) => (
        <button
          className="table-row"
          key={prompt.id}
          onClick={() => onSelect(prompt.id)}
          role="row"
        >
          <span>{formatDate(prompt.received_at)}</span>
          <span>{prompt.tool}</span>
          <span className="truncate">{prompt.cwd}</span>
          <span className="status-cell">
            <StatusBadge prompt={prompt} />
            {prompt.tags.slice(0, 2).map((tag) => (
              <span className="badge tag-badge" key={tag}>
                {tag}
              </span>
            ))}
            {prompt.quality_gaps.slice(0, 1).map((gap) => (
              <span className="badge gap-badge" key={gap}>
                {gap}
              </span>
            ))}
          </span>
          <span>{prompt.prompt_length}</span>
        </button>
      ))}
    </div>
  );
}

function PromptDetailView({
  onDelete,
  prompt,
}: {
  onDelete(prompt: PromptDetail): void;
  prompt?: PromptDetail;
}) {
  if (!prompt) {
    return <div className="panel empty">상세 정보를 불러오는 중입니다.</div>;
  }

  return (
    <div className="detail-layout">
      <aside className="metadata-panel">
        <dl>
          <dt>ID</dt>
          <dd>{prompt.id}</dd>
          <dt>Tool</dt>
          <dd>{prompt.tool}</dd>
          <dt>CWD</dt>
          <dd>{prompt.cwd}</dd>
          <dt>Received</dt>
          <dd>{formatDate(prompt.received_at)}</dd>
          <dt>Redaction</dt>
          <dd>{prompt.redaction_policy}</dd>
        </dl>
        <button className="danger full-width" onClick={() => onDelete(prompt)}>
          <Trash2 size={16} /> 삭제
        </button>
      </aside>
      <article className="prompt-body">
        {prompt.analysis && <AnalysisPreview analysis={prompt.analysis} />}
        <SafeMarkdown markdown={prompt.markdown} />
      </article>
    </div>
  );
}

function AnalysisPreview({
  analysis,
}: {
  analysis: NonNullable<PromptDetail["analysis"]>;
}) {
  return (
    <section className="analysis-panel" aria-label="분석 preview">
      <div className="analysis-header">
        <div>
          <p className="eyebrow">Local analysis</p>
          <h2>분석 preview</h2>
        </div>
        <span className="badge">{analysis.analyzer}</span>
      </div>
      <p className="analysis-summary">{analysis.summary}</p>
      {analysis.checklist.length > 0 && (
        <div className="checklist-grid" aria-label="분석 체크리스트">
          {analysis.checklist.map((item) => (
            <div className="checklist-item" key={item.key}>
              <div className="checklist-title">
                <span className={`quality-dot ${item.status}`} />
                <strong>{item.label}</strong>
                <span className="quality-status">{item.status}</span>
              </div>
              <p>{item.reason}</p>
              {item.suggestion && <code>{item.suggestion}</code>}
            </div>
          ))}
        </div>
      )}
      {analysis.tags.length > 0 && (
        <div className="tag-row" aria-label="자동 태그">
          <Tags size={14} />
          {analysis.tags.map((tag) => (
            <span className="badge tag-badge" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      {analysis.warnings.length > 0 && (
        <div className="analysis-list">
          <h3>주의할 점</h3>
          <ul>
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {analysis.suggestions.length > 0 && (
        <div className="analysis-list">
          <h3>개선 힌트</h3>
          <ul>
            {analysis.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DashboardView({
  dashboard,
  loading,
}: {
  dashboard?: QualityDashboard;
  loading: boolean;
}) {
  if (loading || !dashboard) {
    return <div className="panel empty">대시보드를 불러오는 중입니다.</div>;
  }

  return (
    <div className="dashboard-layout">
      <section className="metric-strip" aria-label="프롬프트 품질 지표">
        <Metric label="전체 프롬프트" value={dashboard.total_prompts} />
        <Metric
          label="민감정보 포함"
          value={`${Math.round(dashboard.sensitive_ratio * 100)}%`}
        />
        <Metric label="최근 7일" value={dashboard.recent.last_7_days} />
        <Metric label="최근 30일" value={dashboard.recent.last_30_days} />
      </section>

      <section className="dashboard-grid">
        <DistributionPanel
          buckets={dashboard.distribution.by_tool}
          title="도구별 분포"
        />
        <DistributionPanel
          buckets={dashboard.distribution.by_project}
          title="프로젝트별 분포"
        />
      </section>

      <section className="dashboard-grid wide">
        <div className="panel">
          <h2>자주 부족한 항목</h2>
          <div className="gap-list">
            {dashboard.missing_items.length === 0 && (
              <p className="muted">아직 반복적으로 부족한 항목이 없습니다.</p>
            )}
            {dashboard.missing_items.map((item) => (
              <div className="gap-row" key={item.key}>
                <div>
                  <strong>{item.label}</strong>
                  <p>
                    missing {item.missing} / weak {item.weak}
                  </p>
                </div>
                <span>{Math.round(item.rate * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>반복 패턴</h2>
          <div className="pattern-list">
            {dashboard.patterns.length === 0 && (
              <p className="muted">
                표본이 더 쌓이면 프로젝트별 패턴이 표시됩니다.
              </p>
            )}
            {dashboard.patterns.map((pattern) => (
              <p key={`${pattern.project}:${pattern.item_key}`}>
                {pattern.message}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>AGENTS.md / CLAUDE.md 후보</h2>
        <div className="suggestion-grid">
          {dashboard.instruction_suggestions.length === 0 && (
            <p className="muted">아직 제안할 반복 개선 포인트가 없습니다.</p>
          )}
          {dashboard.instruction_suggestions.map((suggestion) => (
            <div className="suggestion-box" key={suggestion.reason}>
              <p className="muted">{suggestion.reason}</p>
              <code>{suggestion.text}</code>
              <button
                aria-label="제안 복사"
                className="icon-button"
                onClick={() =>
                  void navigator.clipboard.writeText(suggestion.text)
                }
                title="제안 복사"
              >
                <Copy size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DistributionPanel({
  buckets,
  title,
}: {
  buckets: QualityDashboard["distribution"]["by_tool"];
  title: string;
}) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="distribution-list">
        {buckets.length === 0 && <p className="muted">데이터가 없습니다.</p>}
        {buckets.map((bucket) => (
          <div className="distribution-row" key={bucket.key}>
            <div>
              <strong>{bucket.label}</strong>
              <span>{bucket.count}</span>
            </div>
            <div className="bar-track">
              <span style={{ width: `${Math.max(bucket.ratio * 100, 4)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView({
  health,
  settings,
}: {
  health?: { ok: boolean; version: string; data_dir: string };
  settings?: SettingsResponse;
}) {
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2>서버</h2>
        <dl>
          <dt>상태</dt>
          <dd>{health?.ok ? "정상" : "확인 중"}</dd>
          <dt>버전</dt>
          <dd>{health?.version ?? "-"}</dd>
          <dt>데이터 디렉터리</dt>
          <dd>{settings?.data_dir ?? health?.data_dir ?? "-"}</dd>
          <dt>주소</dt>
          <dd>
            {settings ? `${settings.server.host}:${settings.server.port}` : "-"}
          </dd>
        </dl>
      </section>
      <section className="panel">
        <h2>수집</h2>
        <dl>
          <dt>Redaction</dt>
          <dd>{settings?.redaction_mode ?? "-"}</dd>
          <dt>마지막 hook 전송</dt>
          <dd>
            {settings?.last_ingest_status
              ? `${settings.last_ingest_status.ok ? "정상" : "실패"} ${
                  settings.last_ingest_status.status ?? ""
                }`
              : "기록 없음"}
          </dd>
        </dl>
        <p className="muted">상세 진단은 CLI doctor 명령으로 확인합니다.</p>
        <code>prompt-memory doctor claude-code</code>
      </section>
    </div>
  );
}

function StatusBadge({ prompt }: { prompt: PromptSummary }) {
  const label = prompt.is_sensitive ? "redacted" : prompt.index_status;
  return <span className="badge">{label}</span>;
}

function routeFromLocation(): View {
  if (window.location.pathname === "/dashboard") {
    return { name: "dashboard" };
  }

  if (window.location.pathname === "/settings") {
    return { name: "settings" };
  }

  const match = window.location.pathname.match(/^\/prompts\/([^/]+)$/);
  if (match?.[1]) {
    return { name: "detail", id: decodeURIComponent(match[1]) };
  }

  return { name: "list" };
}

const PROMPT_TAGS = [
  "bugfix",
  "refactor",
  "docs",
  "test",
  "ui",
  "backend",
  "security",
  "db",
  "release",
  "ops",
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
