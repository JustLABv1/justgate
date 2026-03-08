"use client";

import { DeleteRouteButton } from "@/components/admin/delete-route-button";
import { UpdateRouteForm } from "@/components/admin/update-route-form";
import type { RouteSummary } from "@/lib/contracts";
import { Button, Card } from "@heroui/react";
import { Copy, Terminal, Waypoints } from "lucide-react";

interface RoutesTableProps {
  routes: RouteSummary[];
  tenantIDs: string[];
  actionsDisabled?: boolean;
}

export function RoutesTable({ routes, tenantIDs, actionsDisabled = false }: RoutesTableProps) {
  if (routes.length === 0) {
    return (
      <div className="enterprise-empty-state">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <Waypoints size={14} />
          No routes configured
        </div>
        <div className="enterprise-empty-state__title">No public proxy entry points exist yet.</div>
        <div className="enterprise-empty-state__copy">
          Create the first route after defining a tenant boundary. Each route binds one stable /proxy slug to one tenant-specific upstream path and scope contract.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {routes.map((route, idx) => (
        <Card key={route.id} variant="transparent" className="surface-card-muted group relative overflow-hidden rounded-[22px] border-0 p-4 transition-all animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 50}ms` }}>
          <Card.Content className="relative z-10 space-y-5 p-0">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 items-center gap-2 rounded-full border border-border/80 bg-surface/90 px-3.5">
                    <Terminal size={14} className="text-muted-foreground" />
                    <span className="font-mono text-sm font-semibold tracking-tight text-foreground">/proxy/{route.slug}</span>
                  </div>
                  <Button className="h-8 w-8 min-w-8 rounded-xl border border-border/80 bg-surface px-0 text-muted-foreground transition-colors hover:bg-panel hover:text-foreground" onPress={() => navigator.clipboard.writeText(`/proxy/${route.slug}`)} size="sm" variant="ghost">
                    <Copy size={13} />
                  </Button>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                   ID: {route.id}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="rounded-full border border-border/80 bg-surface px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  {route.requiredScope}
                </div>
                <div className="mx-2 h-6 w-px bg-border/40" />
                <div className="flex gap-2">
                  <UpdateRouteForm key={`${route.id}:${route.slug}:${route.tenantID}:${route.targetPath}:${route.requiredScope}:${route.methods.join(",")}`} route={route} tenantIDs={tenantIDs} disabled={actionsDisabled} />
                  <DeleteRouteButton routeID={route.id} disabled={actionsDisabled} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-border/55 pt-3.5 md:grid-cols-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                   <div className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                   Owner Tenant
                </div>
                <div className="text-sm font-semibold tracking-tight text-foreground">{route.tenantID}</div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                   <div className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                   Upstream Interface
                </div>
                <div className="font-mono text-[12px] font-medium text-foreground truncate max-w-full">
                  {route.targetPath}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                   <div className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                   Method Filters
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {route.methods.map((method) => (
                    <div key={method} className="rounded-lg border border-border/70 bg-surface/85 px-2.5 py-1 font-mono text-[10px] font-semibold text-muted-foreground">{method}</div>
                  ))}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
