"use client";

import type { TokenSummary } from "@/lib/contracts";
import { useMemo, useState } from "react";

type SortKey = "name" | "expiry" | "lastUsed" | "created";
type SortDir = "asc" | "desc";

interface GanttSortBtnProps {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}
function GanttSortBtn({ col, label, sortKey, sortDir, onSort }: GanttSortBtnProps) {
  return (
    <button type="button" onClick={() => onSort(col)}
      className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${sortKey === col ? "bg-panel text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground"}`}>
      {label}{sortKey === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
}

interface TokenLifecycleGanttProps {
  tokens: TokenSummary[];
}

function pct(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

const NEVER_USED = "0001-01-01T00:00:00Z";

export function TokenLifecycleGantt({ tokens }: TokenLifecycleGanttProps) {
  const [now] = useState(Date.now);
  const [sortKey, setSortKey] = useState<SortKey>("expiry");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

  const validTokens = useMemo(() => {
    const base = tokens.filter((t) => t.createdAt && !t.createdAt.startsWith("0001"));
    return base.sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else if (sortKey === "expiry") {
        av = new Date(a.expiresAt).getTime();
        bv = new Date(b.expiresAt).getTime();
      } else if (sortKey === "lastUsed") {
        av = a.lastUsedAt && !a.lastUsedAt.startsWith(NEVER_USED.slice(0, 7)) ? new Date(a.lastUsedAt).getTime() : 0;
        bv = b.lastUsedAt && !b.lastUsedAt.startsWith(NEVER_USED.slice(0, 7)) ? new Date(b.lastUsedAt).getTime() : 0;
      } else {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [tokens, sortKey, sortDir]);

  if (validTokens.length === 0) return null;

  const minTime = Math.min(...validTokens.map((t) => new Date(t.createdAt).getTime()));
  const maxTime = Math.max(
    now + 7 * 24 * 60 * 60 * 1000,
    ...validTokens.map((t) => new Date(t.expiresAt).getTime()),
  );

  const nowPct = pct(now, minTime, maxTime);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
  }

  return (
    <div className="space-y-2 py-2">
      {/* Sort controls */}
      <div className="flex items-center gap-1 pl-[140px] text-[10px] text-muted-foreground">
        <span>Sort:</span>
        <GanttSortBtn col="expiry" label="Expiry" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        <GanttSortBtn col="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        <GanttSortBtn col="lastUsed" label="Last used" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        <GanttSortBtn col="created" label="Created" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
      </div>

      <div className="overflow-x-auto">
        {/* Time axis */}
        <div className="relative mb-1 flex justify-between pl-[140px] pr-2 text-[9px] text-muted-foreground/50">
          <span>{formatDate(new Date(minTime).toISOString())}</span>
          <span>Today</span>
          <span>{formatDate(new Date(maxTime).toISOString())}</span>
        </div>

        {validTokens.map((token) => {
          const created = new Date(token.createdAt).getTime();
          const expires = new Date(token.expiresAt).getTime();
          const lastUsed = token.lastUsedAt && !token.lastUsedAt.startsWith(NEVER_USED.slice(0, 7))
            ? new Date(token.lastUsedAt).getTime()
            : null;

          const createdPct = pct(created, minTime, maxTime);
          const expiresPct = pct(expires, minTime, maxTime);
          const lastUsedPct = lastUsed ? pct(lastUsed, minTime, maxTime) : null;

          const isExpired = expires < now;
          const isNearExpiry = !isExpired && expires - now < 7 * 24 * 60 * 60 * 1000;

          const barColor = isExpired
            ? "var(--danger)"
            : isNearExpiry
              ? "var(--warning)"
              : token.active
                ? "var(--accent)"
                : "var(--muted)";

          return (
            <div key={token.id} className="flex items-center gap-2">
              {/* Label */}
              <div
                className="w-[136px] shrink-0 truncate pr-2 text-right text-[10px] text-muted-foreground"
                title={token.name}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${token.active ? "bg-success" : "bg-muted"}`} />
                {token.name}
              </div>

              {/* Bar track */}
              <div className="relative flex-1 h-5 rounded bg-panel/60" style={{ minWidth: 200 }}>
                {/* Active span */}
                <div
                  className="absolute inset-y-1 rounded"
                  style={{
                    left: `${createdPct}%`,
                    width: `${Math.max(0.5, expiresPct - createdPct)}%`,
                    background: barColor,
                    opacity: token.active ? 0.75 : 0.35,
                  }}
                />

                {/* Last-used marker */}
                {lastUsedPct !== null && (
                  <div
                    className="absolute inset-y-0 w-0.5 rounded-full bg-foreground/60"
                    style={{ left: `${lastUsedPct}%` }}
                    title={`Last used ${new Date(token.lastUsedAt).toLocaleString()}`}
                  />
                )}

                {/* Now marker */}
                <div
                  className="absolute inset-y-0 w-px bg-foreground/30"
                  style={{ left: `${nowPct}%` }}
                />
              </div>

              {/* Expiry label */}
              <div className={`w-[60px] shrink-0 text-[9px] ${isExpired ? "text-danger" : isNearExpiry ? "text-warning" : "text-muted-foreground/50"}`}>
                {isExpired ? "Expired" : formatDate(token.expiresAt)}
              </div>
            </div>
          );
        })}

        <div className="mt-2 flex items-center gap-3 pl-[140px] text-[9px] text-muted-foreground/40">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-accent opacity-75" /> Active</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-warning opacity-75" /> Expiring soon</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-danger opacity-75" /> Expired</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-3 bg-foreground/60" /> Last used</span>
        </div>
      </div>
    </div>
  );
}
