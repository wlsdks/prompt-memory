import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  CircleAlert,
  CircleX,
  Copy,
  Database,
  Download,
  FileText,
  FolderCog,
  Gauge,
  GitCompare,
  ListChecks,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Tags,
  Target,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { analyzePrompt } from "../../analysis/analyze.js";
import {
  improvePrompt,
  type PromptImprovement,
} from "../../analysis/improve.js";
import {
  analyzeProjectInstructions,
  createExportPreview,
  deletePrompt,
  executeExportJob,
  getArchiveScoreReport,
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
  type ExportJob,
  type ExportPreset,
  type ProjectSummary,
  type QualityDashboard,
  type PromptFilters,
  type PromptDetail,
  type PromptQualityGap,
  type PromptQualityScoreBand,
  type PromptSummary,
  type SettingsResponse,
} from "./api.js";
import {
  detectInitialLanguage,
  localizeElement,
  persistLanguage,
  type Language,
} from "./i18n.js";
import {
  createHabitNextRequestBrief,
  createHabitNextRequestBriefPreview,
  createPromptHabitCoach,
  type PromptHabitCoach,
} from "./habit-coach.js";
import { SafeMarkdown } from "./markdown.js";
import {
  createArchiveMeasurement,
  type ArchiveMeasurement,
} from "./measurement.js";
import {
  appendPracticeQuickFix,
  applyPracticeQuickFixes,
  createPracticeQuickFixes,
  type PracticeQuickFix,
} from "./practice-builder.js";
import {
  DistributionBarChart,
  GapRateChart,
  PracticeHistoryChart,
  QualityTrendChart,
  ScoreDistributionChart,
} from "./charts.js";
import {
  appendPracticeHistory,
  createPracticeHistoryItem,
  formatPracticeCopyCount,
  formatPracticeDelta,
  formatPracticeOutcome,
  markPracticeOutcome,
  readBrowserPracticeHistory,
  summarizePracticeHistory,
  writeBrowserPracticeHistory,
  type PracticeOutcome,
  type PracticeHistoryItem,
} from "./practice-history.js";
import { copyTextToClipboard } from "./clipboard.js";
import {
  daysAgoDateInput,
  formatDate,
  formatRulesFileCount,
  formatSignedNumber,
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
const DEFAULT_PRACTICE_DRAFT = [
  "Goal:",
  "Context:",
  "Scope:",
  "Verification:",
  "Output:",
].join("\n");

export function App() {
  const [language, setLanguage] = useState<Language>(() =>
    detectInitialLanguage(),
  );
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
    if (!needsDashboardData(view.name) || dashboard) {
      return;
    }

    void getQualityDashboard()
      .then(setDashboard)
      .catch(() => undefined);
  }, [dashboard, view.name]);

  useEffect(() => {
    if (!needsArchiveScoreData(view.name) || archiveScore) {
      return;
    }

    void getArchiveScoreReport()
      .then(setArchiveScore)
      .catch(() => undefined);
  }, [archiveScore, view.name]);

  useEffect(() => {
    if (view.name !== "projects" || projects.length > 0) {
      return;
    }

    void listProjects()
      .then(setProjects)
      .catch(() => undefined);
  }, [projects.length, view.name]);

  useEffect(() => {
    if (view.name !== "benchmark") {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(() => {
      void Promise.all([getQualityDashboard(), getArchiveScoreReport()])
        .then(([nextDashboard, nextArchiveScore]) => {
          if (cancelled) {
            return;
          }

          setDashboard(nextDashboard);
          setArchiveScore(nextArchiveScore);
          setMeasurementCheckedAt(new Date().toISOString());
        })
        .catch(() => undefined);
    }, LIVE_MEASUREMENT_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [view.name]);

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
    if (view.name === "insights") return "Prompt insights";
    if (view.name === "benchmark") return "Prompt benchmark";
    if (view.name === "scores") return "Prompt scores";
    if (view.name === "practice") return "Prompt practice";
    if (view.name === "coach") return "Prompt coach";
    if (view.name === "detail") return "Prompt detail";
    if (view.name === "dashboard") return "Quality dashboard";
    return "Prompt archive";
  }, [view]);
  const visibleEyebrow = useMemo(() => {
    if (view.name === "coach" || view.name === "practice") {
      return "Prompt improvement workspace";
    }
    if (view.name === "mcp") {
      return "Agent-native coach tools";
    }
    if (view.name === "scores" || view.name === "insights") {
      return "Prompt habit analysis";
    }
    if (view.name === "benchmark") {
      return "Prompt quality benchmark";
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

  async function copyImprovedPrompt(prompt: PromptDetail): Promise<void> {
    const improvement = improvePrompt({
      prompt: prompt.markdown,
      createdAt: prompt.received_at,
      language,
    });
    const copied = await copyTextToClipboard(improvement.improved_prompt);
    if (copied) {
      setCopiedImprovementId(prompt.id);
      window.setTimeout(() => setCopiedImprovementId(undefined), 3000);
      return;
    }

    setError("Could not copy the improvement draft.");
  }

  async function saveImprovementDraft(prompt: PromptDetail): Promise<void> {
    const improvement = improvePrompt({
      prompt: prompt.markdown,
      createdAt: prompt.received_at,
      language,
    });

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
            : next.name === "practice"
              ? "/practice"
              : next.name === "scores"
                ? "/scores"
                : next.name === "benchmark"
                  ? "/benchmark"
                  : next.name === "insights"
                    ? "/insights"
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

  return (
    <main className="app-shell" key={language}>
      <a className="skip-link" href="#workspace">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <Database size={18} />
          <span>prompt-memory</span>
        </div>
        <button
          className={`nav-button ${view.name === "list" ? "active" : ""}`}
          onClick={() => navigate({ name: "list" })}
        >
          <FileText size={16} /> Prompts
        </button>
        <button
          className={`nav-button ${view.name === "dashboard" ? "active" : ""}`}
          onClick={() => navigate({ name: "dashboard" })}
        >
          <BarChart3 size={16} /> Dashboard
        </button>
        <button
          className={`nav-button ${view.name === "coach" ? "active" : ""}`}
          onClick={() => navigate({ name: "coach" })}
        >
          <Target size={16} /> Coach
        </button>
        <button
          className={`nav-button ${view.name === "practice" ? "active" : ""}`}
          onClick={() => navigate({ name: "practice" })}
        >
          <ClipboardCheck size={16} /> Practice
        </button>
        <button
          className={`nav-button ${view.name === "scores" ? "active" : ""}`}
          onClick={() => navigate({ name: "scores" })}
        >
          <ListChecks size={16} /> Scores
        </button>
        <button
          className={`nav-button ${view.name === "benchmark" ? "active" : ""}`}
          onClick={() => navigate({ name: "benchmark" })}
        >
          <Gauge size={16} /> Benchmark
        </button>
        <button
          className={`nav-button ${view.name === "insights" ? "active" : ""}`}
          onClick={() => navigate({ name: "insights" })}
        >
          <GitCompare size={16} /> Insights
        </button>
        <button
          className={`nav-button ${view.name === "projects" ? "active" : ""}`}
          onClick={() => navigate({ name: "projects" })}
        >
          <FolderCog size={16} /> Projects
        </button>
        <button
          className={`nav-button ${view.name === "mcp" ? "active" : ""}`}
          onClick={() => navigate({ name: "mcp" })}
        >
          <Plug size={16} /> MCP
        </button>
        <button
          className={`nav-button ${view.name === "exports" ? "active" : ""}`}
          onClick={() => navigate({ name: "exports" })}
        >
          <Download size={16} /> Export
        </button>
        <button
          className={`nav-button ${view.name === "settings" ? "active" : ""}`}
          onClick={() => navigate({ name: "settings" })}
        >
          <Settings size={16} /> Settings
        </button>
        <div className="capture-status">
          {health?.ok ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
          <span>{health?.ok ? "Server OK" : "Checking status"}</span>
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
        {view.name === "practice" && (
          <PracticeView
            archiveScore={archiveScore}
            onMeasure={() => void refreshArchiveScore()}
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
          />
        )}
        {view.name === "benchmark" && (
          <BenchmarkView
            archiveScore={archiveScore}
            dashboard={dashboard}
            loading={!dashboard}
            measurementBusy={measurementBusy}
            measurementCheckedAt={measurementCheckedAt}
            onMeasure={() => void measureArchive()}
            onNavigateScores={() => navigate({ name: "scores" })}
            onOpenFilteredList={(nextFilters) => {
              setFilters({ isSensitive: "all", ...nextFilters });
              navigate({ name: "list" });
            }}
          />
        )}
        {view.name === "insights" && (
          <InsightsView
            dashboard={dashboard}
            loading={!dashboard}
            onOpenFilteredList={(nextFilters) => {
              setFilters({ isSensitive: "all", ...nextFilters });
              navigate({ name: "list" });
            }}
            onSelect={(id) => navigate({ name: "detail", id })}
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

function PromptDetailView({
  copied,
  copiedImprovement,
  language,
  savedImprovement,
  onBack,
  onBookmark,
  onCopy,
  onCopyImprovement,
  onDelete,
  onNavigate,
  onOpenQualityGap,
  onSaveImprovement,
  prompt,
  queueNavigation,
}: {
  copied: boolean;
  copiedImprovement: boolean;
  language: Language;
  savedImprovement: boolean;
  onBack(): void;
  onBookmark(prompt: PromptDetail): void;
  onCopy(prompt: PromptDetail): void;
  onCopyImprovement(prompt: PromptDetail): void;
  onDelete(prompt: PromptDetail): void;
  onNavigate(id: string): void;
  onOpenQualityGap(gap: PromptQualityGap): void;
  onSaveImprovement(prompt: PromptDetail): void;
  prompt?: PromptDetail;
  queueNavigation: {
    current?: number;
    next?: PromptSummary;
    previous?: PromptSummary;
    total?: number;
  };
}) {
  if (!prompt) {
    return <div className="panel empty">Loading prompt details.</div>;
  }

  const improvement = improvePrompt({
    prompt: prompt.markdown,
    createdAt: prompt.received_at,
    language,
  });

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
        <div
          className="metadata-stats"
          aria-label="Usefulness and duplicate signals"
        >
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
          <Trash2 size={16} /> Delete
        </button>
      </aside>
      <article className="prompt-body">
        {prompt.analysis && (
          <AnalysisPreview
            analysis={prompt.analysis}
            onOpenQualityGap={onOpenQualityGap}
          />
        )}
        <PromptCoachPanel
          copied={copiedImprovement}
          improvement={improvement}
          onCopy={() => onCopyImprovement(prompt)}
          onSave={() => onSaveImprovement(prompt)}
          saved={savedImprovement}
          savedDrafts={prompt.improvement_drafts}
        />
        <div className="prompt-actions">
          <button className="secondary-action" onClick={onBack}>
            <ArrowLeft size={16} /> Back to list
          </button>
          <div className="queue-actions" aria-label="Current queue navigation">
            <button
              aria-label="View previous prompt"
              disabled={!queueNavigation.previous}
              onClick={() =>
                queueNavigation.previous &&
                onNavigate(queueNavigation.previous.id)
              }
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span>
              {queueNavigation.current && queueNavigation.total
                ? `${queueNavigation.current} / ${queueNavigation.total}`
                : "No queue"}
            </span>
            <button
              aria-label="View next prompt"
              disabled={!queueNavigation.next}
              onClick={() =>
                queueNavigation.next && onNavigate(queueNavigation.next.id)
              }
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
          <div className="prompt-action-group">
            <button
              aria-pressed={prompt.usefulness.bookmarked}
              onClick={() => onBookmark(prompt)}
            >
              <Star size={16} />
              {prompt.usefulness.bookmarked ? "Saved" : "Save for later"}
            </button>
            <button onClick={() => onCopy(prompt)}>
              <Copy size={16} /> {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
        </div>
        <SafeMarkdown markdown={prompt.markdown} />
      </article>
    </div>
  );
}

function PromptCoachPanel({
  copied,
  improvement,
  onCopy,
  onSave,
  saved,
  savedDrafts,
}: {
  copied: boolean;
  improvement: PromptImprovement;
  onCopy(): void;
  onSave(): void;
  saved: boolean;
  savedDrafts: PromptDetail["improvement_drafts"];
}) {
  return (
    <section className="coach-panel" aria-label="Prompt improvement draft">
      <div className="analysis-header">
        <div>
          <p className="eyebrow">Prompt coach</p>
          <h2>Improvement draft for manual resubmission</h2>
        </div>
        <span className="badge">{improvement.mode}</span>
      </div>
      <p className="analysis-summary">{improvement.summary}</p>
      <pre className="improved-prompt-preview">
        {improvement.improved_prompt}
      </pre>
      <div className="coach-footer">
        <div className="coach-notes">
          {improvement.safety_notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
        <button className="coach-copy-button" onClick={onCopy} type="button">
          <Copy size={16} /> {copied ? "Copied" : "Copy draft"}
        </button>
        <button className="coach-save-button" onClick={onSave} type="button">
          <FileText size={16} /> {saved ? "Saved" : "Save draft"}
        </button>
      </div>
      {savedDrafts.length > 0 && (
        <div className="saved-drafts" aria-label="Saved drafts">
          <h3>Saved drafts</h3>
          {savedDrafts.slice(0, 3).map((draft) => (
            <article className="saved-draft-row" key={draft.id}>
              <div>
                <strong>{formatDate(draft.created_at)}</strong>
                <span>{draft.analyzer}</span>
              </div>
              <p>
                {draft.changed_sections.length > 0
                  ? draft.changed_sections
                      .map((section) => qualityGapLabel(section) ?? section)
                      .join(", ")
                  : "Original structure cleanup"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AnalysisPreview({
  analysis,
  onOpenQualityGap,
}: {
  analysis: NonNullable<PromptDetail["analysis"]>;
  onOpenQualityGap(gap: PromptQualityGap): void;
}) {
  return (
    <section className="analysis-panel" aria-label="Analysis preview">
      <div className="analysis-header">
        <div>
          <p className="eyebrow">Local analysis</p>
          <h2>Analysis preview</h2>
        </div>
        <div className="analysis-score-box">
          <span className={`score-value ${analysis.quality_score.band}`}>
            {analysis.quality_score.value}
          </span>
          <small>Prompt score</small>
          <span className="badge">{analysis.analyzer}</span>
        </div>
      </div>
      <p className="analysis-summary">{analysis.summary}</p>
      {analysis.checklist.length > 0 && (
        <div className="checklist-grid" aria-label="Analysis checklist">
          {analysis.checklist.map((item) => {
            const qualityGap = isQualityGapKey(item.key) ? item.key : undefined;

            return (
              <div className="checklist-item" key={item.key}>
                <div className="checklist-title">
                  <span className={`quality-dot ${item.status}`} />
                  <strong>{item.label}</strong>
                  <span className="quality-status">{item.status}</span>
                </div>
                <p>{item.reason}</p>
                {item.suggestion && <code>{item.suggestion}</code>}
                {item.status !== "good" && qualityGap && (
                  <button
                    className="checklist-action"
                    onClick={() => onOpenQualityGap(qualityGap)}
                    type="button"
                  >
                    View matching prompts
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {analysis.tags.length > 0 && (
        <div className="tag-row" aria-label="Automatic tags">
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
          <h3>Warnings</h3>
          <ul>
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {analysis.suggestions.length > 0 && (
        <div className="analysis-list">
          <h3>Improvement hints</h3>
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
  archiveScore,
  dashboard,
  loading,
  measurementBusy,
  measurementCheckedAt,
  onOpenFilteredList,
  onMeasure,
  onNavigateSection,
}: {
  archiveScore?: ArchiveScoreReport;
  dashboard?: QualityDashboard;
  loading: boolean;
  measurementBusy: boolean;
  measurementCheckedAt?: string;
  onOpenFilteredList(filters: PromptFilters): void;
  onMeasure(): void;
  onNavigateSection(section: WorkspaceSection): void;
}) {
  if (loading || !dashboard) {
    return <div className="panel empty">Loading dashboard.</div>;
  }

  const habitCoach = createPromptHabitCoach(dashboard, archiveScore);
  const reviewCount =
    archiveScore?.low_score_prompts.filter(isReviewableScorePrompt).length ?? 0;
  const insightSignalCount =
    dashboard.patterns.length +
    dashboard.duplicate_prompt_groups.length +
    dashboard.useful_prompts.length;

  return (
    <div className="dashboard-layout dashboard-overview">
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
      <section className="overview-section-grid" aria-label="Workspace areas">
        <OverviewSectionCard
          detail={
            habitCoach.biggestWeakness
              ? `${habitCoach.biggestWeakness.label} · ${habitCoach.reviewQueue.length} review`
              : "No repeated weakness yet"
          }
          icon={<Target size={18} />}
          label="Coach"
          metric={habitCoach.score.value}
          metricLabel="habit score"
          onSelect={() => onNavigateSection("coach")}
          title="Improve the next prompt"
        />
        <OverviewSectionCard
          detail={
            archiveScore
              ? "Practice habits ready"
              : "Score archive to personalize"
          }
          icon={<ClipboardCheck size={18} />}
          label="Practice"
          metric={archiveScore?.practice_plan.length ?? "-"}
          metricLabel="habits"
          onSelect={() => onNavigateSection("practice")}
          title="Draft with live score"
        />
        <OverviewSectionCard
          detail={`${reviewCount} prompts need review`}
          icon={<ListChecks size={18} />}
          label="Scores"
          metric={archiveScore?.archive_score.average ?? "-"}
          metricLabel="archive score"
          onSelect={() => onNavigateSection("scores")}
          title="Review archive quality"
        />
        <OverviewSectionCard
          detail={`${dashboard.project_profiles.length} projects · ${dashboard.duplicate_prompt_groups.length} duplicate groups`}
          icon={<GitCompare size={18} />}
          label="Insights"
          metric={insightSignalCount}
          metricLabel="signals"
          onSelect={() => onNavigateSection("insights")}
          title="Find reuse and project patterns"
        />
      </section>
      <TrendPanel
        daily={dashboard.trend.daily}
        onSelectDay={(date) =>
          onOpenFilteredList({
            receivedFrom: date,
            receivedTo: date,
          })
        }
      />
    </div>
  );
}

function BenchmarkView({
  archiveScore,
  dashboard,
  loading,
  measurementBusy,
  measurementCheckedAt,
  onMeasure,
  onNavigateScores,
  onOpenFilteredList,
}: {
  archiveScore?: ArchiveScoreReport;
  dashboard?: QualityDashboard;
  loading: boolean;
  measurementBusy: boolean;
  measurementCheckedAt?: string;
  onMeasure(): void;
  onNavigateScores(): void;
  onOpenFilteredList(filters: PromptFilters): void;
}) {
  if (loading || !dashboard) {
    return <div className="panel empty">Loading dashboard.</div>;
  }

  const measurement = createArchiveMeasurement({
    archiveScore,
    dashboard,
    measuredAt: measurementCheckedAt,
  });

  return (
    <div className="dashboard-layout benchmark-layout">
      <ArchiveMeasurementPanel
        autoRefresh
        measurement={measurement}
        measurementBusy={measurementBusy}
        onMeasure={onMeasure}
        onOpenFilteredList={onOpenFilteredList}
        onOpenScores={onNavigateScores}
      />
      <section className="panel measurement-explainer">
        <div>
          <h2>What this measures</h2>
          <p>
            This is your live archive measurement: it scores recent Claude Code
            and Codex prompts stored locally, finds repeated gaps, and points to
            the next review action.
          </p>
        </div>
        <div>
          <h2>Benchmark v1</h2>
          <p>
            <span>The development benchmark still lives in the CLI as</span>
            <code>pnpm benchmark -- --json</code>
            <span>
              It is a regression gate, not a replacement for measuring your real
              prompt archive here.
            </span>
          </p>
        </div>
      </section>
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
      <section className="dashboard-grid wide">
        <QualityGapsPanel
          dashboard={dashboard}
          onOpenFilteredList={onOpenFilteredList}
        />
        <RepeatedPatternsPanel dashboard={dashboard} />
      </section>
      <InstructionSuggestionsPanel dashboard={dashboard} />
    </div>
  );
}

function PracticeView({
  archiveScore,
  onMeasure,
}: {
  archiveScore?: ArchiveScoreReport;
  onMeasure(): void;
}) {
  const archiveTemplate =
    archiveScore?.next_prompt_template ?? DEFAULT_PRACTICE_DRAFT;
  const [draft, setDraft] = useState(archiveTemplate);
  const [draftCopied, setDraftCopied] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState<PracticeHistoryItem[]>(
    () => readBrowserPracticeHistory(),
  );

  useEffect(() => {
    if (!draft.trim() || draft === DEFAULT_PRACTICE_DRAFT) {
      setDraft(archiveTemplate);
    }
  }, [archiveTemplate, draft]);

  const analysis = useMemo(
    () =>
      analyzePrompt({
        prompt: draft,
        createdAt: new Date().toISOString(),
      }),
    [draft],
  );
  const score = analysis.quality_score;
  const missingItems = analysis.checklist.filter(
    (item) => item.status !== "good",
  );
  const quickFixes = useMemo(
    () => createPracticeQuickFixes(analysis),
    [analysis],
  );
  const projectedDraft = useMemo(
    () => applyPracticeQuickFixes(draft, quickFixes),
    [draft, quickFixes],
  );
  const projectedAnalysis = useMemo(
    () =>
      analyzePrompt({
        prompt: projectedDraft,
        createdAt: new Date().toISOString(),
      }),
    [projectedDraft],
  );
  const projectedScore = projectedAnalysis.quality_score;
  const projectedDelta = projectedScore.value - score.value;
  const practiceSummary = useMemo(
    () => summarizePracticeHistory(practiceHistory),
    [practiceHistory],
  );

  async function copyDraft(): Promise<void> {
    const copied = await copyTextToClipboard(draft);
    if (!copied) {
      return;
    }

    const nextHistory = appendPracticeHistory(
      practiceHistory,
      createPracticeHistoryItem({ analysis }),
    );
    setPracticeHistory(nextHistory);
    writeBrowserPracticeHistory(nextHistory);
    setDraftCopied(true);
    window.setTimeout(() => setDraftCopied(false), 2500);
  }

  function markLatestOutcome(outcome: PracticeOutcome): void {
    const latestId = practiceHistory[0]?.id;
    const nextHistory = markPracticeOutcome(practiceHistory, latestId, outcome);
    setPracticeHistory(nextHistory);
    writeBrowserPracticeHistory(nextHistory);
  }

  function applyQuickFix(fix: PracticeQuickFix): void {
    setDraft((currentDraft) => appendPracticeQuickFix(currentDraft, fix));
  }

  function applyAllQuickFixes(): void {
    setDraft((currentDraft) =>
      applyPracticeQuickFixes(currentDraft, quickFixes),
    );
  }

  return (
    <div className="practice-layout">
      <section className="practice-workspace panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Prompt practice workspace</p>
            <h2>Draft the next request</h2>
            <span>
              This draft is scored locally and is not saved until you send it to
              Claude Code or Codex.
            </span>
          </div>
          <div className="practice-actions">
            <button
              className="panel-link-button"
              onClick={onMeasure}
              type="button"
            >
              <RefreshCw size={14} /> Refresh plan
            </button>
            <button
              className="primary-button"
              onClick={() => void copyDraft()}
              type="button"
            >
              <Copy size={15} />{" "}
              {draftCopied ? "Copied draft" : "Copy practice draft"}
            </button>
          </div>
        </div>

        <label className="practice-editor">
          <span>Practice draft</span>
          <textarea
            aria-label="Practice draft"
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            value={draft}
          />
        </label>
      </section>

      <aside
        className="practice-score-panel panel"
        aria-label="Live local score"
      >
        <div className="practice-score-hero">
          <span className={`score-value ${score.band}`}>{score.value}</span>
          <div>
            <p className="eyebrow">Live local score</p>
            <h2>{qualityBandLabel(score.band)}</h2>
            <small>{score.max} max · local-rules-v1</small>
          </div>
        </div>
        <div className="archive-score-meter" aria-hidden="true">
          <span style={{ width: `${Math.min(score.value, 100)}%` }} />
        </div>

        <div className="practice-checklist">
          {analysis.checklist.map((item) => (
            <div className="practice-check-row" key={item.key}>
              <span className={`quality-dot ${item.status}`} />
              <div>
                <strong>{item.label}</strong>
                <small>{item.reason}</small>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="practice-fix-panel panel">
        <div className="practice-fix-header">
          <div>
            <p className="eyebrow">One-click builder</p>
            <h2>Fix before sending</h2>
          </div>
          <button
            className="panel-link-button"
            disabled={quickFixes.length === 0}
            onClick={applyAllQuickFixes}
            type="button"
          >
            <Plus size={14} />{" "}
            {quickFixes.length === 0
              ? "All habits covered"
              : "Add all missing sections"}
          </button>
        </div>
        {quickFixes.length === 0 ? (
          <p className="muted">This draft covers the core prompt habits.</p>
        ) : (
          <>
            <div className="practice-projection">
              <span className={`score-value ${projectedScore.band}`}>
                {projectedScore.value}
              </span>
              <div>
                <strong>Projected after fixes</strong>
                <small>
                  {projectedDelta > 0
                    ? `+${projectedDelta} points if all sections are added`
                    : "No score change from available fixes"}
                </small>
              </div>
            </div>
            <div className="practice-fix-list">
              {quickFixes.map((fix) => {
                const item = missingItems.find(
                  (checkItem) => checkItem.key === fix.key,
                );

                return (
                  <div className="practice-fix-row" key={fix.key}>
                    <div>
                      <strong>{fix.label}</strong>
                      <p>{item?.suggestion ?? item?.reason ?? fix.snippet}</p>
                    </div>
                    <button
                      className="practice-fix-add"
                      onClick={() => applyQuickFix(fix)}
                      type="button"
                    >
                      <Plus size={13} /> {fix.actionLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="practice-history-panel panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">Local growth signal</p>
            <h2>Practice history</h2>
          </div>
          <span>
            {practiceSummary.count > 0
              ? formatPracticeCopyCount(practiceSummary.count)
              : "No copied drafts yet"}
          </span>
        </div>
        <PracticeHistoryChart history={practiceHistory} />
        <div className="practice-history-stats">
          <MeasurementSignal
            detail="last copied practice draft"
            label="Latest"
            value={
              practiceSummary.latestScore === undefined
                ? "-"
                : `${practiceSummary.latestScore}`
            }
          />
          <MeasurementSignal
            detail="copied draft average"
            label="Average"
            value={
              practiceSummary.count === 0
                ? "-"
                : `${practiceSummary.averageScore}`
            }
          />
          <MeasurementSignal
            detail="vs previous copied draft"
            label="Delta"
            value={formatPracticeDelta(practiceSummary.delta)}
          />
        </div>
        <p className="muted">
          Practice history stores scores and missing labels only, not draft
          text.
        </p>
        <div
          className="practice-outcome-panel"
          aria-label="Practice outcome feedback"
        >
          <div>
            <p className="eyebrow">Outcome feedback</p>
            <h3>Did the copied draft work?</h3>
          </div>
          <div className="practice-outcome-actions">
            <PracticeOutcomeButton
              active={practiceHistory[0]?.outcome === "worked"}
              disabled={practiceHistory.length === 0}
              icon={<CheckCircle2 size={14} />}
              label="Worked"
              onClick={() => markLatestOutcome("worked")}
            />
            <PracticeOutcomeButton
              active={practiceHistory[0]?.outcome === "needs_context"}
              disabled={practiceHistory.length === 0}
              icon={<CircleAlert size={14} />}
              label="Needs context"
              onClick={() => markLatestOutcome("needs_context")}
            />
            <PracticeOutcomeButton
              active={practiceHistory[0]?.outcome === "blocked"}
              disabled={practiceHistory.length === 0}
              icon={<CircleX size={14} />}
              label="Blocked"
              onClick={() => markLatestOutcome("blocked")}
            />
          </div>
          {practiceHistory.length === 0 ? (
            <p className="muted">Copy a draft before marking outcome.</p>
          ) : (
            <div className="practice-outcome-summary">
              <span>
                <strong>{practiceSummary.workedCount}</strong>
                {"Worked"}
              </span>
              <span>
                <strong>{practiceSummary.needsContextCount}</strong>
                {"Needs context"}
              </span>
              <span>
                <strong>{practiceSummary.blockedCount}</strong>
                {"Blocked"}
              </span>
              <span>
                {"Latest outcome:"}
                <strong>
                  {practiceSummary.latestOutcome
                    ? formatPracticeOutcome(practiceSummary.latestOutcome)
                    : "No outcome yet"}
                </strong>
              </span>
            </div>
          )}
        </div>
        {practiceSummary.repeatedGap && (
          <p className="practice-history-gap">
            Repeated practice gap:{" "}
            <strong>{practiceSummary.repeatedGap}</strong>
          </p>
        )}
      </section>

      <section className="practice-plan-panel panel">
        <div className="panel-heading-row">
          <h2>Practice plan</h2>
          <span>
            {archiveScore
              ? `${archiveScore.practice_plan.length} habits from archive`
              : "No archive score yet"}
          </span>
        </div>
        {archiveScore?.practice_plan.length ? (
          <div className="archive-practice-list">
            {archiveScore.practice_plan.map((item) => (
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
        ) : (
          <p className="muted">
            Evaluate the archive to load personalized practice habits.
          </p>
        )}
      </section>
    </div>
  );
}

function PracticeOutcomeButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick(): void;
}) {
  return (
    <button
      aria-pressed={active}
      className="practice-outcome-button"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function ScoresView({
  archiveScore,
  dashboard,
  loading,
  onOpenFilteredList,
  onRefreshArchiveScore,
  onSelect,
}: {
  archiveScore?: ArchiveScoreReport;
  dashboard?: QualityDashboard;
  loading: boolean;
  onOpenFilteredList(filters: PromptFilters): void;
  onRefreshArchiveScore(): void;
  onSelect(id: string): void;
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
      />
    </div>
  );
}

function InsightsView({
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
    return <div className="panel empty">Loading dashboard.</div>;
  }

  return (
    <div className="dashboard-layout">
      <section className="dashboard-grid">
        <DistributionPanel
          buckets={dashboard.distribution.by_tool}
          onBucketSelect={(bucket) =>
            onOpenFilteredList({
              tool: bucket.key,
            })
          }
          title="Tool distribution"
        />
        <DistributionPanel
          buckets={dashboard.distribution.by_project}
          onBucketSelect={(bucket) =>
            onOpenFilteredList({
              cwdPrefix: bucket.key,
            })
          }
          title="Project distribution"
        />
      </section>

      <ProjectProfilesPanel
        onOpenFilteredList={onOpenFilteredList}
        profiles={dashboard.project_profiles}
      />

      <section className="dashboard-grid wide">
        <ReuseCandidatesPanel
          dashboard={dashboard}
          onOpenFilteredList={onOpenFilteredList}
          onSelect={onSelect}
        />
        <DuplicateCandidatesPanel dashboard={dashboard} onSelect={onSelect} />
      </section>
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

function OverviewSectionCard({
  detail,
  icon,
  label,
  metric,
  metricLabel,
  onSelect,
  title,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  metric: number | string;
  metricLabel: string;
  onSelect(): void;
  title: string;
}) {
  return (
    <button className="overview-section-card" onClick={onSelect} type="button">
      <span className="overview-section-label">
        {icon}
        {label}
      </span>
      <strong>{title}</strong>
      <span>{detail}</span>
      <em>
        <strong>{metric}</strong>
        <span>{metricLabel}</span>
      </em>
    </button>
  );
}

function ReuseCandidatesPanel({
  dashboard,
  onOpenFilteredList,
  onSelect,
}: {
  dashboard: QualityDashboard;
  onOpenFilteredList(filters: PromptFilters): void;
  onSelect(id: string): void;
}) {
  return (
    <div className="panel">
      <div className="panel-heading-row">
        <h2>Reuse candidates</h2>
        {dashboard.useful_prompts.length > 0 && (
          <button
            className="panel-link-button"
            onClick={() => onOpenFilteredList({ focus: "reused" })}
            type="button"
          >
            View list
          </button>
        )}
      </div>
      <div className="useful-list">
        {dashboard.useful_prompts.length === 0 && (
          <p className="muted">Prompts you copied or saved will appear here.</p>
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
  );
}

function DuplicateCandidatesPanel({
  dashboard,
  onSelect,
}: {
  dashboard: QualityDashboard;
  onSelect(id: string): void;
}) {
  return (
    <div className="panel">
      <h2>Duplicate candidates</h2>
      <div className="duplicate-list">
        {dashboard.duplicate_prompt_groups.length === 0 && (
          <p className="muted">No prompts share the same stored body.</p>
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
  );
}

function QualityGapsPanel({
  dashboard,
  onOpenFilteredList,
}: {
  dashboard: QualityDashboard;
  onOpenFilteredList(filters: PromptFilters): void;
}) {
  return (
    <div className="panel">
      <h2>Frequent quality gaps</h2>
      <div className="gap-list">
        {dashboard.missing_items.length === 0 && (
          <p className="muted">No repeated gaps yet.</p>
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
              <p>{`missing ${item.missing} / weak ${item.weak}`}</p>
            </div>
            <span>{Math.round(item.rate * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
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

function HabitCoachPanel({
  coach,
  onOpenFilteredList,
  onSelect,
}: {
  coach: PromptHabitCoach;
  onOpenFilteredList(filters: PromptFilters): void;
  onSelect(id: string): void;
}) {
  const [briefCopied, setBriefCopied] = useState(false);
  const weaknessRate = coach.biggestWeakness
    ? Math.round(coach.biggestWeakness.rate * 100)
    : 0;
  const nextRequestBrief = useMemo(
    () => createHabitNextRequestBrief(coach),
    [coach],
  );
  const nextRequestPreview = useMemo(
    () => createHabitNextRequestBriefPreview(coach),
    [coach],
  );

  async function copyNextRequestBrief(): Promise<void> {
    const copied = await copyTextToClipboard(nextRequestBrief);
    if (!copied) {
      return;
    }

    setBriefCopied(true);
    window.setTimeout(() => setBriefCopied(false), 2500);
  }

  return (
    <section className="habit-command-center" aria-label="Prompt habit coach">
      <div className="habit-command-header">
        <div className="habit-command-title">
          <p className="eyebrow">Prompt habit coach</p>
          <h2>Prompt habit command center</h2>
        </div>
        <span className={`habit-status ${coach.status.tone}`}>
          {coach.status.label}
        </span>
      </div>

      <div className="habit-command-grid">
        <div className="habit-score-module">
          <span className={`habit-score-number ${coach.score.band}`}>
            {coach.score.value}
          </span>
          <div className="habit-score-copy">
            <strong>Your Prompt Habit Score</strong>
            <span>{`${coach.score.scoredPrompts} prompts scored / ${coach.score.max}`}</span>
            <div className="habit-score-meter" aria-hidden="true">
              <span style={{ width: `${Math.min(coach.score.value, 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="habit-command-cell">
          <div className="habit-cell-title">
            <TrendingUp size={15} />
            <strong>Progress trend</strong>
          </div>
          <p className="habit-signal">
            {coach.trend.label}
            {coach.trend.label !== "Not enough data" && (
              <span> {formatSignedNumber(coach.trend.delta)} points</span>
            )}
          </p>
          <small>{`recent ${coach.trend.currentAverage} / previous ${coach.trend.previousAverage}`}</small>
        </div>

        <div className="habit-command-cell weakness">
          <div className="habit-cell-title">
            <Target size={15} />
            <strong>Your biggest weakness</strong>
          </div>
          {coach.biggestWeakness ? (
            <>
              <p className="habit-signal">{coach.biggestWeakness.label}</p>
              <small>{`${coach.biggestWeakness.count} prompts / ${weaknessRate}%`}</small>
              <div className="habit-weakness-meter" aria-hidden="true">
                <span style={{ width: `${weaknessRate}%` }} />
              </div>
              <button
                className="habit-inline-action"
                onClick={() =>
                  onOpenFilteredList({
                    focus: "quality-gap",
                    qualityGap: coach.biggestWeakness?.key,
                  })
                }
                type="button"
              >
                View matching prompts
              </button>
            </>
          ) : (
            <p className="habit-signal">No repeated weakness yet.</p>
          )}
        </div>
      </div>

      <div className="habit-brief-bar" aria-label="Next request brief">
        <div className="habit-brief-heading">
          <div>
            <p className="eyebrow">Next request brief</p>
            <strong>Preview and copy an approval-ready coaching prompt</strong>
            <span>
              Uses score, repeated weakness, next fixes, and review target
              without prompt bodies or raw paths.
            </span>
          </div>
          <button
            className="primary-button"
            onClick={() => void copyNextRequestBrief()}
            type="button"
          >
            <Copy size={15} /> {briefCopied ? "Copied brief" : "Copy brief"}
          </button>
        </div>
        <div className="habit-brief-preview">
          <BriefPreviewItem label="Goal" value={nextRequestPreview.goal} />
          <BriefPreviewItem
            label="Weakness"
            value={nextRequestPreview.weakness}
          />
          <BriefPreviewItem
            label="First fix"
            value={nextRequestPreview.firstFix}
          />
          <BriefPreviewItem
            label="Review target"
            value={nextRequestPreview.reviewTarget}
          />
          <div className="habit-brief-preview-item sections">
            <span>Sections</span>
            <p>{nextRequestPreview.sections.join(" / ")}</p>
          </div>
        </div>
      </div>

      <div className="habit-command-main">
        <div className="habit-next-fixes">
          <div className="habit-cell-title">
            <ListChecks size={15} />
            <strong>Fix these next</strong>
          </div>
          {coach.nextFixes.length === 0 && (
            <p className="muted">No repeated habit fix is ready yet.</p>
          )}
          {coach.nextFixes.map((fix) => (
            <button
              className="habit-fix-row"
              key={fix.label}
              onClick={() =>
                onOpenFilteredList({
                  focus: "quality-gap",
                  qualityGap: fix.key,
                })
              }
              type="button"
            >
              <span>
                <strong>{fix.command}</strong>
                <small>{fix.reason}</small>
              </span>
              <em>{Math.round(fix.rate * 100)}%</em>
            </button>
          ))}
        </div>

        <div className="habit-review-queue">
          <div className="habit-cell-title">
            <FileText size={15} />
            <strong>Bad prompt review queue</strong>
          </div>
          {coach.reviewQueue.length === 0 && (
            <p className="muted">No low score prompts need review yet.</p>
          )}
          {coach.reviewQueue.map((prompt) => (
            <button
              className="habit-review-row"
              key={prompt.id}
              onClick={() => onSelect(prompt.id)}
              type="button"
            >
              <span
                className={`badge score-badge ${prompt.quality_score_band}`}
              >
                {prompt.quality_score}
              </span>
              <span>
                <strong>{prompt.project}</strong>
                <small>
                  {prompt.tool} / {formatDate(prompt.received_at)}
                </small>
                <em>
                  {prompt.reasons.length > 0
                    ? prompt.reasons.join(", ")
                    : "Open and improve"}
                </em>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="habit-pattern-note">
        <strong>{coach.patternSummary.title}</strong>
        <span>{coach.patternSummary.detail}</span>
      </div>
    </section>
  );
}

function BriefPreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="habit-brief-preview-item">
      <span>{label}</span>
      <p>{value}</p>
    </div>
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

function ProjectProfilesPanel({
  onOpenFilteredList,
  profiles,
}: {
  onOpenFilteredList(filters: PromptFilters): void;
  profiles: QualityDashboard["project_profiles"];
}) {
  return (
    <section className="panel project-profile-panel">
      <div className="panel-heading-row">
        <h2>Project quality profile</h2>
        <span>{profiles.length} projects</span>
      </div>
      <div className="project-profile-list">
        {profiles.length === 0 && (
          <p className="muted">No project quality signals yet.</p>
        )}
        {profiles.map((profile) => (
          <article className="project-profile-row" key={profile.key}>
            <div className="project-profile-main">
              <div>
                <strong>{profile.label}</strong>
                {profile.key !== profile.label && <small>{profile.key}</small>}
              </div>
              <span>{formatDate(profile.latest_received_at)}</span>
            </div>
            <div className="project-profile-metrics">
              <span>
                <strong>{profile.prompt_count}</strong>
                prompts
              </span>
              <span>
                <strong>{profile.average_quality_score}</strong>
                score
              </span>
              <span>
                <strong>{Math.round(profile.quality_gap_rate * 100)}%</strong>
                gap
              </span>
              <span>
                <strong>{profile.sensitive_count}</strong>
                redacted
              </span>
              <span>
                <strong>
                  {profile.copied_count + profile.bookmarked_count}
                </strong>
                reuse
              </span>
            </div>
            {profile.top_gap && (
              <div className="project-profile-gap">
                <span className="badge gap-badge">top gap</span>
                <strong>{profile.top_gap.label}</strong>
                <small>{profile.top_gap.count}</small>
              </div>
            )}
            <div className="project-profile-actions">
              <button
                onClick={() =>
                  onOpenFilteredList({
                    cwdPrefix: profile.key,
                  })
                }
                type="button"
              >
                View all
              </button>
              <button
                disabled={!profile.top_gap || profile.quality_gap_count === 0}
                onClick={() => {
                  if (
                    !profile.top_gap ||
                    !isQualityGapKey(profile.top_gap.key)
                  ) {
                    return;
                  }

                  onOpenFilteredList({
                    cwdPrefix: profile.key,
                    focus: "quality-gap",
                    qualityGap: profile.top_gap.key,
                  });
                }}
                type="button"
              >
                Quality gaps
              </button>
              <button
                disabled={profile.sensitive_count === 0}
                onClick={() =>
                  onOpenFilteredList({
                    cwdPrefix: profile.key,
                    isSensitive: "true",
                  })
                }
                type="button"
              >
                Sensitive
              </button>
              <button
                disabled={profile.copied_count + profile.bookmarked_count === 0}
                onClick={() =>
                  onOpenFilteredList({
                    cwdPrefix: profile.key,
                    focus: "reused",
                  })
                }
                type="button"
              >
                Reused
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TrendPanel({
  daily,
  onSelectDay,
}: {
  daily: QualityDashboard["trend"]["daily"];
  onSelectDay(date: string): void;
}) {
  return (
    <section className="panel trend-panel" aria-label="Recent quality trend">
      <div className="panel-heading-row">
        <h2>Recent quality trend</h2>
        <span>7 days</span>
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

function DistributionPanel({
  buckets,
  onBucketSelect,
  title,
}: {
  buckets: QualityDashboard["distribution"]["by_tool"];
  onBucketSelect(
    bucket: QualityDashboard["distribution"]["by_tool"][number],
  ): void;
  title: string;
}) {
  return (
    <div className="panel distribution-panel">
      <h2>{title}</h2>
      <DistributionBarChart buckets={buckets} />
      <div className="distribution-list">
        {buckets.length === 0 && <p className="muted">No data.</p>}
        {buckets.map((bucket) => (
          <button
            aria-label={`${title}: view ${bucket.count} for ${bucket.label}`}
            className="distribution-row distribution-action"
            key={bucket.key}
            onClick={() => onBucketSelect(bucket)}
          >
            <div>
              <strong>{bucket.label}</strong>
              <span>{bucket.count}</span>
            </div>
            <small>{Math.round(bucket.ratio * 100)}%</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsView({
  dashboard,
  health,
  settings,
}: {
  dashboard?: QualityDashboard;
  health?: { ok: boolean; version: string; data_dir: string };
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
          <dd>{displayLocalPath(settings?.data_dir ?? health?.data_dir)}</dd>
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
  health?: { ok: boolean; version: string; data_dir: string };
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

function qualityBandLabel(band: PromptQualityScoreBand): string {
  if (band === "excellent") return "Excellent";
  if (band === "good") return "Good";
  if (band === "needs_work") return "Needs work";
  return "Weak";
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
