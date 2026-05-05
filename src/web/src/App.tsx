import {
  AlertTriangle,
  BarChart3,
  Copy,
  Database,
  Download,
  FileText,
  FolderCog,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { PromptImprovement } from "../../analysis/improve.js";
import {
  analyzeProjectInstructions,
  createExportPreview,
  deletePrompt,
  executeExportJob,
  getArchiveScoreReport,
  getCoachFeedbackSummary,
  getHealth,
  getPrompt,
  getQualityDashboard,
  getSettings,
  listProjects,
  listPrompts,
  recordPromptCopied,
  savePromptImprovementDraft,
  setPromptBookmark,
  updateProjectPolicy,
  type AnonymizedExportPayload,
  type ArchiveScoreReport,
  type CoachFeedbackSummary,
  type ExportJob,
  type ExportPreset,
  type ProjectSummary,
  type QualityDashboard,
  type PromptFilters,
  type PromptDetail,
  type PromptQualityGap,
  type PromptSummary,
  type SettingsResponse,
} from "./api.js";
import {
  detectInitialLanguage,
  localizeElement,
  persistLanguage,
  type Language,
} from "./i18n.js";
import { CoachFeedbackPanel } from "./coach-feedback-panel.js";
import { createPromptHabitCoach } from "./habit-coach.js";
import { HabitCoachPanel } from "./habit-coach-panel.js";
import {
  createArchiveMeasurement,
  type ArchiveMeasurement,
} from "./measurement.js";
import { PromptDetailView } from "./prompt-detail-view.js";
import {
  GapRateChart,
  QualityTrendChart,
  ScoreDistributionChart,
} from "./charts.js";
import { copyTextToClipboard } from "./clipboard.js";
import {
  daysAgoDateInput,
  formatDate,
  formatRulesFileCount,
  formatTrendDate,
} from "./formatters.js";
import { McpToolsView } from "./mcp-tools-view.js";
import {
  FOCUS_LABELS,
  PROMPT_TAGS,
  QUALITY_GAP_OPTIONS,
  SENSITIVITY_LABELS,
  TOOL_LABELS,
  exportFieldLabel,
  isQualityGapKey,
  qualityGapKeyFromLabel,
  qualityGapLabel,
} from "./quality-options.js";
import {
  filtersFromLocation,
  needsArchiveScoreData,
  needsDashboardData,
  routeFromLocation,
  writeFiltersToLocation,
  type View,
  type WorkspaceSection,
} from "./routing.js";

const LIVE_MEASUREMENT_REFRESH_MS = 12_000;
export function App() {
  const [language, setLanguage] = useState<Language>(() =>
    detectInitialLanguage(),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    readSidebarCollapsed(),
  );
  const [view, setView] = useState<View>({ name: "list" });
  const [filters, setFilters] = useState<PromptFilters>(() =>
    filtersFromLocation(),
  );
  const [prompts, setPrompts] = useState<PromptSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [selected, setSelected] = useState<PromptDetail | undefined>();
  const [health, setHealth] = useState<
    { ok: boolean; version: string } | undefined
  >();
  const [settings, setSettings] = useState<SettingsResponse | undefined>();
  const [dashboard, setDashboard] = useState<QualityDashboard | undefined>();
  const [coachFeedback, setCoachFeedback] = useState<
    CoachFeedbackSummary | undefined
  >();
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [archiveScore, setArchiveScore] = useState<
    ArchiveScoreReport | undefined
  >();
  const [measurementCheckedAt, setMeasurementCheckedAt] = useState<
    string | undefined
  >();
  const [measurementBusy, setMeasurementBusy] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectInstructionBusy, setProjectInstructionBusy] = useState<
    Record<string, boolean>
  >({});
  const [exportPreset, setExportPreset] =
    useState<ExportPreset>("anonymized_review");
  const [exportPreview, setExportPreview] = useState<ExportJob | undefined>();
  const [exportPayload, setExportPayload] = useState<
    AnonymizedExportPayload | undefined
  >();
  const [exportBusy, setExportBusy] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [pendingDelete, setPendingDelete] = useState<
    PromptDetail | undefined
  >();
  const [copiedPromptId, setCopiedPromptId] = useState<string | undefined>();
  const [copiedImprovementId, setCopiedImprovementId] = useState<
    string | undefined
  >();
  const [savedImprovementId, setSavedImprovementId] = useState<
    string | undefined
  >();

  useEffect(() => {
    persistLanguage(language);
  }, [language]);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".app-shell");
    if (root) {
      localizeElement(root, language);
    }
  });

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
  }, []);

  useEffect(() => {
    if (!needsDashboardData(view.name)) {
      return;
    }
    if (dashboard && dashboard.trend.daily.length === trendDays) {
      return;
    }

    void getQualityDashboard({ trendDays })
      .then(setDashboard)
      .catch(() => undefined);
  }, [dashboard, trendDays, view.name]);

  useEffect(() => {
    if (!needsArchiveScoreData(view.name) || archiveScore) {
      return;
    }

    void getArchiveScoreReport()
      .then(setArchiveScore)
      .catch(() => undefined);
  }, [archiveScore, view.name]);

  useEffect(() => {
    if (view.name !== "dashboard" || coachFeedback) {
      return;
    }

    void getCoachFeedbackSummary()
      .then(setCoachFeedback)
      .catch(() => undefined);
  }, [coachFeedback, view.name]);

  useEffect(() => {
    if (view.name !== "projects" || projects.length > 0) {
      return;
    }

    void listProjects()
      .then(setProjects)
      .catch(() => undefined);
  }, [projects.length, view.name]);

  useEffect(() => {
    if (view.name !== "detail") {
      setSelected(undefined);
      return;
    }

    void getPrompt(view.id)
      .then(setSelected)
      .catch(() => setError("Could not find the prompt."));
  }, [view]);

  const visibleTitle = useMemo(() => {
    if (view.name === "settings") return "Settings";
    if (view.name === "exports") return "Anonymized export";
    if (view.name === "mcp") return "MCP tools";
    if (view.name === "projects") return "Projects";
    if (view.name === "scores") return "Prompt scores";
    if (view.name === "coach") return "Prompt coach";
    if (view.name === "detail") return "Prompt detail";
    if (view.name === "dashboard") return "Quality dashboard";
    return "Prompt archive";
  }, [view]);
  const visibleEyebrow = useMemo(() => {
    if (view.name === "coach") {
      return "Prompt improvement workspace";
    }
    if (view.name === "mcp") {
      return "Agent-native coach tools";
    }
    if (view.name === "scores") {
      return "Prompt habit analysis";
    }
    return "Local prompt archive";
  }, [view]);
  const queueNavigation = useMemo(() => {
    if (view.name !== "detail") {
      return { current: undefined, next: undefined, previous: undefined };
    }

    const index = prompts.findIndex((prompt) => prompt.id === view.id);
    if (index === -1) {
      return { current: undefined, next: undefined, previous: undefined };
    }

    return {
      current: index + 1,
      next: prompts[index + 1],
      previous: prompts[index - 1],
      total: prompts.length,
    };
  }, [prompts, view]);

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
      setError("Could not load prompts.");
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
    void getArchiveScoreReport()
      .then(setArchiveScore)
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
        setError("Copied the prompt, but could not save the usage event.");
      }
      return;
    }

    setError("Could not copy the prompt.");
  }

  async function copyImprovedPrompt(
    prompt: PromptDetail,
    improvement: PromptImprovement,
  ): Promise<void> {
    const copied = await copyTextToClipboard(improvement.improved_prompt);
    if (copied) {
      setCopiedImprovementId(prompt.id);
      window.setTimeout(() => setCopiedImprovementId(undefined), 3000);
      return;
    }

    setError("Could not copy the improvement draft.");
  }

  async function saveImprovementDraft(
    prompt: PromptDetail,
    improvement: PromptImprovement,
  ): Promise<void> {
    try {
      const draft = await savePromptImprovementDraft(prompt.id, {
        draft_text: improvement.improved_prompt,
        analyzer: improvement.analyzer,
        changed_sections: improvement.changed_sections,
        safety_notes: improvement.safety_notes,
      });
      setSelected((current) =>
        current?.id === prompt.id
          ? {
              ...current,
              improvement_drafts: [
                draft,
                ...current.improvement_drafts.filter(
                  (item) => item.id !== draft.id,
                ),
              ],
            }
          : current,
      );
      setSavedImprovementId(prompt.id);
      window.setTimeout(() => setSavedImprovementId(undefined), 3000);
    } catch {
      setError("Could not save the improvement draft.");
    }
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
      setError("Could not save the bookmark status.");
    }
  }

  async function toggleProjectCapture(project: ProjectSummary): Promise<void> {
    try {
      const updated = await updateProjectPolicy(project.project_id, {
        capture_disabled: !project.policy.capture_disabled,
      });
      setProjects((current) =>
        current.map((item) =>
          item.project_id === updated.project_id ? updated : item,
        ),
      );
    } catch {
      setError("Could not save the project capture policy.");
    }
  }

  async function analyzeProjectRules(project: ProjectSummary): Promise<void> {
    setProjectInstructionBusy((current) => ({
      ...current,
      [project.project_id]: true,
    }));
    try {
      const review = await analyzeProjectInstructions(project.project_id);
      setProjects((current) =>
        current.map((item) =>
          item.project_id === project.project_id
            ? { ...item, instruction_review: review }
            : item,
        ),
      );
    } catch {
      setError("Could not analyze project instruction files.");
    } finally {
      setProjectInstructionBusy((current) => ({
        ...current,
        [project.project_id]: false,
      }));
    }
  }

  async function refreshArchiveScore(): Promise<void> {
    try {
      const report = await getArchiveScoreReport();
      setArchiveScore(report);
      setMeasurementCheckedAt(new Date().toISOString());
    } catch {
      setError("Could not evaluate the prompt archive.");
    }
  }

  async function measureArchive(): Promise<void> {
    setMeasurementBusy(true);
    setError(undefined);
    try {
      const [nextDashboard, nextArchiveScore] = await Promise.all([
        getQualityDashboard(),
        getArchiveScoreReport(),
      ]);
      setDashboard(nextDashboard);
      setArchiveScore(nextArchiveScore);
      setMeasurementCheckedAt(new Date().toISOString());
    } catch {
      setError("Could not measure the prompt archive.");
    } finally {
      setMeasurementBusy(false);
    }
  }

  async function previewExport(): Promise<void> {
    setExportBusy(true);
    setError(undefined);
    try {
      const preview = await createExportPreview(exportPreset);
      setExportPreview(preview);
      setExportPayload(undefined);
    } catch {
      setError("Could not create the anonymized export preview.");
    } finally {
      setExportBusy(false);
    }
  }

  async function executeExport(): Promise<void> {
    if (!exportPreview) {
      return;
    }

    setExportBusy(true);
    setError(undefined);
    try {
      const payload = await executeExportJob(exportPreview.id);
      setExportPayload(payload);
    } catch {
      setError(
        "Could not run the anonymized export. Create a new preview and try again.",
      );
    } finally {
      setExportBusy(false);
    }
  }

  async function copyExportPayload(): Promise<void> {
    if (!exportPayload) {
      return;
    }

    const copied = await copyTextToClipboard(
      JSON.stringify(exportPayload, null, 2),
    );
    if (copied) {
      setExportCopied(true);
      window.setTimeout(() => setExportCopied(false), 3000);
      return;
    }

    setError("Could not copy the export JSON.");
  }

  function downloadExportPayload(): void {
    if (!exportPayload) {
      return;
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `prompt-memory-${exportPayload.job_id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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
          : next.name === "coach"
            ? "/coach"
            : next.name === "scores"
              ? "/scores"
              : next.name === "projects"
                ? "/projects"
                : next.name === "mcp"
                  ? "/mcp"
                  : next.name === "exports"
                    ? "/exports"
                    : next.name === "settings"
                      ? "/settings"
                      : "/";
    window.history.pushState({}, "", path);
    setView(next);
  }

  const toggleSidebar = (): void => {
    setSidebarCollapsed((current) => {
      const next = !current;
      persistSidebarCollapsed(next);
      return next;
    });
  };

  return (
    <main
      className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
      key={language}
    >
      <a className="skip-link" href="#workspace">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar-header">
          <div className="brand">
            <Database size={16} />
            <span className="sidebar-label">prompt-memory</span>
          </div>
          <button
            aria-expanded={!sidebarCollapsed}
            aria-label={
              sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
            }
            className="sidebar-toggle"
            onClick={toggleSidebar}
            type="button"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </button>
        </div>
        <button
          aria-label="Prompts"
          className={`nav-button ${view.name === "list" ? "active" : ""}`}
          onClick={() => navigate({ name: "list" })}
        >
          <FileText size={16} />
          <span className="sidebar-label">Prompts</span>
        </button>
        <button
          aria-label="Dashboard"
          className={`nav-button ${view.name === "dashboard" ? "active" : ""}`}
          onClick={() => navigate({ name: "dashboard" })}
        >
          <BarChart3 size={16} />
          <span className="sidebar-label">Dashboard</span>
        </button>
        <button
          aria-label="Coach"
          className={`nav-button ${view.name === "coach" ? "active" : ""}`}
          onClick={() => navigate({ name: "coach" })}
        >
          <Target size={16} />
          <span className="sidebar-label">Coach</span>
        </button>
        <button
          aria-label="Scores"
          className={`nav-button ${view.name === "scores" ? "active" : ""}`}
          onClick={() => navigate({ name: "scores" })}
        >
          <ListChecks size={16} />
          <span className="sidebar-label">Scores</span>
        </button>
        <button
          aria-label="Projects"
          className={`nav-button ${view.name === "projects" ? "active" : ""}`}
          onClick={() => navigate({ name: "projects" })}
        >
          <FolderCog size={16} />
          <span className="sidebar-label">Projects</span>
        </button>
        <button
          aria-label="MCP"
          className={`nav-button ${view.name === "mcp" ? "active" : ""}`}
          onClick={() => navigate({ name: "mcp" })}
        >
          <Plug size={16} />
          <span className="sidebar-label">MCP</span>
        </button>
        <button
          aria-label="Export"
          className={`nav-button ${view.name === "exports" ? "active" : ""}`}
          onClick={() => navigate({ name: "exports" })}
        >
          <Download size={16} />
          <span className="sidebar-label">Export</span>
        </button>
        <button
          aria-label="Settings"
          className={`nav-button ${view.name === "settings" ? "active" : ""}`}
          onClick={() => navigate({ name: "settings" })}
        >
          <Settings size={16} />
          <span className="sidebar-label">Settings</span>
        </button>
        <div
          className="capture-status"
          aria-label={health?.ok ? "Server OK" : "Checking status"}
        >
          {health?.ok ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
          <span className="sidebar-label">
            {health?.ok ? "Server OK" : "Checking status"}
          </span>
        </div>
        <div className="language-switch" aria-label="Language">
          <button
            aria-pressed={language === "en"}
            className={language === "en" ? "active" : ""}
            onClick={() => setLanguage("en")}
            type="button"
          >
            EN
          </button>
          <button
            aria-pressed={language === "ko"}
            className={language === "ko" ? "active" : ""}
            onClick={() => setLanguage("ko")}
            type="button"
          >
            KO
          </button>
        </div>
      </aside>

      <section className="workspace" id="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{visibleEyebrow}</p>
            <h1>{visibleTitle}</h1>
          </div>
          {view.name === "list" && (
            <div className="filter-bar">
              <label className="search-box">
                <Search size={16} />
                <input
                  aria-label="Prompts Search"
                  autoComplete="off"
                  name="prompt-search"
                  onChange={(event) =>
                    updateFilters({ query: event.target.value })
                  }
                  placeholder="Prompts Search…"
                  value={filters.query ?? ""}
                />
              </label>
              <select
                aria-label="Tool filter"
                name="tool-filter"
                onChange={(event) =>
                  updateFilters({ tool: event.target.value })
                }
                value={filters.tool ?? ""}
              >
                <option value="">All tools</option>
                <option value="claude-code">Claude Code</option>
                <option value="codex">Codex</option>
                <option value="manual">Manual</option>
                <option value="unknown">Unknown</option>
              </select>
              <select
                aria-label="Tag filter"
                name="tag-filter"
                onChange={(event) => updateFilters({ tag: event.target.value })}
                value={filters.tag ?? ""}
              >
                <option value="">All tags</option>
                {PROMPT_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <select
                aria-label="Sensitivity filter"
                name="sensitivity-filter"
                onChange={(event) =>
                  updateFilters({
                    isSensitive: event.target
                      .value as PromptFilters["isSensitive"],
                  })
                }
                value={filters.isSensitive ?? "all"}
              >
                <option value="all">All sensitivity</option>
                <option value="true">Contains sensitive data</option>
                <option value="false">No sensitive data</option>
              </select>
              <select
                aria-label="Focus filter"
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
                <option value="">All focus</option>
                <option value="saved">Saved</option>
                <option value="reused">Reused</option>
                <option value="duplicated">Duplicate candidates</option>
                <option value="quality-gap">Quality gaps</option>
              </select>
              <select
                aria-label="Quality gap filter"
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
                <option value="">All quality gaps</option>
                {QUALITY_GAP_OPTIONS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="Path prefix filter"
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
                aria-label="Start date filter"
                autoComplete="off"
                name="received-from-filter"
                onChange={(event) =>
                  updateFilters({ receivedFrom: event.target.value })
                }
                type="date"
                value={filters.receivedFrom ?? ""}
              />
              <input
                aria-label="End date filter"
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
          <>
            <ActiveFilterBar
              filters={filters}
              onClearAll={() => setFilters(emptyFilters())}
              onRemove={(key) => updateFilters(clearFilterPatch(key))}
            />
            <PromptList
              focus={filters.focus}
              qualityGap={filters.qualityGap}
              loading={loading}
              nextCursor={filters.query?.trim() ? undefined : nextCursor}
              onLoadMore={() =>
                void refreshList(filters, { cursor: nextCursor })
              }
              onSelect={(id) => navigate({ name: "detail", id })}
              prompts={prompts}
            />
          </>
        )}
        {view.name === "detail" && (
          <PromptDetailView
            copied={selected?.id === copiedPromptId}
            copiedImprovement={selected?.id === copiedImprovementId}
            language={language}
            savedImprovement={selected?.id === savedImprovementId}
            onBookmark={toggleBookmark}
            onBack={() => navigate({ name: "list" })}
            onCopy={copyPrompt}
            onCopyImprovement={copyImprovedPrompt}
            onDelete={setPendingDelete}
            onOpenQualityGap={(qualityGap) => {
              setFilters({
                isSensitive: "all",
                focus: "quality-gap",
                qualityGap,
              });
              navigate({ name: "list" });
            }}
            onNavigate={(id) => navigate({ name: "detail", id })}
            onSaveImprovement={saveImprovementDraft}
            prompt={selected}
            queueNavigation={queueNavigation}
          />
        )}
        {view.name === "dashboard" && (
          <DashboardView
            archiveScore={archiveScore}
            coachFeedback={coachFeedback}
            dashboard={dashboard}
            loading={!dashboard}
            measurementBusy={measurementBusy}
            measurementCheckedAt={measurementCheckedAt}
            onOpenFilteredList={(nextFilters) => {
              setFilters({ isSensitive: "all", ...nextFilters });
              navigate({ name: "list" });
            }}
            onMeasure={() => void measureArchive()}
            onNavigateSection={(section) => navigate({ name: section })}
            trendDays={trendDays}
            onChangeTrendDays={(days) => {
              setTrendDays(days);
              setDashboard(undefined);
            }}
          />
        )}
        {view.name === "coach" && (
          <CoachView
            archiveScore={archiveScore}
            dashboard={dashboard}
            loading={!dashboard}
            onOpenFilteredList={(nextFilters) => {
              setFilters({ isSensitive: "all", ...nextFilters });
              navigate({ name: "list" });
            }}
            onSelect={(id) => navigate({ name: "detail", id })}
          />
        )}
        {view.name === "scores" && (
          <ScoresView
            archiveScore={archiveScore}
            dashboard={dashboard}
            loading={!dashboard}
            onOpenFilteredList={(nextFilters) => {
              setFilters({ isSensitive: "all", ...nextFilters });
              navigate({ name: "list" });
            }}
            onRefreshArchiveScore={() => void refreshArchiveScore()}
            onSelect={(id) => navigate({ name: "detail", id })}
            trendDays={trendDays}
            onChangeTrendDays={(days) => {
              setTrendDays(days);
              setDashboard(undefined);
            }}
          />
        )}
        {view.name === "projects" && (
          <ProjectsView
            instructionBusy={projectInstructionBusy}
            onAnalyzeInstructions={(project) =>
              void analyzeProjectRules(project)
            }
            onToggleCapture={(project) => void toggleProjectCapture(project)}
            projects={projects}
          />
        )}
        {view.name === "mcp" && (
          <McpToolsView
            dashboard={dashboard}
            health={health}
            settings={settings}
          />
        )}
        {view.name === "exports" && (
          <ExportView
            busy={exportBusy}
            copied={exportCopied}
            dashboard={dashboard}
            onCopy={() => void copyExportPayload()}
            onDownload={downloadExportPayload}
            onExecute={() => void executeExport()}
            onPresetChange={(preset) => {
              setExportPreset(preset);
              setExportPreview(undefined);
              setExportPayload(undefined);
            }}
            onPreview={() => void previewExport()}
            payload={exportPayload}
            preset={exportPreset}
            preview={exportPreview}
          />
        )}
        {view.name === "settings" && (
          <SettingsView
            dashboard={dashboard}
            health={health}
            settings={settings}
          />
        )}
      </section>

      {pendingDelete && (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <h2>Prompts Delete</h2>
            <p>
              <code>{pendingDelete.id}</code> will be deleted. Markdown and
              index rows will be deleted too.
            </p>
            <div className="modal-actions">
              <button onClick={() => setPendingDelete(undefined)}>
                Cancel
              </button>
              <button className="danger" onClick={() => void confirmDelete()}>
                Delete
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
    return <div className="panel empty">Loading prompts.</div>;
  }

  if (prompts.length === 0) {
    const commands = emptyPromptCommands(focus, qualityGap);
    return (
      <div className="panel empty">
        <h2>{emptyPromptTitle(focus, qualityGap)}</h2>
        <p>{emptyPromptHint(focus, qualityGap)}</p>
        <div className="empty-command-list" aria-label="First run commands">
          {commands.map((command) => (
            <code key={command}>{command}</code>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="prompt-table" role="table">
        <div className="table-row table-head" role="row">
          <span>Received</span>
          <span>Tool</span>
          <span>Path</span>
          <span>Tags/status</span>
          <span>Length</span>
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
            <span className="path-cell">
              <span className="truncate">{prompt.cwd}</span>
              {prompt.snippet && <small>{prompt.snippet}</small>}
            </span>
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
              <span
                className={`badge score-badge ${prompt.quality_score_band}`}
              >
                {prompt.quality_score}
              </span>
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
          {loading ? "Loading..." : "Load more"}
        </button>
      )}
    </>
  );
}

type FilterKey = keyof PromptFilters;

function ActiveFilterBar({
  filters,
  onClearAll,
  onRemove,
}: {
  filters: PromptFilters;
  onClearAll(): void;
  onRemove(key: FilterKey): void;
}) {
  const chips = activeFilterChips(filters);

  if (chips.length === 0) {
    return null;
  }

  return (
    <section className="active-filter-bar" aria-label="Active filters">
      <div className="active-filter-list">
        {chips.map((chip) => (
          <button
            aria-label={`${chip.label} remove filter: ${chip.value}`}
            className="filter-chip"
            key={chip.key}
            onClick={() => onRemove(chip.key)}
            type="button"
          >
            <span>{chip.label}</span>
            <strong>{chip.value}</strong>
          </button>
        ))}
      </div>
      <button
        className="clear-filters-button"
        onClick={onClearAll}
        type="button"
      >
        Clear filters
      </button>
    </section>
  );
}

function DashboardView({
  archiveScore,
  coachFeedback,
  dashboard,
  loading,
  measurementBusy,
  measurementCheckedAt,
  onOpenFilteredList,
  onMeasure,
  onNavigateSection,
  trendDays,
  onChangeTrendDays,
}: {
  archiveScore?: ArchiveScoreReport;
  coachFeedback?: CoachFeedbackSummary;
  dashboard?: QualityDashboard;
  loading: boolean;
  measurementBusy: boolean;
  measurementCheckedAt?: string;
  onOpenFilteredList(filters: PromptFilters): void;
  onMeasure(): void;
  onNavigateSection(section: WorkspaceSection): void;
  trendDays: 7 | 30;
  onChangeTrendDays(days: 7 | 30): void;
}) {
  if (loading || !dashboard) {
    return <div className="panel empty">Loading dashboard.</div>;
  }

  return (
    <div className="dashboard-layout dashboard-overview">
      <TrendPanel
        daily={dashboard.trend.daily}
        onSelectDay={(date) =>
          onOpenFilteredList({
            receivedFrom: date,
            receivedTo: date,
          })
        }
        trendDays={trendDays}
        onChangeTrendDays={onChangeTrendDays}
      />
      <ArchiveMeasurementPanel
        compact
        measurement={createArchiveMeasurement({
          archiveScore,
          dashboard,
          measuredAt: measurementCheckedAt,
        })}
        measurementBusy={measurementBusy}
        onMeasure={onMeasure}
        onOpenFilteredList={onOpenFilteredList}
        onOpenScores={() => onNavigateSection("scores")}
      />
      <DashboardMetricStrip
        dashboard={dashboard}
        onOpenFilteredList={onOpenFilteredList}
      />
      <CoachFeedbackPanel summary={coachFeedback} />
    </div>
  );
}

function CoachView({
  archiveScore,
  dashboard,
  loading,
  onOpenFilteredList,
  onSelect,
}: {
  archiveScore?: ArchiveScoreReport;
  dashboard?: QualityDashboard;
  loading: boolean;
  onOpenFilteredList(filters: PromptFilters): void;
  onSelect(id: string): void;
}) {
  if (loading || !dashboard) {
    return <div className="panel empty">Loading dashboard.</div>;
  }

  const habitCoach = createPromptHabitCoach(dashboard, archiveScore);

  return (
    <div className="dashboard-layout">
      <HabitCoachPanel
        coach={habitCoach}
        onOpenFilteredList={onOpenFilteredList}
        onSelect={onSelect}
      />
      <RepeatedPatternsPanel dashboard={dashboard} />
      <InstructionSuggestionsPanel dashboard={dashboard} />
    </div>
  );
}

function ScoresView({
  archiveScore,
  dashboard,
  loading,
  onOpenFilteredList,
  onRefreshArchiveScore,
  onSelect,
  trendDays,
  onChangeTrendDays,
}: {
  archiveScore?: ArchiveScoreReport;
  dashboard?: QualityDashboard;
  loading: boolean;
  onOpenFilteredList(filters: PromptFilters): void;
  onRefreshArchiveScore(): void;
  onSelect(id: string): void;
  trendDays: 7 | 30;
  onChangeTrendDays(days: 7 | 30): void;
}) {
  if (loading || !dashboard) {
    return <div className="panel empty">Loading dashboard.</div>;
  }

  return (
    <div className="dashboard-layout">
      <ArchiveScoreReviewPanel
        report={archiveScore}
        onRefresh={onRefreshArchiveScore}
        onSelect={onSelect}
      />
      <TrendPanel
        daily={dashboard.trend.daily}
        onSelectDay={(date) =>
          onOpenFilteredList({
            receivedFrom: date,
            receivedTo: date,
          })
        }
        trendDays={trendDays}
        onChangeTrendDays={onChangeTrendDays}
      />
    </div>
  );
}

function ArchiveMeasurementPanel({
  autoRefresh = false,
  compact = false,
  measurement,
  measurementBusy,
  onMeasure,
  onOpenFilteredList,
  onOpenScores,
}: {
  autoRefresh?: boolean;
  compact?: boolean;
  measurement: ArchiveMeasurement;
  measurementBusy: boolean;
  onMeasure(): void;
  onOpenFilteredList(filters: PromptFilters): void;
  onOpenScores(): void;
}) {
  return (
    <section
      aria-label="Live archive measurement"
      className={`archive-measurement ${compact ? "compact" : ""}`}
    >
      <div className="measurement-primary">
        <div className="measurement-heading">
          <span className={`measurement-status ${measurement.status.tone}`}>
            {measurement.status.label}
          </span>
          <p className="eyebrow">Live prompt benchmark</p>
          <h2>Measure your prompt habits</h2>
          <p>{measurement.status.detail}</p>
        </div>
        <div className="measurement-score-block">
          <span className={`score-value ${measurement.score.band}`}>
            {measurement.score.value}
          </span>
          <small>{`archive score / ${measurement.score.max}`}</small>
        </div>
      </div>

      <div className="measurement-grid">
        <MeasurementSignal
          label="Review backlog"
          value={measurement.reviewBacklog.label}
          detail={`${Math.round(measurement.reviewBacklog.rate * 100)}% of measured prompts`}
        />
        <MeasurementSignal
          label="Biggest gap"
          value={measurement.biggestGap?.label ?? "No repeated gap"}
          detail={
            measurement.biggestGap
              ? `${measurement.biggestGap.count} prompts / ${Math.round(
                  measurement.biggestGap.rate * 100,
                )}%`
              : "Keep capturing more samples"
          }
        />
        <MeasurementSignal
          label="Coverage"
          value={measurement.coverage.label}
          detail={measurement.coverage.detail}
        />
        <MeasurementSignal
          label="Privacy"
          value={measurement.privacy.label}
          detail={measurement.privacy.detail}
        />
      </div>

      <div className="measurement-action-bar">
        <div>
          <strong>{measurement.nextAction.label}</strong>
          <span>{measurement.nextAction.detail}</span>
          <small>
            {measurement.measuredAt
              ? `Measured ${formatDate(measurement.measuredAt)}`
              : "Not measured in this session yet"}
          </small>
          {autoRefresh && (
            <small>{`Auto-updates every ${Math.round(
              LIVE_MEASUREMENT_REFRESH_MS / 1000,
            )}s while open`}</small>
          )}
        </div>
        <div className="measurement-buttons">
          <button
            className="primary-action"
            disabled={measurementBusy}
            onClick={onMeasure}
            type="button"
          >
            <RefreshCw size={14} />{" "}
            {measurementBusy ? "Measuring..." : "Measure now"}
          </button>
          {measurement.nextAction.target === "review" && (
            <button onClick={onOpenScores} type="button">
              Open review queue
            </button>
          )}
          {measurement.nextAction.target === "gap" &&
            measurement.biggestGap && (
              <button
                onClick={() =>
                  onOpenFilteredList({
                    focus: "quality-gap",
                    qualityGap: qualityGapKeyFromLabel(
                      measurement.biggestGap?.label,
                    ),
                  })
                }
                type="button"
              >
                View gap prompts
              </button>
            )}
        </div>
      </div>
    </section>
  );
}

function MeasurementSignal({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="measurement-signal">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function DashboardMetricStrip({
  dashboard,
  onOpenFilteredList,
}: {
  dashboard: QualityDashboard;
  onOpenFilteredList(filters: PromptFilters): void;
}) {
  return (
    <section className="metric-strip" aria-label="Prompt quality metrics">
      <Metric
        label="Total prompts"
        onSelect={() => onOpenFilteredList({})}
        value={dashboard.total_prompts}
      />
      <Metric
        label="Average prompt score"
        onSelect={() =>
          onOpenFilteredList({
            focus: "quality-gap",
          })
        }
        value={dashboard.quality_score.average}
      />
      <Metric
        label="Contains sensitive data"
        onSelect={() =>
          onOpenFilteredList({
            isSensitive: "true",
          })
        }
        value={`${Math.round(dashboard.sensitive_ratio * 100)}%`}
      />
      <Metric
        label="Last 7 days"
        onSelect={() =>
          onOpenFilteredList({
            receivedFrom: daysAgoDateInput(7),
          })
        }
        value={dashboard.recent.last_7_days}
      />
      <Metric
        label="Last 30 days"
        onSelect={() =>
          onOpenFilteredList({
            receivedFrom: daysAgoDateInput(30),
          })
        }
        value={dashboard.recent.last_30_days}
      />
    </section>
  );
}

function RepeatedPatternsPanel({ dashboard }: { dashboard: QualityDashboard }) {
  return (
    <div className="panel">
      <h2>Repeated patterns</h2>
      <div className="pattern-list">
        {dashboard.patterns.length === 0 && (
          <p className="muted">
            Project patterns will appear after more samples are captured.
          </p>
        )}
        {dashboard.patterns.map((pattern) => (
          <p key={`${pattern.project}:${pattern.item_key}`}>
            {pattern.message}
          </p>
        ))}
      </div>
    </div>
  );
}

function InstructionSuggestionsPanel({
  dashboard,
}: {
  dashboard: QualityDashboard;
}) {
  return (
    <section className="panel">
      <h2>AGENTS.md / CLAUDE.md candidates</h2>
      <div className="suggestion-grid">
        {dashboard.instruction_suggestions.length === 0 && (
          <p className="muted">No recurring improvement suggestions yet.</p>
        )}
        {dashboard.instruction_suggestions.map((suggestion) => (
          <div className="suggestion-box" key={suggestion.reason}>
            <p className="muted">{suggestion.reason}</p>
            <code>{suggestion.text}</code>
            <button
              aria-label="Copy suggestion"
              className="icon-button"
              onClick={() =>
                void navigator.clipboard.writeText(suggestion.text)
              }
              title="Copy suggestion"
            >
              <Copy size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArchiveScoreReviewPanel({
  report,
  onRefresh,
  onSelect,
}: {
  report?: ArchiveScoreReport;
  onRefresh(): void;
  onSelect(id: string): void;
}) {
  const [practiceCopied, setPracticeCopied] = useState(false);
  const reviewPrompts =
    report?.low_score_prompts.filter(isReviewableScorePrompt).slice(0, 6) ?? [];
  const weakOrNeedsWorkCount = report
    ? report.distribution.weak + report.distribution.needs_work
    : 0;
  const practiceCopy = report
    ? [
        "Next prompt template",
        report.next_prompt_template,
        "",
        "Practice plan",
        ...report.practice_plan.map(
          (item) =>
            `${item.priority}. ${item.label}: ${item.prompt_rule} (${item.reason})`,
        ),
      ].join("\n")
    : "";

  async function copyPracticePlan(): Promise<void> {
    if (!practiceCopy) {
      return;
    }

    const copied = await copyTextToClipboard(practiceCopy);
    if (!copied) {
      return;
    }

    setPracticeCopied(true);
    window.setTimeout(() => setPracticeCopied(false), 2500);
  }

  return (
    <section
      className="panel archive-score-panel"
      aria-label="Archive score review"
    >
      <div className="panel-heading-row">
        <div>
          <h2>Archive score review</h2>
          {report && (
            <span>
              {report.archive_score.scored_prompts} scored
              {report.has_more ? " / more available" : ""}
            </span>
          )}
        </div>
        <button className="panel-link-button" onClick={onRefresh} type="button">
          <RefreshCw size={14} /> Evaluate archive
        </button>
      </div>
      {!report && <p className="muted">No archive score report yet.</p>}
      {report && (
        <div className="archive-score-grid">
          <div className="archive-score-summary">
            <div className="archive-score-hero">
              <span className={`score-value ${report.archive_score.band}`}>
                {report.archive_score.average}
              </span>
              <div>
                <strong>Average archive score</strong>
                <small>
                  {report.archive_score.band} / {report.archive_score.max}
                </small>
              </div>
            </div>
            <div className="archive-score-meter" aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(report.archive_score.average, 100)}%`,
                }}
              />
            </div>
            <div className="archive-summary-details">
              <span>
                <strong>{report.archive_score.scored_prompts}</strong>
                scored prompts
              </span>
              <span>
                <strong>{weakOrNeedsWorkCount}</strong>
                weak / needs work
              </span>
              <span>
                <strong>{reviewPrompts.length}</strong>
                in review queue
              </span>
              <span>
                <strong>{formatDate(report.generated_at)}</strong>
                generated
              </span>
            </div>
          </div>
          <div className="archive-distribution" aria-label="Score distribution">
            <h3>Score distribution</h3>
            <ScoreDistributionChart distribution={report.distribution} />
          </div>
          <div className="archive-gaps">
            <h3>Top quality gaps</h3>
            <GapRateChart gaps={report.top_gaps.slice(0, 5)} />
          </div>
          <div className="archive-practice-plan">
            <div className="archive-practice-heading">
              <div>
                <h3>Practice plan</h3>
                <p>Copy this into your next Claude Code or Codex request.</p>
              </div>
              <button
                aria-label="Copy practice template"
                className="icon-button"
                onClick={() => void copyPracticePlan()}
                title="Copy practice template"
                type="button"
              >
                <Copy size={15} />
              </button>
            </div>
            <pre>{report.next_prompt_template}</pre>
            <div className="archive-practice-list">
              {report.practice_plan.length === 0 && (
                <p className="muted">No repeated practice item yet.</p>
              )}
              {report.practice_plan.map((item) => (
                <div className="archive-practice-row" key={item.priority}>
                  <span>{item.priority}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.prompt_rule}</p>
                    <small>{item.reason}</small>
                  </div>
                </div>
              ))}
            </div>
            {practiceCopied && <small>Copied template</small>}
          </div>
          <div className="archive-low-scores">
            <h3>Prompts to review</h3>
            {reviewPrompts.length === 0 && (
              <p className="muted">No prompts need score review.</p>
            )}
            {reviewPrompts.map((prompt) => (
              <button
                className="archive-low-score-row"
                key={prompt.id}
                onClick={() => onSelect(prompt.id)}
                type="button"
              >
                <span>
                  <strong>{prompt.project}</strong>
                  <small>{formatDate(prompt.received_at)}</small>
                </span>
                <span className="status-cell">
                  <span
                    className={`badge score-badge ${prompt.quality_score_band}`}
                  >
                    {prompt.quality_score}
                  </span>
                  {prompt.quality_gaps.slice(0, 2).map((gap) => (
                    <span className="badge gap-badge" key={gap}>
                      {gap}
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TrendPanel({
  daily,
  onSelectDay,
  trendDays,
  onChangeTrendDays,
}: {
  daily: QualityDashboard["trend"]["daily"];
  onSelectDay(date: string): void;
  trendDays: 7 | 30;
  onChangeTrendDays(days: 7 | 30): void;
}) {
  return (
    <section className="panel trend-panel" aria-label="Recent quality trend">
      <div className="panel-heading-row">
        <h2>Recent quality trend</h2>
        <div role="group" aria-label="Trend window">
          {([7, 30] as const).map((days) => (
            <button
              aria-pressed={trendDays === days}
              className={`trend-window-toggle${trendDays === days ? " active" : ""}`}
              key={days}
              onClick={() => onChangeTrendDays(days)}
              type="button"
            >
              {days} days
            </button>
          ))}
        </div>
      </div>
      <QualityTrendChart daily={daily} />
      <div className="trend-list">
        {daily.length === 0 && <p className="muted">No trend data yet.</p>}
        {daily.map((day) => (
          <button
            aria-label={`${day.date}: view ${day.prompt_count} prompts`}
            className="trend-row"
            key={day.date}
            onClick={() => onSelectDay(day.date)}
            type="button"
          >
            <span>{formatTrendDate(day.date)}</span>
            <span className="trend-meta">
              <strong>{day.prompt_count}</strong>
              <small>{Math.round(day.quality_gap_rate * 100)}% gap</small>
              <small>{day.average_quality_score} score</small>
              {day.sensitive_count > 0 && (
                <small>{day.sensitive_count} redacted</small>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Metric({
  label,
  onSelect,
  value,
}: {
  label: string;
  onSelect?(): void;
  value: number | string;
}) {
  return (
    <button
      aria-label={`View ${label}: ${value}`}
      className="metric metric-action"
      onClick={onSelect}
      type="button"
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function SettingsView({
  dashboard,
  health,
  settings,
}: {
  dashboard?: QualityDashboard;
  health?: { ok: boolean; version: string };
  settings?: SettingsResponse;
}) {
  const setupChecks = buildSetupChecks({ dashboard, health, settings });

  return (
    <div className="settings-grid">
      <section className="panel setup-panel">
        <h2>Onboarding checks</h2>
        <div className="setup-check-list">
          {setupChecks.map((check) => (
            <div className="setup-check" key={check.label}>
              <span className={`setup-dot ${check.status}`} />
              <span>
                <strong>{check.label}</strong>
                <small>{check.detail}</small>
              </span>
              <em>{setupStatusLabel(check.status)}</em>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Server</h2>
        <dl>
          <dt>Status</dt>
          <dd>{health?.ok ? "OK" : "Checking"}</dd>
          <dt>Version</dt>
          <dd>{health?.version ?? "-"}</dd>
          <dt>Data directory</dt>
          <dd>{displayLocalPath(settings?.data_dir)}</dd>
          <dt>Address</dt>
          <dd>
            {settings ? `${settings.server.host}:${settings.server.port}` : "-"}
          </dd>
        </dl>
      </section>
      <section className="panel">
        <h2>Capture</h2>
        <dl>
          <dt>Redaction</dt>
          <dd>{settings?.redaction_mode ?? "-"}</dd>
          <dt>Excluded projects</dt>
          <dd>
            {settings?.excluded_project_roots.length ? (
              <ul className="path-list">
                {settings.excluded_project_roots.map((path) => (
                  <li key={path}>{displayLocalPath(path)}</li>
                ))}
              </ul>
            ) : (
              "None"
            )}
          </dd>
          <dt>Last hook delivery</dt>
          <dd>
            {settings?.last_ingest_status
              ? `${settings.last_ingest_status.ok ? "OK" : "failed"} ${
                  settings.last_ingest_status.status ?? ""
                }`
              : "No record"}
          </dd>
        </dl>
        <p className="muted">
          Use the CLI doctor command for detailed diagnostics.
        </p>
        <code>prompt-memory doctor claude-code</code>
      </section>
    </div>
  );
}

function ProjectsView({
  instructionBusy,
  onAnalyzeInstructions,
  onToggleCapture,
  projects,
}: {
  instructionBusy: Record<string, boolean>;
  onAnalyzeInstructions(project: ProjectSummary): void;
  onToggleCapture(project: ProjectSummary): void;
  projects: ProjectSummary[];
}) {
  if (projects.length === 0) {
    return (
      <div className="panel empty">
        <h2>No project records yet.</h2>
        <code>prompt-memory setup</code>
      </div>
    );
  }

  return (
    <section className="project-panel panel" aria-label="Project policy">
      <div className="project-table" role="table">
        <div className="project-row project-head" role="row">
          <span>Projects</span>
          <span>Latest capture</span>
          <span>Quality/sensitivity</span>
          <span>Reuse</span>
          <span>Agent rules</span>
          <span>Capture</span>
        </div>
        {projects.map((project) => (
          <div className="project-row" key={project.project_id} role="row">
            <span className="project-name-cell">
              <strong>{project.label}</strong>
              <small>
                {project.path_kind === "project_root" ? "project root" : "cwd"}{" "}
                · {project.project_id}
              </small>
            </span>
            <span>
              {project.latest_ingest ? formatDate(project.latest_ingest) : "-"}
            </span>
            <span className="status-cell">
              <span className="badge gap-badge">
                gap {Math.round(project.quality_gap_rate * 100)}%
              </span>
              {project.sensitive_count > 0 && (
                <span className="badge danger-badge">
                  sensitive {project.sensitive_count}
                </span>
              )}
            </span>
            <span className="status-cell">
              <span className="badge reuse-badge">
                copy {project.copied_count}
              </span>
              <span className="badge saved-badge">
                saved {project.bookmarked_count}
              </span>
            </span>
            <span className="project-instruction-cell">
              {project.instruction_review ? (
                <span className="instruction-review-summary">
                  <span
                    className={`badge score-badge ${project.instruction_review.score.band}`}
                  >
                    {project.instruction_review.score.value}
                  </span>
                  <small>
                    {formatRulesFileCount(
                      project.instruction_review.files_found,
                    )}
                  </small>
                  {project.instruction_review.suggestions[0] && (
                    <small>{project.instruction_review.suggestions[0]}</small>
                  )}
                </span>
              ) : (
                <span className="instruction-review-summary">
                  <small>Not analyzed yet</small>
                  <small>AGENTS.md / CLAUDE.md</small>
                </span>
              )}
              <button
                className="secondary-button compact-action"
                disabled={instructionBusy[project.project_id]}
                onClick={() => onAnalyzeInstructions(project)}
                type="button"
              >
                <RefreshCw size={14} />
                {instructionBusy[project.project_id]
                  ? "Analyzing"
                  : "Analyze rules"}
              </button>
            </span>
            <span>
              <button
                aria-pressed={project.policy.capture_disabled}
                className={`toggle-button ${
                  project.policy.capture_disabled ? "off" : "on"
                }`}
                onClick={() => onToggleCapture(project)}
                type="button"
              >
                {project.policy.capture_disabled ? "paused" : "capture on"}
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExportView({
  busy,
  copied,
  dashboard,
  onCopy,
  onDownload,
  onExecute,
  onPresetChange,
  onPreview,
  payload,
  preset,
  preview,
}: {
  busy: boolean;
  copied: boolean;
  dashboard?: QualityDashboard;
  onCopy(): void;
  onDownload(): void;
  onExecute(): void;
  onPresetChange(preset: ExportPreset): void;
  onPreview(): void;
  payload?: AnonymizedExportPayload;
  preset: ExportPreset;
  preview?: ExportJob;
}) {
  const payloadText = payload ? JSON.stringify(payload, null, 2) : "";

  return (
    <div className="export-layout">
      <section className="panel export-control-panel">
        <div>
          <h2>Anonymized export</h2>
          <p className="muted">
            Create JSON from the local archive without raw paths or stable
            prompt ids.
          </p>
        </div>
        <div className="export-controls">
          <label>
            <span>Preset</span>
            <select
              aria-label="Export preset"
              name="export-preset"
              onChange={(event) =>
                onPresetChange(event.target.value as ExportPreset)
              }
              value={preset}
            >
              <option value="personal_backup">personal backup</option>
              <option value="anonymized_review">anonymized review</option>
              <option value="issue_report_attachment">
                issue report attachment
              </option>
            </select>
          </label>
          <button
            className="primary-action"
            disabled={busy}
            onClick={onPreview}
            type="button"
          >
            Create preview
          </button>
        </div>
      </section>

      <section className="export-summary-strip" aria-label="Export summary">
        <MetricCard
          label="Stored prompts"
          value={dashboard?.total_prompts ?? 0}
        />
        <MetricCard
          label="Contains sensitive data"
          value={dashboard?.sensitive_prompts ?? 0}
        />
        <MetricCard
          label="Preview candidates"
          value={preview?.counts.prompt_count ?? "-"}
        />
        <MetricCard
          label="Small-set warning"
          value={preview?.counts.small_set_warning ? "on" : "off"}
        />
      </section>

      {preview ? (
        <section className="panel export-preview-panel">
          <div className="panel-heading-row">
            <div>
              <h2>Preview job</h2>
              <p className="muted">
                {preview.id} · expires {formatDate(preview.expires_at)}
              </p>
            </div>
            <button
              className="primary-action"
              disabled={busy || preview.status !== "previewed"}
              onClick={onExecute}
              type="button"
            >
              Run export
            </button>
          </div>
          {preview.counts.small_set_warning && (
            <p className="warning-line">
              Small prompt sets can still carry re-identification risk after
              anonymization.
            </p>
          )}
          <div className="export-field-grid">
            <FieldList
              items={preview.counts.included_fields}
              title="Included fields"
            />
            <FieldList
              items={preview.counts.excluded_fields}
              title="Excluded fields"
            />
            <FieldList
              items={Object.entries(
                preview.counts.residual_identifier_counts,
              ).map(([key, count]) => `${key}: ${count}`)}
              title="Residual identifier count"
            />
          </div>
        </section>
      ) : (
        <section className="panel empty">
          <h2>No preview yet.</h2>
          <code>prompt-memory export --anonymized --preview</code>
        </section>
      )}

      {payload && (
        <section className="panel export-result-panel">
          <div className="panel-heading-row">
            <div>
              <h2>Export JSON</h2>
              <p className="muted">
                {payload.count} prompts · {payload.redaction_version} ·{" "}
                {formatDate(payload.generated_at)}
              </p>
            </div>
            <div className="export-action-row">
              <button onClick={onCopy} type="button">
                <Copy size={14} /> {copied ? "Copied" : "Copy JSON"}
              </button>
              <button onClick={onDownload} type="button">
                <Download size={14} /> Download
              </button>
            </div>
          </div>
          <pre className="export-json-preview">{payloadText}</pre>
        </section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="metric export-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FieldList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="field-list">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{exportFieldLabel(item)}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No detected items.</p>
      )}
    </div>
  );
}

type SetupCheckStatus = "good" | "attention" | "pending";

type SetupCheck = {
  detail: string;
  label: string;
  status: SetupCheckStatus;
};

function buildSetupChecks({
  dashboard,
  health,
  settings,
}: {
  dashboard?: QualityDashboard;
  health?: { ok: boolean; version: string };
  settings?: SettingsResponse;
}): SetupCheck[] {
  const redactionMode = settings?.redaction_mode;
  const lastIngest = settings?.last_ingest_status;
  const promptCount = dashboard?.total_prompts ?? 0;
  const usefulCount = dashboard?.useful_prompts.length ?? 0;

  return [
    {
      label: "Local server",
      status: health?.ok ? "good" : "pending",
      detail: health?.ok
        ? `version ${health.version}`
        : "Checking server status.",
    },
    {
      label: "Local storage",
      status: settings?.data_dir ? "good" : "pending",
      detail: settings?.data_dir
        ? displayLocalPath(settings.data_dir)
        : "Checking data directory.",
    },
    {
      label: "Redaction",
      status:
        redactionMode && redactionMode !== "raw"
          ? "good"
          : redactionMode === "raw"
            ? "attention"
            : "pending",
      detail: redactionMode
        ? `${redactionMode} mode`
        : "Checking storage policy.",
    },
    {
      label: "Hook Capture",
      status: lastIngest?.ok ? "good" : lastIngest ? "attention" : "pending",
      detail: lastIngest
        ? `${lastIngest.ok ? "last delivery succeeded" : "last delivery failed"} ${
            lastIngest.status ?? ""
          }`.trim()
        : "No hook delivery has been recorded yet.",
    },
    {
      label: "First prompt stored",
      status: promptCount > 0 ? "good" : "pending",
      detail:
        promptCount > 0
          ? `${promptCount} stored`
          : "Send a test prompt to complete this check.",
    },
    {
      label: "Reuse loop",
      status: usefulCount > 0 ? "good" : "pending",
      detail:
        usefulCount > 0
          ? `${usefulCount} reuse candidates`
          : "No copied or saved prompts yet.",
    },
  ];
}

function setupStatusLabel(status: SetupCheckStatus): string {
  if (status === "good") return "OK";
  if (status === "attention") return "Needs attention";
  return "Waiting";
}

function StatusBadge({ prompt }: { prompt: PromptSummary }) {
  const label = prompt.is_sensitive ? "redacted" : prompt.index_status;
  return <span className="badge">{label}</span>;
}

function emptyFilters(): PromptFilters {
  return { isSensitive: "all" };
}

function clearFilterPatch(key: FilterKey): Partial<PromptFilters> {
  if (key === "isSensitive") {
    return { isSensitive: "all" };
  }

  return { [key]: undefined };
}

function activeFilterChips(
  filters: PromptFilters,
): Array<{ key: FilterKey; label: string; value: string }> {
  const chips: Array<{ key: FilterKey; label: string; value: string }> = [];

  if (filters.query?.trim()) {
    chips.push({ key: "query", label: "Search", value: filters.query.trim() });
  }

  if (filters.tool) {
    chips.push({
      key: "tool",
      label: "Tool",
      value: TOOL_LABELS[filters.tool] ?? filters.tool,
    });
  }

  if (filters.tag) {
    chips.push({ key: "tag", label: "Tag", value: filters.tag });
  }

  if (filters.isSensitive && filters.isSensitive !== "all") {
    chips.push({
      key: "isSensitive",
      label: "Sensitivity",
      value: SENSITIVITY_LABELS[filters.isSensitive],
    });
  }

  if (filters.focus) {
    chips.push({
      key: "focus",
      label: "Focus",
      value: FOCUS_LABELS[filters.focus],
    });
  }

  if (filters.qualityGap) {
    chips.push({
      key: "qualityGap",
      label: "Quality gap",
      value: qualityGapLabel(filters.qualityGap) ?? filters.qualityGap,
    });
  }

  if (filters.cwdPrefix?.trim()) {
    chips.push({
      key: "cwdPrefix",
      label: "Path",
      value: filters.cwdPrefix.trim(),
    });
  }

  if (filters.receivedFrom) {
    chips.push({
      key: "receivedFrom",
      label: "Start date",
      value: filters.receivedFrom,
    });
  }

  if (filters.receivedTo) {
    chips.push({
      key: "receivedTo",
      label: "End date",
      value: filters.receivedTo,
    });
  }

  return chips;
}

function projectLabel(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function displayLocalPath(path?: string): string {
  if (!path) {
    return "-";
  }

  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  const last = parts.at(-1);

  if (!last) {
    return "[local path]";
  }

  return `[local path]/${last}`;
}

function isReviewableScorePrompt(
  prompt: ArchiveScoreReport["low_score_prompts"][number],
): boolean {
  return (
    prompt.quality_score < 70 ||
    prompt.quality_score_band === "needs_work" ||
    prompt.quality_score_band === "weak"
  );
}

function emptyPromptTitle(
  focus?: PromptFilters["focus"],
  qualityGap?: PromptQualityGap,
): string {
  const gapLabel = qualityGapLabel(qualityGap);
  if (gapLabel) return `${gapLabel} queue is empty.`;
  if (focus === "saved") return "No saved prompts.";
  if (focus === "reused") return "No reused prompts.";
  if (focus === "duplicated") return "No duplicate candidates.";
  if (focus === "quality-gap") return "No prompts need quality improvements.";
  return "Capture your first coding prompt.";
}

function emptyPromptHint(
  focus?: PromptFilters["focus"],
  qualityGap?: PromptQualityGap,
): string {
  const gapLabel = qualityGapLabel(qualityGap);
  if (gapLabel) return `No prompts have weak or missing ${gapLabel}.`;
  if (focus === "saved")
    return "Save prompts for later from the detail screen.";
  if (focus === "reused")
    return "Prompts you copied or saved will appear here.";
  if (focus === "duplicated")
    return "Repeated stored prompt bodies will appear here.";
  if (focus === "quality-gap")
    return "Try adding verification criteria, output format, and scope.";
  return "Run coach setup, send one real Claude Code or Codex request, then check the first score and improvement suggestion.";
}

function emptyPromptCommands(
  focus?: PromptFilters["focus"],
  qualityGap?: PromptQualityGap,
): string[] {
  if (focus || qualityGap) {
    return ["Clear filters to return to the full archive."];
  }

  return [
    "prompt-memory start",
    "prompt-memory setup --profile coach",
    "prompt-memory doctor claude-code",
    "prompt-memory doctor codex",
    "prompt-memory coach",
  ];
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = "pm:sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      collapsed ? "1" : "0",
    );
  } catch {
    // Storage access can fail in private mode; the in-memory state still works.
  }
}
