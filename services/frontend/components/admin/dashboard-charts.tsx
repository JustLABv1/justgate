"use client";

import type { TrafficOverview, TrafficStat } from "@/lib/contracts";
import { ZoomIn } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceArea,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface DashboardChartsProps {
  stats: TrafficStat[];
  overview: TrafficOverview;
}

type DataPoint = { time: string; requests: number; errors: number; avgLatency: number };

/** Build a full 24-hour timeline with a bucket every 5 minutes (288 slots) and
 *  merge actual data into it so slots without traffic show as 0. */
function buildTimeSeries(stats: TrafficStat[]): DataPoint[] {
  const BUCKET_MINUTES = 5;
  const SLOTS = (24 * 60) / BUCKET_MINUTES; // 288

  const now = new Date();
  const alignedNow = new Date(
    Math.floor(now.getTime() / (BUCKET_MINUTES * 60_000)) * (BUCKET_MINUTES * 60_000),
  );

  const dataMap = new Map<string, { requests: number; errors: number; latencySum: number; latencyCount: number }>();
  for (const s of stats) {
    const key = new Date(s.bucket).toISOString();
    const existing = dataMap.get(key);
    if (existing) {
      existing.requests += s.requestCount;
      existing.errors += s.errorCount;
      existing.latencySum += s.avgLatencyMs * s.requestCount;
      existing.latencyCount += s.requestCount;
    } else {
      dataMap.set(key, {
        requests: s.requestCount,
        errors: s.errorCount,
        latencySum: s.avgLatencyMs * s.requestCount,
        latencyCount: s.requestCount,
      });
    }
  }

  const result: DataPoint[] = [];
  for (let i = SLOTS - 1; i >= 0; i--) {
    const slotTime = new Date(alignedNow.getTime() - i * BUCKET_MINUTES * 60_000);
    const key = slotTime.toISOString();
    const d = dataMap.get(key);
    result.push({
      time: slotTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      requests: d?.requests ?? 0,
      errors: d?.errors ?? 0,
      avgLatency: d && d.latencyCount > 0 ? Math.round(d.latencySum / d.latencyCount) : 0,
    });
  }
  return result;
}

export function DashboardCharts({ stats: initialStats, overview: initialOverview }: DashboardChartsProps) {
  const [stats, setStats] = useState<TrafficStat[]>(initialStats);
  const [overview, setOverview] = useState<TrafficOverview>(initialOverview);

  // Drag-to-zoom state
  const [zoomLeft, setZoomLeft] = useState<string | null>(null);
  const [zoomRight, setZoomRight] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomedDomain, setZoomedDomain] = useState<[number, number] | null>(null);
  const fullData = useMemo(() => buildTimeSeries(stats), [stats]);

  const visibleData = useMemo(() => {
    if (!zoomedDomain) return fullData;
    return fullData.slice(zoomedDomain[0], zoomedDomain[1] + 1);
  }, [fullData, zoomedDomain]);

  const isZoomed = zoomedDomain !== null;

  // Poll every 30 seconds for fresh data
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [statsRes, overviewRes] = await Promise.all([
          fetch("/api/admin/traffic/stats?hours=24"),
          fetch("/api/admin/traffic/overview"),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (overviewRes.ok) setOverview(await overviewRes.json());
      } catch { /* ignore network errors */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Compute how many ticks to skip so we show ~8 labels
  const tickInterval = useMemo(() => Math.max(1, Math.floor(visibleData.length / 8)), [visibleData]);

  const xAxisTick = (props: { x: number; y: number; payload: { value: string }; index: number }) => {
    if (props.index % tickInterval !== 0) return null as unknown as React.ReactElement;
    return (
      <text x={props.x} y={props.y + 10} textAnchor="middle" fontSize={11} fill="var(--color-muted-foreground)">
        {props.payload.value}
      </text>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleMouseDown(e: any) {
    if (!e?.activeLabel) return;
    setZoomLeft(e.activeLabel);
    setZoomRight(null);
    setIsDragging(true);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleMouseMove(e: any) {
    if (!isDragging || !e?.activeLabel) return;
    setZoomRight(e.activeLabel);
  }

  function handleMouseUp() {
    if (!isDragging) return;
    setIsDragging(false);

    if (zoomLeft && zoomRight && zoomLeft !== zoomRight) {
      const leftIdx = fullData.findIndex((d) => d.time === zoomLeft);
      const rightIdx = fullData.findIndex((d) => d.time === zoomRight);
      if (leftIdx !== -1 && rightIdx !== -1) {
        const lo = Math.min(leftIdx, rightIdx);
        const hi = Math.max(leftIdx, rightIdx);
        if (hi - lo >= 2) {
          setZoomedDomain([lo, hi]);
        }
      }
    }
    setZoomLeft(null);
    setZoomRight(null);
  }

  function resetZoom() {
    setZoomedDomain(null);
    setZoomLeft(null);
    setZoomRight(null);
    setIsDragging(false);
  }

  return (
    <div className="space-y-6">
      {/* ── KPI strip ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Requests (24h)", value: overview.totalRequests.toLocaleString() },
          { label: "Error Rate", value: `${overview.errorRate.toFixed(1)}%` },
          { label: "Avg Latency", value: `${Math.round(overview.avgLatencyMs)}ms` },
          { label: "Prior Requests (24h)", value: overview.priorRequests.toLocaleString() },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <span className="text-xs font-medium text-muted-foreground">
              {kpi.label}
            </span>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Request volume chart ──────────────────── */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Request Volume</h3>
          <div className="flex items-center gap-3">
            {isZoomed ? (
              <button
                type="button"
                onClick={resetZoom}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ZoomIn size={11} />
                Reset zoom
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground/60">Drag to zoom</span>
            )}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-sm bg-[var(--color-accent)] opacity-70" />
                Requests
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[var(--color-danger)]" />
                Errors
              </span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart
            data={visibleData}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ cursor: isDragging ? "crosshair" : "default" }}
          >
            <defs>
              <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="time"
              tick={xAxisTick as unknown as React.ReactElement}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              allowDecimals={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="requests"
              stroke="var(--color-accent)"
              fill="url(#reqGrad)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="errors"
              stroke="var(--color-danger)"
              fill="none"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              isAnimationActive={false}
            />
            {/* Zoom selection highlight */}
            {isDragging && zoomLeft && zoomRight && (
              <ReferenceArea
                x1={zoomLeft}
                x2={zoomRight}
                strokeOpacity={0.3}
                fill="var(--color-accent)"
                fillOpacity={0.15}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Period comparison ────────────────────── */}
      <div className="rounded-lg border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          24h vs Prior 24h
        </h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div />
          <div className="font-medium text-muted-foreground text-center">Current 24h</div>
          <div className="font-medium text-muted-foreground text-center">Prior 24h</div>
          {[
            {
              label: "Requests",
              current: overview.totalRequests.toLocaleString(),
              prior: overview.priorRequests.toLocaleString(),
            },
            {
              label: "Error Rate",
              current: `${overview.errorRate.toFixed(1)}%`,
              prior: `${overview.priorErrorRate.toFixed(1)}%`,
            },
            {
              label: "Avg Latency",
              current: `${Math.round(overview.avgLatencyMs)}ms`,
              prior: `${Math.round(overview.priorAvgLatency)}ms`,
            },
          ].map((row) => (
            <div key={row.label} className="contents">
              <div className="font-medium text-foreground">{row.label}</div>
              <div className="text-center tabular-nums text-foreground">{row.current}</div>
              <div className="text-center tabular-nums text-muted-foreground">{row.prior}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

