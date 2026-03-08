"use client";

import { DeleteRouteButton } from "@/components/admin/delete-route-button";
import { UpdateRouteForm } from "@/components/admin/update-route-form";
import type { RouteSummary } from "@/lib/contracts";
import { Button, Card, Chip } from "@heroui/react";
import { Copy, Terminal } from "lucide-react";

interface RoutesTableProps {
  routes: RouteSummary[];
  tenantIDs: string[];
  actionsDisabled?: boolean;
}

export function RoutesTable({ routes, tenantIDs, actionsDisabled = false }: RoutesTableProps) {
  return (
    <div className="space-y-4">
      {routes.map((route, idx) => (
        <Card key={route.id} variant="transparent" className={`group relative overflow-hidden rounded-3xl border border-border/40 bg-surface/30 p-6 shadow-sm transition-all hover:bg-surface/50 hover:border-accent/40 animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-both`} style={{ animationDelay: `${idx * 50}ms` }}>
          <div className="absolute right-[-20px] top-[-20px] opacity-[0.03] grayscale transition-transform hover:scale-125 lg:block">
             <Terminal size={140} />
          </div>
          
          <Card.Content className="relative z-10 p-0 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 items-center gap-2 rounded-xl border border-accent/20 bg-accent/10 px-4">
                    <Terminal size={14} className="text-accent" />
                    <span className="font-mono text-sm font-bold tracking-tight text-white italic">/proxy/{route.slug}</span>
                  </div>
                  <Button className="h-8 w-8 min-w-8 rounded-xl border border-border/40 bg-surface px-0 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-white" onPress={() => navigator.clipboard.writeText(`/proxy/${route.slug}`)} size="sm" variant="transparent">
                    <Copy size={13} />
                  </Button>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                   ID: {route.id}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="rounded-full border border-accent/30 bg-accent/5 px-4 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-accent">
                  {route.requiredScope}
                </div>
                <div className="mx-2 h-6 w-px bg-border/40" />
                <div className="flex gap-2">
                  <UpdateRouteForm route={route} tenantIDs={tenantIDs} disabled={actionsDisabled} />
                  <DeleteRouteButton routeID={route.id} disabled={actionsDisabled} />
                </div>
              </div>
            </div>

            <div className="grid gap-10 md:grid-cols-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
                   <div className="h-1 w-1 rounded-full bg-accent/60" />
                   Owner Tenant
                </div>
                <div className="text-sm font-black tracking-tight text-white">{route.tenantID}</div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
                   <div className="h-1 w-1 rounded-full bg-accent/60" />
                   Upstream Interface
                </div>
                <div className="font-mono text-[13px] font-medium text-white/90 truncate max-w-full">
                  {route.targetPath}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
                   <div className="h-1 w-1 rounded-full bg-accent/60" />
                   Method Filters
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {route.methods.map((method) => (
                    <div key={method} className="rounded-lg border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-[10px] font-bold text-muted-foreground transition-colors hover:border-accent/40 hover:text-white">{method}</div>
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
