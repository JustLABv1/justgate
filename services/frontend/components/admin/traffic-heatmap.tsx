"use client";

import type { TrafficHeatmapCell } from "@/lib/contracts";
import { useEffect, useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface TrafficHeatmapProps {
  days?: number;
}

export function TrafficHeatmap({ days = 7 }: TrafficHeatmapProps) {
  const [cells, setCells] = useState<TrafficHeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetch(`/api/admin/traffic/heatmap?days=${days}`)
      .then((r) => r.json())
      .then((data: TrafficHeatmapCell[]) => {
        setCells(data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load heatmap data");
        setLoading(false);
      });
  }, [days]);

  if (loading) {
    return <div className="text-[11px] text-muted-foreground/50 py-4">Loading heatmap…</div>;
  }
  if (error) {
    return <div className="text-[11px] text-danger py-4">{error}</div>;
  }

  // Build a map keyed by routeSlug → hour → count
  const routes = Array.from(new Set(cells.map((c) => c.routeSlug))).sort();
  if (routes.length === 0) {
    return <div className="text-[11px] text-muted-foreground/50 py-4">No traffic data for the selected period.</div>;
  }

  const grid = new Map<string, Map<number, number>>();
  for (const cell of cells) {
    if (!grid.has(cell.routeSlug)) grid.set(cell.routeSlug, new Map());
    grid.get(cell.routeSlug)!.set(cell.hour, cell.requestCount);
  }

  const maxCount = Math.max(1, ...cells.map((c) => c.requestCount));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[10px]" style={{ minWidth: 600 }}>
        <thead>
          <tr>
            <th className="pr-3 py-1 text-left text-muted-foreground font-medium w-[140px]">Route</th>
            {HOURS.map((h) => (
              <th
                key={h}
                className="text-center text-muted-foreground/50 font-normal pb-1"
                style={{ width: 28, minWidth: 20 }}
              >
                {h % 6 === 0 ? `${h}h` : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routes.map((slug) => (
            <tr key={slug}>
              <td
                className="pr-3 py-0.5 font-mono text-foreground/70 truncate max-w-[140px]"
                title={slug}
              >
                {slug}
              </td>
              {HOURS.map((h) => {
                const count = grid.get(slug)?.get(h) ?? 0;
                const intensity = count / maxCount;
                return (
                  <td key={h} className="p-px" title={`${slug} at ${h}:00 — ${count} req`}>
                    <div
                      className="rounded-sm transition-colors"
                      style={{
                        width: 20,
                        height: 16,
                        background: count === 0
                          ? "var(--border)"
                          : `color-mix(in oklab, var(--accent) ${Math.round(intensity * 90 + 10)}%, var(--panel))`,
                        opacity: count === 0 ? 0.3 : 1,
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground/60">
        <span>Low</span>
        {[10, 30, 55, 75, 95].map((pct) => (
          <div
            key={pct}
            className="h-3 w-5 rounded-sm"
            style={{ background: `color-mix(in oklab, var(--accent) ${pct}%, var(--panel))` }}
          />
        ))}
        <span>High</span>
        <span className="ml-2">— last {days} days, by hour of day (UTC)</span>
      </div>
    </div>
  );
}
