"use client";

import { AuditTable } from "@/components/admin/audit-table";
import type { AuditEvent } from "@/lib/contracts";
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 15_000;

type StatusFilter = "all" | "success" | "error";

interface AuditViewProps {
  events: AuditEvent[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  initialStatusFilter?: string;
  initialTenantFilter?: string;
  initialRouteFilter?: string;
}

export function AuditView({
  events,
  page,
  pageSize,
  total,
  totalPages,
  initialStatusFilter = "all",
  initialTenantFilter = "",
  initialRouteFilter = "",
}: AuditViewProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (initialStatusFilter as StatusFilter) ?? "all",
  );
  const [tenantFilter, setTenantFilter] = useState(initialTenantFilter);
  const [routeFilter, setRouteFilter] = useState(initialRouteFilter);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function buildParams(overrides: Record<string, string> = {}) {
    const params = new URLSearchParams(window.location.search);
    const merged = { status: statusFilter, tenant: tenantFilter, route: routeFilter, ...overrides };
    params.set("page", "1");
    if (merged.status && merged.status !== "all") {
      params.set("status", merged.status);
    } else {
      params.delete("status");
    }
    if (merged.tenant) {
      params.set("tenant", merged.tenant);
    } else {
      params.delete("tenant");
    }
    if (merged.route) {
      params.set("route", merged.route);
    } else {
      params.delete("route");
    }
    return params.toString();
  }

  function applyFilter(key: string, value: string) {
    router.push(`?${buildParams({ [key]: value })}`);
  }

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setLastRefreshed(new Date());
    setTimeout(() => setIsRefreshing(false), 600);
  }, [router]);

  function goToPage(p: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  }

  useEffect(() => {
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  const hasFilters = statusFilter !== "all" || tenantFilter !== "" || routeFilter !== "";

  function clearFilters() {
    setStatusFilter("all");
    setTenantFilter("");
    setRouteFilter("");
    const params = new URLSearchParams(window.location.search);
    params.delete("status");
    params.delete("tenant");
    params.delete("route");
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  }

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const secondsAgo = Math.round((now - lastRefreshed.getTime()) / 1000);
  const refreshLabel = secondsAgo < 5 ? "Just now" : `${secondsAgo}s ago`;

  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);

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
              onClick={() => {
                setStatusFilter(val);
                applyFilter("status", val);
              }}
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

        {/* Tenant filter (text input – server-side LIKE search) */}
        <input
          type="text"
          placeholder="Filter by tenant…"
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilter("tenant", tenantFilter);
          }}
          onBlur={() => applyFilter("tenant", tenantFilter)}
          className="h-8 rounded-lg border border-border bg-panel px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground outline-none focus:border-accent"
        />

        {/* Route slug search */}
        <input
          type="text"
          placeholder="Filter by route…"
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilter("route", routeFilter);
          }}
          onBlur={() => applyFilter("route", routeFilter)}
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

      {/* Result count + pagination info */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          {total > 0
            ? `${hasFilters ? "Filtered: " : ""}${pageStart}–${pageEnd} of ${total} event${total !== 1 ? "s" : ""}`
            : "No events recorded yet"}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="flex items-center rounded-md border border-border bg-panel px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 text-[12px] text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="flex items-center rounded-md border border-border bg-panel px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-surface">
        <AuditTable events={events} />
      </div>
    </div>
  );
}

