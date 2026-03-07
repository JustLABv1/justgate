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
    <div className="space-y-3">
      {routes.map((route) => (
        <Card key={route.id} className="rounded-[28px] border border-border bg-background shadow-none">
          <Card.Content className="space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-muted-foreground" />
                  <span className="font-mono text-sm font-semibold text-foreground">/proxy/{route.slug}</span>
                  <Button className="h-7 min-w-7 rounded-full px-0 text-muted-foreground" onPress={() => navigator.clipboard.writeText(`/proxy/${route.slug}`)} size="sm" variant="ghost">
                    <Copy size={12} />
                  </Button>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{route.id}</div>
              </div>
              <div className="flex items-start gap-2">
                <Chip size="sm" variant="soft" color="accent" className="w-fit text-[10px] font-bold">
                  {route.requiredScope}
                </Chip>
                <UpdateRouteForm route={route} tenantIDs={tenantIDs} disabled={actionsDisabled} />
                <DeleteRouteButton routeID={route.id} disabled={actionsDisabled} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Tenant</div>
                <div className="mt-1 text-sm font-medium text-foreground">{route.tenantID}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Upstream path</div>
                <div className="mt-1 font-mono text-xs text-foreground">{route.targetPath}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Methods</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {route.methods.map((method) => (
                    <Chip key={method} className="bg-surface text-foreground ring-1 ring-border">{method}</Chip>
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
