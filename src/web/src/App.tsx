import {
  AlertTriangle,
  BarChart3,
  Copy,
  Database,
  FileText,
  GitCompare,
  Search,
  Settings,
  ShieldCheck,
  Star,
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
  recordPromptCopied,
  setPromptBookmark,
  type QualityDashboard,
  type PromptFilters,
  type PromptDetail,
  type PromptQualityGap,
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
  const [filters, setFilters] = useState<PromptFilters>(() =>
    filtersFromLocation(),
  );
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
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
  const [copiedPromptId, setCopiedPromptId] = useState<string | undefined>();

  useEffect(() => {
    const handlePop = () => {
      const nextView = routeFromLocation();
      setView(nextView);
      if (nextView.name === "list") {
        setFilters(filtersFromLocation());
      }
    };
    const initialView = routeFromLocation();
    setView(initialView);
    if (initialView.name === "list") {
      setFilters(filtersFromLocation());
    }
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  useEffect(() => {
    if (view.name !== "list") {
      return;
    }

    const timer = window.setTimeout(() => {
      writeFiltersToLocation(filters);
      void refreshList(filters, { replace: true });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [filters, view.name]);

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

  async function refreshList(
    nextFilters = filters,
    options: { cursor?: string; replace?: boolean } = {},
  ): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      const result = await listPrompts(nextFilters, options.cursor);
      setPrompts((current) =>
        options.cursor && !options.replace
          ? [...current, ...result.items]
          : result.items,
      );
      setNextCursor(result.next_cursor);
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
    await refreshList(filters, { replace: true });
    void getQualityDashboard()
      .then(setDashboard)
      .catch(() => undefined);
  }

  function updateFilters(next: Partial<PromptFilters>): void {
    setFilters((current) => ({ ...current, ...next }));
  }

  async function copyPrompt(prompt: PromptDetail): Promise<void> {
    const copied = await copyTextToClipboard(prompt.markdown);
    if (copied) {
      setCopiedPromptId(prompt.id);
      window.setTimeout(() => setCopiedPromptId(undefined), 3000);
      try {
        const usefulness = await recordPromptCopied(prompt.id);
        updatePromptUsefulness(prompt.id, usefulness);
        void getQualityDashboard()
          .then(setDashboard)
          .catch(() => undefined);
      } catch {
        setError("복사는 완료됐지만 사용 기록을 저장하지 못했습니다.");
      }
      return;
    }

    setError("프롬프트를 복사하지 못했습니다.");
  }

  async function toggleBookmark(prompt: PromptDetail): Promise<void> {
    try {
      const usefulness = await setPromptBookmark(
        prompt.id,
        !prompt.usefulness.bookmarked,
      );
      updatePromptUsefulness(prompt.id, usefulness);
      void getQualityDashboard()
        .then(setDashboard)
        .catch(() => undefined);
    } catch {
      setError("북마크 상태를 저장하지 못했습니다.");
    }
  }

  function updatePromptUsefulness(
    id: string,
    usefulness: PromptDetail["usefulness"],
  ): void {
    setSelected((current) =>
      current?.id === id ? { ...current, usefulness } : current,
    );
    setPrompts((current) =>
      current.map((prompt) =>
        prompt.id === id ? { ...prompt, usefulness } : prompt,
      ),
    );
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
      <a className="skip-link" href="#workspace">
        본문으로 건너뛰기
      </a>
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

      <section className="workspace" id="workspace">
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
                  autoComplete="off"
                  name="prompt-search"
                  onChange={(event) =>
                    updateFilters({ query: event.target.value })
                  }
                  placeholder="프롬프트 검색…"
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
              <select
                aria-label="포커스 필터"
                name="focus-filter"
                onChange={(event) =>
                  updateFilters({
                    focus:
                      event.target.value === ""
                        ? undefined
                        : (event.target.value as PromptFilters["focus"]),
                  })
                }
                value={filters.focus ?? ""}
              >
                <option value="">전체 Focus</option>
                <option value="saved">저장됨</option>
                <option value="duplicated">중복 후보</option>
                <option value="quality-gap">품질 보강</option>
              </select>
              <select
                aria-label="부족 항목 필터"
                name="quality-gap-filter"
                onChange={(event) =>
                  updateFilters({
                    qualityGap:
                      event.target.value === ""
                        ? undefined
                        : (event.target.value as PromptFilters["qualityGap"]),
                  })
                }
                value={filters.qualityGap ?? ""}
              >
                <option value="">전체 부족 항목</option>
                {QUALITY_GAP_OPTIONS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="경로 접두사 필터"
                autoComplete="off"
                className="path-filter"
                name="cwd-prefix-filter"
                onChange={(event) =>
                  updateFilters({ cwdPrefix: event.target.value })
                }
                placeholder="cwd prefix…"
                value={filters.cwdPrefix ?? ""}
              />
              <input
                aria-label="시작일 필터"
                autoComplete="off"
                name="received-from-filter"
                onChange={(event) =>
                  updateFilters({ receivedFrom: event.target.value })
                }
                type="date"
                value={filters.receivedFrom ?? ""}
              />
              <input
                aria-label="종료일 필터"
                autoComplete="off"
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
            focus={filters.focus}
            qualityGap={filters.qualityGap}
            loading={loading}
            nextCursor={filters.query?.trim() ? undefined : nextCursor}
            onLoadMore={() => void refreshList(filters, { cursor: nextCursor })}
            onSelect={(id) => navigate({ name: "detail", id })}
            prompts={prompts}
          />
        )}
        {view.name === "detail" && (
          <PromptDetailView
            copied={selected?.id === copiedPromptId}
            onBookmark={toggleBookmark}
            onCopy={copyPrompt}
            onDelete={setPendingDelete}
            prompt={selected}
          />
        )}
        {view.name === "dashboard" && (
          <DashboardView
            dashboard={dashboard}
            loading={!dashboard}
            onOpenFilteredList={(nextFilters) => {
              setFilters({ isSensitive: "all", ...nextFilters });
              navigate({ name: "list" });
            }}
            onSelect={(id) => navigate({ name: "detail", id })}
          />
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
  focus,
  qualityGap,
  loading,
  nextCursor,
  onLoadMore,
  onSelect,
  prompts,
}: {
  focus?: PromptFilters["focus"];
  qualityGap?: PromptFilters["qualityGap"];
  loading: boolean;
  nextCursor?: string;
  onLoadMore(): void;
  onSelect(id: string): void;
  prompts: PromptSummary[];
}) {
  if (loading && prompts.length === 0) {
    return <div className="panel empty">목록을 불러오는 중입니다.</div>;
  }

  if (prompts.length === 0) {
    return (
      <div className="panel empty">
        <h2>{emptyPromptTitle(focus, qualityGap)}</h2>
        <code>{emptyPromptHint(focus, qualityGap)}</code>
      </div>
    );
  }

  return (
    <>
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
              {prompt.usefulness.bookmarked && (
                <span className="badge saved-badge">saved</span>
              )}
              {prompt.usefulness.copied_count > 0 && (
                <span className="badge reuse-badge">
                  copy {prompt.usefulness.copied_count}
                </span>
              )}
              {prompt.duplicate_count > 0 && (
                <span className="badge duplicate-badge">
                  dup {prompt.duplicate_count}
                </span>
              )}
            </span>
            <span>{prompt.prompt_length}</span>
          </button>
        ))}
      </div>
      {nextCursor && (
        <button
          className="load-more-button"
          disabled={loading}
          onClick={onLoadMore}
        >
          {loading ? "불러오는 중…" : "더 보기"}
        </button>
      )}
    </>
  );
}

function PromptDetailView({
  copied,
  onBookmark,
  onCopy,
  onDelete,
  prompt,
}: {
  copied: boolean;
  onBookmark(prompt: PromptDetail): void;
  onCopy(prompt: PromptDetail): void;
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
        <div className="metadata-stats" aria-label="유용성 및 중복 신호">
          <span>
            <Copy size={14} /> {prompt.usefulness.copied_count}
          </span>
          <span>
            <Star size={14} />{" "}
            {prompt.usefulness.bookmarked ? "saved" : "unsaved"}
          </span>
          <span>
            <GitCompare size={14} /> dup {prompt.duplicate_count || 0}
          </span>
        </div>
        <button className="danger full-width" onClick={() => onDelete(prompt)}>
          <Trash2 size={16} /> 삭제
        </button>
      </aside>
      <article className="prompt-body">
        {prompt.analysis && <AnalysisPreview analysis={prompt.analysis} />}
        <div className="prompt-actions">
          <button
            aria-pressed={prompt.usefulness.bookmarked}
            onClick={() => onBookmark(prompt)}
          >
            <Star size={16} />
            {prompt.usefulness.bookmarked ? "저장됨" : "다시 볼 프롬프트"}
          </button>
          <button onClick={() => onCopy(prompt)}>
            <Copy size={16} /> {copied ? "복사됨" : "프롬프트 복사"}
          </button>
        </div>
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
  onOpenFilteredList,
  onSelect,
}: {
  dashboard?: QualityDashboard;
  loading: boolean;
  onOpenFilteredList(filters: PromptFilters): void;
  onSelect(id: string): void;
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
          <h2>재사용 후보</h2>
          <div className="useful-list">
            {dashboard.useful_prompts.length === 0 && (
              <p className="muted">
                복사하거나 저장한 프롬프트가 여기에 표시됩니다.
              </p>
            )}
            {dashboard.useful_prompts.map((prompt) => (
              <button
                className="useful-row"
                key={prompt.id}
                onClick={() => onSelect(prompt.id)}
              >
                <span>
                  <strong>{projectLabel(prompt.cwd)}</strong>
                  <small>{formatDate(prompt.received_at)}</small>
                </span>
                <span className="status-cell">
                  {prompt.bookmarked && (
                    <span className="badge saved-badge">saved</span>
                  )}
                  <span className="badge reuse-badge">
                    copy {prompt.copied_count}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>중복 후보</h2>
          <div className="duplicate-list">
            {dashboard.duplicate_prompt_groups.length === 0 && (
              <p className="muted">
                같은 저장 본문을 가진 프롬프트가 없습니다.
              </p>
            )}
            {dashboard.duplicate_prompt_groups.map((group) => (
              <div className="duplicate-group" key={group.group_id}>
                <div className="duplicate-group-header">
                  <strong>{group.count} prompts</strong>
                  <span>{formatDate(group.latest_received_at)}</span>
                </div>
                <div className="duplicate-projects">
                  {group.projects.slice(0, 2).map((project) => (
                    <span key={project}>{projectLabel(project)}</span>
                  ))}
                </div>
                <div className="duplicate-prompts">
                  {group.prompts.slice(0, 3).map((prompt) => (
                    <button key={prompt.id} onClick={() => onSelect(prompt.id)}>
                      <span>{projectLabel(prompt.cwd)}</span>
                      <small>{formatDate(prompt.received_at)}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>자주 부족한 항목</h2>
          <div className="gap-list">
            {dashboard.missing_items.length === 0 && (
              <p className="muted">아직 반복적으로 부족한 항목이 없습니다.</p>
            )}
            {dashboard.missing_items.map((item) => (
              <button
                className="gap-row gap-action"
                key={item.key}
                onClick={() =>
                  onOpenFilteredList({
                    focus: "quality-gap",
                    qualityGap: item.key as PromptQualityGap,
                  })
                }
              >
                <div>
                  <strong>{item.label}</strong>
                  <p>
                    missing {item.missing} / weak {item.weak}
                  </p>
                </div>
                <span>{Math.round(item.rate * 100)}%</span>
              </button>
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

function filtersFromLocation(): PromptFilters {
  const params = new URLSearchParams(window.location.search);
  const isSensitive = params.get("sensitive");
  const focus = params.get("focus");
  const qualityGap = params.get("gap");

  return {
    query: params.get("q") ?? undefined,
    tool: params.get("tool") ?? undefined,
    tag: params.get("tag") ?? undefined,
    focus:
      focus === "saved" || focus === "duplicated" || focus === "quality-gap"
        ? focus
        : undefined,
    qualityGap: isQualityGapKey(qualityGap) ? qualityGap : undefined,
    cwdPrefix: params.get("cwd") ?? undefined,
    receivedFrom: params.get("from") ?? undefined,
    receivedTo: params.get("to") ?? undefined,
    isSensitive:
      isSensitive === "true" || isSensitive === "false" ? isSensitive : "all",
  };
}

function writeFiltersToLocation(filters: PromptFilters): void {
  const params = new URLSearchParams();
  if (filters.query?.trim()) params.set("q", filters.query.trim());
  if (filters.tool) params.set("tool", filters.tool);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.focus) params.set("focus", filters.focus);
  if (filters.qualityGap) params.set("gap", filters.qualityGap);
  if (filters.cwdPrefix?.trim()) params.set("cwd", filters.cwdPrefix.trim());
  if (filters.isSensitive && filters.isSensitive !== "all") {
    params.set("sensitive", filters.isSensitive);
  }
  if (filters.receivedFrom) params.set("from", filters.receivedFrom);
  if (filters.receivedTo) params.set("to", filters.receivedTo);

  const query = params.toString();
  const next = query ? `/?${query}` : "/";
  if (
    window.location.pathname === "/" &&
    `${window.location.pathname}${window.location.search}` !== next
  ) {
    window.history.replaceState({}, "", next);
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  const copiedWithSelection = copyTextWithSelection(text);
  if (copiedWithSelection) return true;

  if (navigator.clipboard?.writeText) {
    const copied = await Promise.race([
      navigator.clipboard.writeText(text).then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) =>
        window.setTimeout(() => resolve(false), 250),
      ),
    ]);
    if (copied) return true;
  }

  return false;
}

function copyTextWithSelection(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
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

const QUALITY_GAP_OPTIONS: Array<{ key: PromptQualityGap; label: string }> = [
  { key: "goal_clarity", label: "목표 명확성" },
  { key: "background_context", label: "배경 맥락" },
  { key: "scope_limits", label: "범위 제한" },
  { key: "output_format", label: "출력 형식" },
  { key: "verification_criteria", label: "검증 기준" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function projectLabel(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function isQualityGapKey(value: string | null): value is PromptQualityGap {
  return QUALITY_GAP_OPTIONS.some((item) => item.key === value);
}

function qualityGapLabel(key?: PromptQualityGap): string | undefined {
  return QUALITY_GAP_OPTIONS.find((item) => item.key === key)?.label;
}

function emptyPromptTitle(
  focus?: PromptFilters["focus"],
  qualityGap?: PromptQualityGap,
): string {
  const gapLabel = qualityGapLabel(qualityGap);
  if (gapLabel) return `${gapLabel} 보강 큐가 비어 있습니다.`;
  if (focus === "saved") return "저장된 프롬프트가 없습니다.";
  if (focus === "duplicated") return "중복 후보가 없습니다.";
  if (focus === "quality-gap") return "품질 보강이 필요한 프롬프트가 없습니다.";
  return "아직 저장된 프롬프트가 없습니다.";
}

function emptyPromptHint(
  focus?: PromptFilters["focus"],
  qualityGap?: PromptQualityGap,
): string {
  const gapLabel = qualityGapLabel(qualityGap);
  if (gapLabel) return `${gapLabel}이 weak/missing인 프롬프트가 없습니다.`;
  if (focus === "saved") return "상세 화면에서 다시 볼 프롬프트를 저장하세요.";
  if (focus === "duplicated")
    return "같은 저장 본문이 반복되면 여기에 표시됩니다.";
  if (focus === "quality-gap")
    return "검증 기준, 출력 형식, 범위를 명시해보세요.";
  return "prompt-memory install-hook claude-code";
}
