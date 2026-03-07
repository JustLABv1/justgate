"use client";

import type { AuditEvent } from "@/lib/contracts";
import { Card, Chip } from "@heroui/react";

interface AuditTableProps {
  events: AuditEvent[];
}

export function AuditTable({ events }: AuditTableProps) {
  return (
    <div className="space-y-3">
      {events.map((event) => (
        <Card key={event.id} className="rounded-[28px] border border-border bg-background shadow-none">
          <Card.Content className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-foreground">/proxy/{event.routeSlug}</div>
                <div className="mt-1 text-sm text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</div>
              </div>
              <Chip className={event.status < 400 ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100" : "bg-amber-100 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"}>
                {event.status}
              </Chip>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Tenant</div>
                <div className="mt-1 text-sm text-foreground">{event.tenantID}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Token</div>
                <div className="mt-1 text-sm text-foreground">{event.tokenID}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Method</div>
                <div className="mt-1 text-sm text-foreground">{event.method}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Upstream</div>
                <div className="mt-1 font-mono text-xs text-foreground break-all">{event.upstreamURL}</div>
              </div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}