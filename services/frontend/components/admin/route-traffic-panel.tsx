"use client";

import type { TrafficStat } from "@/lib/contracts";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface RouteTrafficPanelProps {
  routeSlug: string;
}

type DataPoint = { time: string; requests: number; errors: number; avgLatency: number };

function buildSeries(stats: TrafficStat[]): DataPoint[] {
  const BUCKET_MINUTES = 5;
  const SLOTS = (24 * 60) / BUCKET_MINUTES;
  const now = new Date();
  const alignedNow = new Date(Math.floor(now.getTime() / (BUCKET_MINUTES * 60_000)) * (BUCKET_MINUTES * 60_000));

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

export function RouteTrafficPanel({ routeSlug }: RouteTrafficPanelProps) {
  const [stats, setStats] = useState<TrafficStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/traffic/route?routeSlug=${encodeURIComponent(routeSlug)}&hours=24`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStats(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [routeSlug]);

  const data = buildSeries(stats);
  const totalRequests = stats.reduce((s, d) => s + d.requestCount, 0);
  const totalErrors = stats.reduce((s, d) => s + d.errorCount, 0);
  const avgLatency = stats.length > 0
    ? Math.round(stats.reduce((s, d) => s + d.avgLatencyMs, 0) / stats.length)
    : 0;
  const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(1) : "0";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
        Loading traffic data…
      </div>
    );
  }

  if (totalRequests === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
        No traffic on <span className="mx-1 font-mono">{routeSlug}</span> in the last 24 hours
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 pb-4 pt-2">
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span><span className="font-medium text-foreground">{totalRequests.toLocaleString()}</span> requests (24h)</span>
        <span><span className={`font-medium ${totalErrors > 0 ? "text-danger" : "text-success"}`}>{errorRate}%</span> error rate</span>
        <span><span className="font-medium text-foreground">{avgLatency}ms</span> avg latency</span>
      </div>
      <div className="h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 0, left: -28, bottom: 0 }}>
            <defs>
              <linearGradient id={`rtFill-${routeSlug}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} interval={47} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              formatter={(value, name) => [value, name === "requests" ? "Requests" : "Errors"]}
            />
            <Area type="monotone" dataKey="requests" stroke="var(--accent)" fill={`url(#rtFill-${routeSlug})`} strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="errors" stroke="var(--danger)" fill="none" strokeWidth={1} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
