import type { PromptFilters } from "./api.js";
import { isQualityGapKey } from "./quality-options.js";

export type View =
  | { name: "list" }
  | { name: "detail"; id: string }
  | { name: "dashboard" }
  | { name: "coach" }
  | { name: "practice" }
  | { name: "scores" }
  | { name: "benchmark" }
  | { name: "insights" }
  | { name: "projects" }
  | { name: "mcp" }
  | { name: "exports" }
  | { name: "settings" };

export type WorkspaceSection = "coach" | "practice" | "scores" | "insights";

export function routeFromLocation(): View {
  if (window.location.pathname === "/dashboard") {
    return { name: "dashboard" };
  }

  if (window.location.pathname === "/coach") {
    return { name: "coach" };
  }

  if (window.location.pathname === "/practice") {
    return { name: "practice" };
  }

  if (window.location.pathname === "/scores") {
    return { name: "scores" };
  }

  if (window.location.pathname === "/benchmark") {
    return { name: "benchmark" };
  }

  if (window.location.pathname === "/insights") {
    return { name: "insights" };
  }

  if (window.location.pathname === "/projects") {
    return { name: "projects" };
  }

  if (window.location.pathname === "/mcp") {
    return { name: "mcp" };
  }

  if (window.location.pathname === "/exports") {
    return { name: "exports" };
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

export function needsDashboardData(viewName: View["name"]): boolean {
  return [
    "dashboard",
    "coach",
    "practice",
    "scores",
    "benchmark",
    "insights",
    "mcp",
    "exports",
    "settings",
  ].includes(viewName);
}

export function needsArchiveScoreData(viewName: View["name"]): boolean {
  return ["dashboard", "coach", "practice", "scores", "benchmark"].includes(
    viewName,
  );
}

export function filtersFromLocation(): PromptFilters {
  const params = new URLSearchParams(window.location.search);
  const isSensitive = params.get("sensitive");
  const focus = params.get("focus");
  const qualityGap = params.get("gap");

  return {
    query: params.get("q") ?? undefined,
    tool: params.get("tool") ?? undefined,
    tag: params.get("tag") ?? undefined,
    focus:
      focus === "saved" ||
      focus === "reused" ||
      focus === "duplicated" ||
      focus === "quality-gap"
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

export function writeFiltersToLocation(filters: PromptFilters): void {
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
