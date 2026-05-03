import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type {
  ArchiveScoreReport,
  DistributionBucket,
  QualityDashboard,
} from "./api.js";
import type { PracticeHistoryItem } from "./practice-history.js";

const CHART_COLORS = {
  accent: "#828fff",
  accentMuted: "#5e6ad2",
  warning: "#f4b731",
  danger: "#e5484d",
  grid: "rgba(255, 255, 255, 0.08)",
  text: "#8a8f98",
  surface: "#191a1b",
};

const SCORE_BAND_COLORS: Record<string, string> = {
  excellent: "#828fff",
  good: "#5e6ad2",
  needs_work: "#f4b731",
  weak: "#e5484d",
};

export function QualityTrendChart({
  daily,
}: {
  daily: QualityDashboard["trend"]["daily"];
}) {
  const data = daily.map((day) => ({
    ...day,
    label: day.date.slice(5),
    gap_percent: Math.round(day.quality_gap_rate * 100),
  }));

  return (
    <ChartFrame
      ariaLabel="Prompt quality trend chart"
      empty={data.length === 0 ? "No trend data yet." : undefined}
    >
      {(width, height) => (
        <AreaChart
          data={data}
          height={height}
          margin={{ bottom: 0, left: -18, right: 8, top: 8 }}
          width={width}
        >
          <CartesianGrid
            stroke={CHART_COLORS.grid}
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[0, 100]}
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
            width={34}
          />
          <Tooltip
            contentStyle={{
              background: CHART_COLORS.surface,
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: 8,
              color: "#f7f8f8",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              value,
              name === "average_quality_score" ? "score" : "gap %",
            ]}
            labelFormatter={(label) => `day ${label}`}
          />
          <Area
            dataKey="average_quality_score"
            fill="rgba(130, 143, 255, 0.18)"
            isAnimationActive={false}
            name="score"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            type="monotone"
          />
          <Area
            dataKey="gap_percent"
            fill="rgba(244, 183, 49, 0.08)"
            isAnimationActive={false}
            name="gap %"
            stroke={CHART_COLORS.warning}
            strokeWidth={1.5}
            type="monotone"
          />
        </AreaChart>
      )}
    </ChartFrame>
  );
}

export function ScoreDistributionChart({
  distribution,
}: {
  distribution: ArchiveScoreReport["distribution"];
}) {
  const data = (["excellent", "good", "needs_work", "weak"] as const).map(
    (band) => ({
      band,
      label: band.replace("_", " "),
      count: distribution[band],
    }),
  );

  return (
    <ChartFrame ariaLabel="Score distribution chart" compact>
      {(width, height) => (
        <BarChart
          data={data}
          height={height}
          margin={{ bottom: 0, left: -22, right: 4, top: 8 }}
          width={width}
        >
          <CartesianGrid
            stroke={CHART_COLORS.grid}
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: CHART_COLORS.surface,
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: 8,
              color: "#f7f8f8",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" isAnimationActive={false} radius={[6, 6, 0, 0]}>
            {data.map((item) => (
              <Cell fill={SCORE_BAND_COLORS[item.band]} key={item.band} />
            ))}
          </Bar>
        </BarChart>
      )}
    </ChartFrame>
  );
}

export function GapRateChart({
  gaps,
}: {
  gaps: ArchiveScoreReport["top_gaps"];
}) {
  const data = gaps.map((gap) => ({
    ...gap,
    rate_percent: Math.round(gap.rate * 100),
  }));

  return (
    <ChartFrame
      ariaLabel="Top quality gaps chart"
      compact
      empty={data.length === 0 ? "No repeated gaps yet." : undefined}
    >
      {(width, height) => (
        <BarChart
          data={data}
          height={height}
          layout="vertical"
          margin={{ bottom: 0, left: 4, right: 18, top: 8 }}
          width={width}
        >
          <CartesianGrid
            horizontal={false}
            stroke={CHART_COLORS.grid}
            strokeDasharray="3 3"
          />
          <XAxis
            axisLine={false}
            domain={[0, 100]}
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
            type="category"
            width={126}
          />
          <Tooltip
            contentStyle={{
              background: CHART_COLORS.surface,
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: 8,
              color: "#f7f8f8",
              fontSize: 12,
            }}
            formatter={(value) => [`${value}%`, "gap rate"]}
          />
          <Bar
            dataKey="rate_percent"
            fill={CHART_COLORS.warning}
            isAnimationActive={false}
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      )}
    </ChartFrame>
  );
}

export function DistributionBarChart({
  buckets,
}: {
  buckets: DistributionBucket[];
}) {
  const data = buckets.slice(0, 8).map((bucket) => ({
    ...bucket,
    ratio_percent: Math.round(bucket.ratio * 100),
  }));

  return (
    <ChartFrame
      ariaLabel="Distribution chart"
      compact
      empty={data.length === 0 ? "No data." : undefined}
    >
      {(width, height) => (
        <BarChart
          data={data}
          height={height}
          layout="vertical"
          margin={{ bottom: 0, left: 4, right: 16, top: 8 }}
          width={width}
        >
          <CartesianGrid
            horizontal={false}
            stroke={CHART_COLORS.grid}
            strokeDasharray="3 3"
          />
          <XAxis
            allowDecimals={false}
            axisLine={false}
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
            type="category"
            width={120}
          />
          <Tooltip
            contentStyle={{
              background: CHART_COLORS.surface,
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: 8,
              color: "#f7f8f8",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              value,
              name === "count" ? "prompts" : "ratio %",
            ]}
          />
          <Bar
            dataKey="count"
            fill={CHART_COLORS.accentMuted}
            isAnimationActive={false}
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      )}
    </ChartFrame>
  );
}

export function PracticeHistoryChart({
  history,
}: {
  history: PracticeHistoryItem[];
}) {
  const data = history
    .slice()
    .reverse()
    .map((item, index) => ({
      label: `${index + 1}`,
      score: item.score.value,
    }));

  return (
    <ChartFrame
      ariaLabel="Practice score history chart"
      compact
      empty={
        data.length < 2
          ? "Copy two practice drafts to show a trend."
          : undefined
      }
    >
      {(width, height) => (
        <AreaChart
          data={data}
          height={height}
          margin={{ bottom: 0, left: -18, right: 8, top: 8 }}
          width={width}
        >
          <CartesianGrid
            stroke={CHART_COLORS.grid}
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[0, 100]}
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            tickLine={false}
            width={34}
          />
          <Tooltip
            contentStyle={{
              background: CHART_COLORS.surface,
              border: "1px solid rgba(255, 255, 255, 0.14)",
              borderRadius: 8,
              color: "#f7f8f8",
              fontSize: 12,
            }}
            formatter={(value) => [value, "score"]}
            labelFormatter={(label) => `practice ${label}`}
          />
          <Area
            dataKey="score"
            fill="rgba(130, 143, 255, 0.16)"
            isAnimationActive={false}
            name="score"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      )}
    </ChartFrame>
  );
}

function ChartFrame({
  ariaLabel,
  children,
  compact = false,
  empty,
}: {
  ariaLabel: string;
  children(width: number, height: number): ReactNode;
  compact?: boolean;
  empty?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const measure = () => {
      setSize({
        height: Math.max(0, element.clientHeight),
        width: Math.max(0, element.clientWidth),
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();

    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-label={ariaLabel}
      className={`chart-shell ${compact ? "compact" : ""}`}
      ref={ref}
    >
      {empty ? (
        <p className="muted">{empty}</p>
      ) : size.width > 0 && size.height > 0 ? (
        children(size.width, size.height)
      ) : null}
    </div>
  );
}
