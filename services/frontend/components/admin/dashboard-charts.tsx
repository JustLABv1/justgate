"use client";

import type { TrafficOverview, TrafficStat } from "@/lib/contracts";
import { useMemo } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface DashboardChartsProps {
  stats: TrafficStat[];
  overview: TrafficOverview;
}

export function DashboardCharts({ stats, overview }: DashboardChartsProps) {
  const timeSeriesData = useMemo(() => {
    const buckets = new Map<
      string,
      { time: string; requests: number; errors: number; avgLatency: number }
    >();
    for (const s of stats) {
      const existing = buckets.get(s.bucket);
      if (existing) {
        existing.requests += s.requestCount;
        existing.errors += s.errorCount;
        existing.avgLatency =
          existing.requests > 0
            ? Math.round(
                (existing.avgLatency * (existing.requests - s.requestCount) +
                  s.avgLatencyMs * s.requestCount) /
                  existing.requests,
              )
            : existing.avgLatency;
      } else {
        buckets.set(s.bucket, {
          time: new Date(s.bucket).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          requests: s.requestCount,
          errors: s.errorCount,
          avgLatency: s.avgLatencyMs,
        });
      }
    }
    return Array.from(buckets.values());
  }, [stats]);

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
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          Request Volume
        </h3>
        {timeSeriesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={timeSeriesData}>
              <defs>
                <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
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
              />
              <Area
                type="monotone"
                dataKey="errors"
                stroke="var(--color-danger)"
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
            No traffic data yet
          </div>
        )}
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
