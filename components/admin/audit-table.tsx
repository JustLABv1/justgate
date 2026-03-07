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
        <Card key={event.id} className="border border-slate-900/10 bg-[rgba(252,250,245,0.7)] shadow-none">
          <Card.Content className="grid gap-4 p-5 lg:grid-cols-[1fr_1.1fr_0.8fr_0.7fr_0.7fr_1.5fr] lg:items-center">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Timestamp</div>
              <div className="mt-1 text-slate-900">{new Date(event.timestamp).toLocaleString()}</div>
            </div>
            <div>
              <div className="font-medium text-slate-950">/proxy/{event.routeSlug}</div>
              <div className="text-sm text-slate-500">{event.tokenID}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Tenant</div>
              <div className="mt-1 text-slate-900">{event.tenantID}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Method</div>
              <div className="mt-1 text-slate-900">{event.method}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Status</div>
              <Chip className={event.status < 400 ? "mt-2 bg-emerald-100 text-emerald-900" : "mt-2 bg-amber-100 text-amber-900"}>
                {event.status}
              </Chip>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Upstream</div>
              <div className="mt-1 font-mono text-sm text-slate-900">{event.upstreamURL}</div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}