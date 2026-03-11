"use client";

import { DeleteRouteButton } from "@/components/admin/delete-route-button";
import { UpdateRouteForm } from "@/components/admin/update-route-form";
import type { RouteSummary } from "@/lib/contracts";
import { Button } from "@heroui/react";
import { ArrowRight, Copy, Shield, Terminal, Waypoints, ArrowUpRight } from "lucide-react";

interface RoutesTableProps {
  routes: RouteSummary[];
  tenantIDs: string[];
  actionsDisabled?: boolean;
  backendBaseUrl?: string;
}

export function RoutesTable({ routes, tenantIDs, actionsDisabled = false, backendBaseUrl }: RoutesTableProps) {
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

        return (
          <div
            key={route.id}
            className="group relative px-4 py-3.5 transition-colors hover:bg-surface/40 first:rounded-t-[18px] last:rounded-b-[18px] animate-in fade-in duration-400 fill-mode-both"
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div className="flex items-start justify-between gap-4">
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
                    <span className="font-mono text-foreground/80">{route.targetPath}</span>
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
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex shrink-0 items-center gap-1.5 pt-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                <UpdateRouteForm
                  key={`${route.id}:${route.slug}:${route.tenantID}:${route.targetPath}:${route.requiredScope}:${route.methods.join(",")}`}
                  route={route}
                  tenantIDs={tenantIDs}
                  disabled={actionsDisabled}
                />
                <DeleteRouteButton routeID={route.id} disabled={actionsDisabled} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
