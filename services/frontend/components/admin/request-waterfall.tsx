"use client";

import type { AuditEvent } from "@/lib/contracts";

interface RequestWaterfallProps {
  event: AuditEvent;
}

const STAGES = [
  { key: "auth", label: "Auth & validate", color: "var(--accent)" },
  { key: "proxy", label: "Upstream call", color: "var(--success)" },
] as const;

export function RequestWaterfall({ event }: RequestWaterfallProps) {
  const total = event.latencyMs;

  if (total <= 0) {
    return (
      <div className="px-4 py-3 text-[11px] text-muted-foreground/50">
        No timing data available for this request.
      </div>
    );
  }

  // Without stage breakdown, show total as a single annotated bar.
  // The bar fills proportionally — at 0ms it's minimal, at 2000ms+ it's full.
  const cappedTotal = Math.min(total, 5000);
  const barPct = Math.max(4, (cappedTotal / 5000) * 100);

  // Latency classification
  const latencyColor =
    total < 100
      ? "var(--success)"
      : total < 500
        ? "var(--warning)"
        : "var(--danger)";

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        Request timing
      </div>

      <div className="space-y-2">
        {/* Total latency bar */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Total latency</span>
            <span className="font-mono font-semibold" style={{ color: latencyColor }}>{total}ms</span>
          </div>
          <div className="relative h-5 overflow-hidden rounded-md bg-panel/60">
            <div
              className="absolute inset-y-0 left-0 rounded-md transition-all"
              style={{
                width: `${barPct}%`,
                background: latencyColor,
                opacity: 0.85,
              }}
            />
          </div>
        </div>

        {/* Upstream URL */}
        <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground/70">
          <span className="shrink-0">→</span>
          <span className="truncate font-mono">{event.upstreamURL}</span>
        </div>

        {/* Status + method + path */}
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span
            className={`rounded px-1.5 py-0.5 font-mono font-semibold ${
              event.status < 400 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {event.status}
          </span>
          <span className="rounded border border-border/60 bg-panel px-1.5 py-0.5 font-mono text-muted-foreground">
            {event.method}
          </span>
          <span className="truncate font-mono text-muted-foreground/70">
            {event.requestPath ?? `/proxy/${event.routeSlug}`}
          </span>
        </div>

        {/* Latency scale legend */}
        <div className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground/40">
          <div className="h-1.5 w-1.5 rounded-full bg-success" />
          <span>&lt;100ms fast</span>
          <span className="px-1">·</span>
          <div className="h-1.5 w-1.5 rounded-full bg-warning" />
          <span>100–500ms moderate</span>
          <span className="px-1">·</span>
          <div className="h-1.5 w-1.5 rounded-full bg-danger" />
          <span>&gt;500ms slow</span>
        </div>
      </div>
    </div>
  );
}
