import {
  AlertTriangle,
  Database,
  FileText,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  deletePrompt,
  getHealth,
  getPrompt,
  listPrompts,
  type PromptDetail,
  type PromptSummary,
} from "./api.js";
import { SafeMarkdown } from "./markdown.js";

type View =
  | { name: "list" }
  | { name: "detail"; id: string }
  | { name: "settings" };

export function App() {
  const [view, setView] = useState<View>({ name: "list" });
  const [query, setQuery] = useState("");
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [selected, setSelected] = useState<PromptDetail | undefined>();
  const [health, setHealth] = useState<
    { ok: boolean; version: string; data_dir: string } | undefined
  >();
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
    void refreshList(query);
  }, [query]);

  useEffect(() => {
    void getHealth()
      .then(setHealth)
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
    return "프롬프트 아카이브";
  }, [view]);

  async function refreshList(nextQuery = query): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      const result = await listPrompts(nextQuery);
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
  }

  function navigate(next: View): void {
    const path =
      next.name === "detail"
        ? `/prompts/${next.id}`
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
          className="nav-button"
          onClick={() => navigate({ name: "list" })}
        >
          <FileText size={16} /> 프롬프트
        </button>
        <button
          className="nav-button"
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
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="프롬프트 검색"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="프롬프트 검색"
                value={query}
              />
            </label>
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
        {view.name === "settings" && <SettingsView health={health} />}
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
        <span>상태</span>
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
          <span>
            <StatusBadge prompt={prompt} />
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
        <SafeMarkdown markdown={prompt.markdown} />
      </article>
    </div>
  );
}

function SettingsView({
  health,
}: {
  health?: { ok: boolean; version: string; data_dir: string };
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
          <dd>{health?.data_dir ?? "-"}</dd>
        </dl>
      </section>
      <section className="panel">
        <h2>수집</h2>
        <p className="muted">
          Claude Code hook 상태는 doctor 명령으로 확인합니다.
        </p>
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
  if (window.location.pathname === "/settings") {
    return { name: "settings" };
  }

  const match = window.location.pathname.match(/^\/prompts\/([^/]+)$/);
  if (match?.[1]) {
    return { name: "detail", id: decodeURIComponent(match[1]) };
  }

  return { name: "list" };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
