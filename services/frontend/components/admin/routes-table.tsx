"use client";

import { DeleteRouteButton } from "@/components/admin/delete-route-button";
import { HealthHistory } from "@/components/admin/health-history";
import { RouteUpstreams } from "@/components/admin/route-upstreams";
import { UpdateRouteForm } from "@/components/admin/update-route-form";
import type { RouteSummary, TenantSummary } from "@/lib/contracts";
import { Button } from "@heroui/react";
import { ArrowRight, ArrowUpRight, ChevronDown, Copy, Shield, Terminal, Waypoints } from "lucide-react";
import { useState } from "react";

interface RoutesTableProps {
  routes: RouteSummary[];
  tenants: TenantSummary[];
  actionsDisabled?: boolean;
  backendBaseUrl?: string;
}

export function RoutesTable({ routes, tenants, actionsDisabled = false, backendBaseUrl }: RoutesTableProps) {
  const [expandedRouteID, setExpandedRouteID] = useState<string | null>(null);

  if (routes.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <Waypoints size={22} />
        </div>
        <div className="empty-state__kicker">No routes configured</div>
        <div className="empty-state__title">No proxy entry points yet</div>
        <div className="empty-state__copy">
          Routes map an incoming slug to an upstream service. Create at least one tenant before adding routes.
        </div>
        <a href="/tenants" className="empty-state__action">
          Go to Tenants <ArrowUpRight size={12} />
        </a>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {routes.map((route, idx) => {
        const fullUrl = backendBaseUrl ? `${backendBaseUrl}/proxy/${route.slug}` : `/proxy/${route.slug}`;
        const isExpanded = expandedRouteID === route.id;

        return (
          <div
            key={route.id}
            className="group relative transition-colors first:rounded-t-[18px] last:rounded-b-[18px] animate-in fade-in duration-400 fill-mode-both"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            {/* ── Main row ───────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 px-4 py-3.5 hover:bg-surface/40">
              {/* Left: slug + URL + details */}
              <div className="min-w-0 flex-1 space-y-1.5">
                {/* Row 1: slug badge + methods */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-sm font-semibold tracking-tight text-foreground">
                    <Terminal size={13} className="shrink-0 text-muted-foreground" />
                    /proxy/{route.slug}
                  </div>
                  <div className="flex items-center gap-1">
                    {route.methods.map((method) => (
                      <span key={method} className="rounded-md bg-surface/90 border border-border/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                        {method}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Row 2: full URL with copy */}
                <div className="flex items-center gap-1.5 pl-[21px]">
                  <span className="font-mono text-[11px] text-muted-foreground/60 truncate">
                    {fullUrl}
                  </span>
                  <Button
                    className="h-5 w-5 min-w-5 rounded-md px-0 text-muted-foreground/40 transition-colors hover:text-foreground"
                    onPress={() => navigator.clipboard.writeText(fullUrl)}
                    size="sm"
                    variant="ghost"
                  >
                    <Copy size={10} />
                  </Button>
                </div>

                {/* Row 3: metadata inline */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-[21px] text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ArrowRight size={10} className="text-muted-foreground/50" />
                    <span className="font-mono text-foreground/80 truncate max-w-[200px]" title={route.upstreamURL}>{route.upstreamURL}</span>
                    {route.targetPath && route.targetPath !== "/" && (
                      <span className="font-mono text-foreground/60">{route.targetPath}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-border" />
                    <span>{route.tenantID}</span>
                  </span>
                  <span className="flex items-center gap-1.5" title="Token must carry this scope to access the route">
                    <Shield size={10} className="text-muted-foreground/50" />
                    <span className="text-muted-foreground/60">scope:</span>
                    <span>{route.requiredScope}</span>
                  </span>
                  {route.rateLimitRPM > 0 && (
                    <span className="flex items-center gap-1.5" title={`Rate limit: ${route.rateLimitRPM} req/min, burst ${route.rateLimitBurst}`}>
                      <div className="h-1 w-1 rounded-full bg-border" />
                      <span className="text-muted-foreground/60">limit:</span>
                      <span>{route.rateLimitRPM}/min</span>
                    </span>
                  )}
                  {route.allowCIDRs && (
                    <span className="flex items-center gap-1.5" title={`Allow: ${route.allowCIDRs}`}>
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
                  aria-label={isExpanded ? "Collapse route details" : "Expand route details"}
                  onPress={() => setExpandedRouteID(isExpanded ? null : route.id)}
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
