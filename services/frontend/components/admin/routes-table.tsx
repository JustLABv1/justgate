"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DeleteRouteButton } from "@/components/admin/delete-route-button";
import { HealthHistory } from "@/components/admin/health-history";
import { RouteTester } from "@/components/admin/route-tester";
import { RouteUpstreams } from "@/components/admin/route-upstreams";
import { UpdateRouteForm } from "@/components/admin/update-route-form";
import type { RouteSummary, TenantSummary, TokenSummary } from "@/lib/contracts";
import { Button, Checkbox, Input } from "@heroui/react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  CopyPlus,
  Play,
  Search,
  Shield,
  Terminal,
  Trash2,
  Waypoints,
} from "lucide-react";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface RoutesTableProps {
  routes: RouteSummary[];
  tenants: TenantSummary[];
  tokens: TokenSummary[];
  actionsDisabled?: boolean;
  backendBaseUrl?: string;
}

type SortKey = "slug" | "tenant" | "upstream";
type SortDir = "asc" | "desc";

function ColHeader({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
  className = "",
}: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      {label}
      <ChevronDown
        size={10}
        className={`ml-0.5 transition-transform ${active ? "" : "opacity-0"} ${active && sortDir === "desc" ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export function RoutesTable({
  routes,
  tenants,
  tokens,
  actionsDisabled = false,
  backendBaseUrl,
}: RoutesTableProps) {
  const router = useRouter();
  const [expandedRouteID, setExpandedRouteID] = useState<string | null>(null);
  const [testerRouteID, setTesterRouteID] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("slug");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIDs, setSelectedIDs] = useState<Set<string>>(new Set());
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [copiedID, setCopiedID] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return routes
      .filter(
        (r) =>
          !q ||
          r.slug.toLowerCase().includes(q) ||
          r.upstreamURL.toLowerCase().includes(q) ||
          r.tenantID.toLowerCase().includes(q) ||
          r.requiredScope.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        let av = "",
          bv = "";
        if (sortKey === "slug") {
          av = a.slug;
          bv = b.slug;
        } else if (sortKey === "tenant") {
          av = a.tenantID;
          bv = b.tenantID;
        } else if (sortKey === "upstream") {
          av = a.upstreamURL;
          bv = b.upstreamURL;
        }
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [routes, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIDs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIDs.size === filtered.length) {
      setSelectedIDs(new Set());
    } else {
      setSelectedIDs(new Set(filtered.map((r) => r.id)));
    }
  }

  function copyUrl(id: string, url: string) {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedID(id);
      setTimeout(() => setCopiedID(null), 1500);
    });
  }

  async function handleDuplicate(routeID: string) {
    setDuplicating(routeID);
    setDuplicateError(null);
    try {
      const res = await fetch(`/api/admin/routes/${encodeURIComponent(routeID)}/duplicate`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setDuplicateError(body?.error ?? `Failed to duplicate route (${res.status})`);
      }
    } catch {
      setDuplicateError("Failed to duplicate route");
    } finally {
      setDuplicating(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedIDs.size === 0) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        [...selectedIDs].map((id) =>
          fetch(`/api/admin/routes/${encodeURIComponent(id)}`, { method: "DELETE" }),
        ),
      );
      setSelectedIDs(new Set());
      router.refresh();
    } finally {
      setBulkDeleting(false);
    }
  }

  if (routes.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <Waypoints size={22} />
        </div>
        <div className="empty-state__kicker">No routes configured</div>
        <div className="empty-state__title">No proxy entry points yet</div>
        <div className="empty-state__copy">
          Routes map an incoming slug to an upstream service.{" "}
          {tenants.length === 0
            ? "Create at least one tenant before adding routes."
            : "Use the New Route button above to create your first route."}
        </div>
        {tenants.length === 0 && (
          <a href="/tenants" className="empty-state__action">
            Go to Tenants <ArrowUpRight size={12} />
          </a>
        )}
      </div>
    );
  }

  const isFiltered = search.length > 0;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2.5">
        <div className="relative w-56">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
          />
          <Input
            placeholder="Search routes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-full pl-8 text-xs"
          />
        </div>
        <span className="text-[11px] text-muted-foreground">
          {isFiltered
            ? `${filtered.length} of ${routes.length} route${routes.length !== 1 ? "s" : ""}`
            : `${routes.length} route${routes.length !== 1 ? "s" : ""}`}
        </span>
        {selectedIDs.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">{selectedIDs.size} selected</span>
            <ConfirmDialog
              trigger={(open) => (
                <Button
                  size="sm"
                  variant="danger-soft"
                  isDisabled={actionsDisabled || bulkDeleting}
                  onPress={open}
                >
                  <Trash2 size={12} />
                  Delete selected
                </Button>
              )}
              title={`Delete ${selectedIDs.size} route${selectedIDs.size !== 1 ? "s" : ""}?`}
              description="This cannot be undone. All selected routes will be permanently removed from the proxy."
              confirmLabel={`Delete ${selectedIDs.size} route${selectedIDs.size !== 1 ? "s" : ""}`}
              isPending={bulkDeleting}
              onConfirm={() => void handleBulkDelete()}
            />
          </div>
        )}
      </div>

      {/* Duplicate error banner */}
      {duplicateError && (
        <div className="flex items-center gap-2 border-b border-danger/20 bg-danger/5 px-4 py-2 text-xs text-danger">
          <AlertCircle size={12} className="shrink-0" />
          {duplicateError}
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setDuplicateError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Column headers — double as sort controls */}
      <div className="flex items-center gap-4 border-b border-border/40 px-4 py-1.5">
        <Checkbox
          isSelected={selectedIDs.size === filtered.length && filtered.length > 0}
          isIndeterminate={selectedIDs.size > 0 && selectedIDs.size < filtered.length}
          onChange={() => toggleSelectAll()}
          aria-label="Select all routes"
        >
          <Checkbox.Control className="h-3.5 w-3.5">
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox>
        <ColHeader
          col="slug"
          label="Route"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          className="flex-1"
        />
        <ColHeader
          col="tenant"
          label="Tenant"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          className="w-28 hidden sm:flex"
        />
        <ColHeader
          col="upstream"
          label="Upstream"
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          className="w-24 hidden md:flex"
        />
        <span className="w-28 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Actions
        </span>
      </div>

      <div className="divide-y divide-border/40">
        {filtered.map((route, idx) => {
          const fullUrl = backendBaseUrl
            ? `${backendBaseUrl}/proxy/${route.slug}`
            : `/proxy/${route.slug}`;
          const isExpanded = expandedRouteID === route.id;
          const isTesterOpen = testerRouteID === route.id;
          const isSelected = selectedIDs.has(route.id);
          const isCopied = copiedID === route.id;

          const healthColor =
            route.circuitBreakerState === "open"
              ? "bg-danger"
              : route.circuitBreakerState === "half-open"
                ? "bg-warning"
                : "bg-success";
          const healthTitle =
            route.circuitBreakerState === "open"
              ? "Circuit breaker open — upstream failing"
              : route.circuitBreakerState === "half-open"
                ? "Circuit breaker half-open — recovering"
                : "Healthy";

          return (
            <div
              key={route.id}
              className={`group relative transition-colors first:rounded-t-[18px] last:rounded-b-[18px] animate-in fade-in duration-400 fill-mode-both ${isSelected ? "bg-primary/5" : ""}`}
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              {/* ── Main row ───────────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4 px-4 py-3.5 hover:bg-surface/40">
                <Checkbox
                  isSelected={isSelected}
                  onChange={() => toggleSelect(route.id)}
                  aria-label={`Select route ${route.slug}`}
                >
                  <Checkbox.Control className="mt-1 h-3.5 w-3.5">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox>

                {/* Left: slug + URL + details */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Row 1: health dot + slug + methods */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${healthColor}`}
                      title={healthTitle}
                    />
                    <div className="flex items-center gap-1.5 font-mono text-sm font-semibold tracking-tight text-foreground">
                      <Terminal size={13} className="shrink-0 text-muted-foreground" />
                      /proxy/{route.slug}
                    </div>
                    <div className="flex items-center gap-1">
                      {route.methods.map((method) => (
                        <span
                          key={method}
                          className="rounded-md bg-surface/90 border border-border/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground"
                        >
                          {method}
                        </span>
                      ))}
                    </div>
                    {route.circuitBreakerState === "open" && (
                      <span className="rounded-md bg-danger/10 border border-danger/20 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                        CB: OPEN
                      </span>
                    )}
                  </div>

                  {/* Row 2: full URL with copy feedback */}
                  <div className="flex items-center gap-1.5 pl-[21px]">
                    <span className="font-mono text-[11px] text-muted-foreground/60 truncate">
                      {fullUrl}
                    </span>
                    <Button
                      className="h-5 w-5 min-w-5 rounded-md px-0 text-muted-foreground/40 transition-colors hover:text-foreground"
                      onPress={() => copyUrl(route.id, fullUrl)}
                      size="sm"
                      variant="ghost"
                      aria-label={isCopied ? "Copied" : "Copy URL"}
                    >
                      {isCopied ? (
                        <Check size={10} className="text-success" />
                      ) : (
                        <Copy size={10} />
                      )}
                    </Button>
                  </div>

                  {/* Row 3: metadata inline */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-[21px] text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <ArrowRight size={10} className="text-muted-foreground/50" />
                      <span
                        className="font-mono text-foreground/80 truncate max-w-[200px]"
                        title={route.upstreamURL}
                      >
                        {route.upstreamURL}
                      </span>
                      {route.targetPath && route.targetPath !== "/" && (
                        <span className="font-mono text-foreground/60">{route.targetPath}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="h-1 w-1 rounded-full bg-border" />
                      <span>{route.tenantID}</span>
                    </span>
                    <span
                      className="flex items-center gap-1.5"
                      title="Token must carry this scope to access the route"
                    >
                      <Shield size={10} className="text-muted-foreground/50" />
                      <span className="text-muted-foreground/60">scope:</span>
                      <span>{route.requiredScope}</span>
                    </span>
                    {route.rateLimitRPM > 0 && (
                      <span
                        className="flex items-center gap-1.5"
                        title={`Rate limit: ${route.rateLimitRPM} req/min, burst ${route.rateLimitBurst}`}
                      >
                        <div className="h-1 w-1 rounded-full bg-border" />
                        <span className="text-muted-foreground/60">limit:</span>
                        <span>{route.rateLimitRPM}/min</span>
                      </span>
                    )}
                    {route.allowCIDRs && (
                      <span
                        className="flex items-center gap-1.5"
                        title={`Allow: ${route.allowCIDRs}`}
                      >
                        <div className="h-1 w-1 rounded-full bg-border" />
                        <span className="text-muted-foreground/60">allow:</span>
                        <span className="truncate max-w-[120px]">{route.allowCIDRs}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                  <Button
                    className="h-6 w-6 min-w-6 rounded-md px-0 text-muted-foreground/60 hover:text-foreground"
                    size="sm"
                    variant="ghost"
                    aria-label="Duplicate route"
                    isDisabled={actionsDisabled || duplicating === route.id}
                    onPress={() => handleDuplicate(route.id)}
                  >
                    <CopyPlus size={13} />
                  </Button>
                  <Button
                    className={`h-6 w-6 min-w-6 rounded-md px-0 transition-colors hover:text-foreground ${isTesterOpen ? "text-accent opacity-100" : "text-muted-foreground/60"}`}
                    size="sm"
                    variant="ghost"
                    aria-label={isTesterOpen ? "Close tester" : "Test route"}
                    onPress={() => {
                      const opening = !isTesterOpen;
                      setTesterRouteID(opening ? route.id : null);
                      if (opening && !isExpanded) setExpandedRouteID(route.id);
                    }}
                  >
                    <Play size={13} />
                  </Button>
                  <Button
                    className="h-6 w-6 min-w-6 rounded-md px-0 text-muted-foreground/60 hover:text-foreground"
                    size="sm"
                    variant="ghost"
                    aria-label={isExpanded ? "Collapse route details" : "Expand route details"}
                    onPress={() => {
                      const closing = isExpanded;
                      setExpandedRouteID(closing ? null : route.id);
                      if (closing) setTesterRouteID(null);
                    }}
                  >
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </Button>
                  <UpdateRouteForm
                    key={`${route.id}:${route.slug}:${route.tenantID}:${route.targetPath}:${route.requiredScope}:${route.methods.join(",")}`}
                    route={route}
                    tenants={tenants}
                    disabled={actionsDisabled}
                  />
                  <DeleteRouteButton routeID={route.id} disabled={actionsDisabled} />
                </div>
              </div>

              {/* ── Expanded section ───────────────────────────────────── */}
              {isExpanded && (
                <div className="border-t border-border/40 bg-panel/60 px-5 pb-5 pt-1">
                  {isTesterOpen ? (
                    <div className="mt-3">
                      <RouteTester
                        routes={[route]}
                        tokens={tokens.filter(
                          (t) => t.tenantID === route.tenantID && t.active,
                        )}
                        backendBaseUrl={backendBaseUrl ?? ""}
                        defaultOpen
                        defaultRouteID={route.id}
                      />
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <RouteUpstreams routeID={route.id} />
                      </div>
                      <div>
                        <div className="mt-3 space-y-3">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Health history
                          </span>
                          <HealthHistory routeID={route.id} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && search && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No routes match &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}
