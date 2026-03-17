"use client";

import type { HealthHistoryEntry } from "@/lib/contracts";
import { Activity } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface HealthHistoryProps {
  routeID: string; // internal route UUID
}

export function HealthHistory({ routeID }: HealthHistoryProps) {
  const [entries, setEntries] = useState<HealthHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/admin/health-history?routeID=${encodeURIComponent(routeID)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Error ${res.status}`);
      }
      setEntries((await res.json()) as HealthHistoryEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load health history");
    } finally {
      setLoading(false);
    }
  }, [routeID]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Activity size={12} />
        Health check history
      </div>

      {loading ? (
        <div className="text-[11px] text-muted-foreground/50">Loading…</div>
      ) : error ? (
        <div className="text-[11px] text-danger">{error}</div>
      ) : entries.length === 0 ? (
        <div className="text-[11px] text-muted-foreground/50">No health checks recorded yet.</div>
      ) : (
        <div className="space-y-0.5">
          {entries.slice(0, 10).map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-[11px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: e.status === "up" ? "var(--success)" : "var(--destructive)" }}
                title={e.status}
              />
              <span className="w-7 shrink-0 font-mono tabular-nums text-muted-foreground">{e.latencyMs}ms</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground/60">
                {e.error || e.status}
              </span>
              <time className="shrink-0 text-muted-foreground/40" dateTime={e.checkedAt}>
                {new Date(e.checkedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </time>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
