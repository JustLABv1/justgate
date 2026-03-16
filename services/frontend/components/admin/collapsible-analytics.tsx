"use client";

import { DashboardCharts } from "@/components/admin/dashboard-charts";
import type { TrafficOverview, TrafficStat } from "@/lib/contracts";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface CollapsibleAnalyticsProps {
  stats: TrafficStat[];
  overview: TrafficOverview;
}

export function CollapsibleAnalytics({ stats, overview }: CollapsibleAnalyticsProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-panel/60"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <BarChart3 size={11} />
          Traffic Analytics — last 24 hours
        </div>
        {open ? (
          <ChevronUp size={14} className="text-muted-foreground/60" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground/60" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <DashboardCharts stats={stats} overview={overview} />
        </div>
      )}
    </div>
  );
}
