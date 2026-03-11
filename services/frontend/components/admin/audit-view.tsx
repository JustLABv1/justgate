"use client";

import { AuditTable } from "@/components/admin/audit-table";
import type { AuditEvent } from "@/lib/contracts";
import { RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 15_000;

type StatusFilter = "all" | "success" | "error";

interface AuditViewProps {
  events: AuditEvent[];
}

export function AuditView({ events }: AuditViewProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tenantFilter, setTenantFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function refresh() {
    setIsRefreshing(true);
    router.refresh();
    setLastRefreshed(new Date());
    setTimeout(() => setIsRefreshing(false), 600);
  }

  useEffect(() => {
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const filtered = events.filter((e) => {
    if (statusFilter === "success" && e.status >= 400) return false;
    if (statusFilter === "error" && e.status < 400) return false;
    if (tenantFilter && !e.tenantID.toLowerCase().includes(tenantFilter.toLowerCase())) return false;
    if (routeFilter && !e.routeSlug.toLowerCase().includes(routeFilter.toLowerCase())) return false;
    return true;
  });

  const hasFilters = statusFilter !== "all" || tenantFilter !== "" || routeFilter !== "";
  const uniqueTenants = Array.from(new Set(events.map((e) => e.tenantID))).sort();

  function clearFilters() {
    setStatusFilter("all");
    setTenantFilter("");
    setRouteFilter("");
  }

  const secondsAgo = Math.round((Date.now() - lastRefreshed.getTime()) / 1000);
  const refreshLabel = secondsAgo < 5 ? "Just now" : `${secondsAgo}s ago`;

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-panel p-1">
          {(["all", "success", "error"] as StatusFilter[]).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              className={`rounded-md px-3 py-1 text-[12px] font-medium capitalize transition-colors ${
                statusFilter === val
                  ? "bg-surface text-foreground shadow-[var(--field-shadow)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {val === "all" ? "All" : val === "success" ? "2xx" : "4xx / 5xx"}
            </button>
          ))}
        </div>

        {/* Tenant filter */}
        {uniqueTenants.length > 1 && (
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-panel px-2.5 text-[12px] text-foreground outline-none focus:border-accent"
          >
            <option value="">All tenants</option>
            {uniqueTenants.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        {/* Route slug search */}
        <input
          type="text"
          placeholder="Filter by route…"
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-panel px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-accent"
        />

        {/* Clear filters */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={12} />
            Clear
          </button>
        )}

        {/* Spacer + refresh status */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">
            Updated {refreshLabel}
          </span>
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            title="Refresh now"
          >
            <RefreshCw size={11} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Result count */}
      {hasFilters && (
        <div className="text-[11px] text-muted-foreground">
          Showing {filtered.length} of {events.length} event{events.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-surface">
        <AuditTable events={filtered} />
      </div>
    </div>
  );
}
