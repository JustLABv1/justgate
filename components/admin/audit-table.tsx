"use client";

import type { AuditEvent } from "@/lib/contracts";
import { Card } from "@heroui/react";
import { History, ShieldAlert } from "lucide-react";

interface AuditTableProps {
  events: AuditEvent[];
}

export function AuditTable({ events }: AuditTableProps) {
  if (events.length === 0) {
    return (
      <div className="enterprise-empty-state">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <ShieldAlert size={14} />
          No audit traffic yet
        </div>
        <div className="enterprise-empty-state__title">The audit stream is currently idle.</div>
        <div className="enterprise-empty-state__copy">
          Events appear here after authenticated calls cross the proxy boundary. Once traffic starts, this feed will show request status, route, tenant context, and upstream target metadata.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, idx) => (
        <Card key={event.id} variant="transparent" className="surface-card-muted group relative overflow-hidden rounded-[22px] border-0 p-4 transition-all animate-in fade-in slide-in-from-left-2 duration-300 fill-mode-both" style={{ animationDelay: `${idx * 20}ms` }}>
          <Card.Content className="relative z-10 p-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.9rem] border font-black text-[11px] ${event.status < 400 ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
                   {event.status}
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold tracking-tight text-foreground">/proxy/{event.routeSlug}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                     <History size={10} />
                     {new Date(event.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
              
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex flex-col items-end gap-0.5 px-3">
                    <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Tenant context</div>
                    <div className="text-xs font-semibold text-foreground">{event.tenantID}</div>
                 </div>
                 <div className="rounded-full border border-border/80 bg-surface px-3 py-1 font-mono text-[10px] font-semibold text-foreground uppercase tracking-[0.18em] shadow-[var(--field-shadow)]">
                    {event.method}
                 </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-border/55 pt-3.5 md:grid-cols-[1fr_1fr_1.5fr]">
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Credential ID</div>
                <div className="font-mono text-[11px] font-medium text-foreground truncate">{event.tokenID}</div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Upstream target</div>
                <div className="font-mono text-[11px] font-medium text-foreground truncate max-w-[200px]">{event.upstreamURL}</div>
              </div>
              <div className="flex flex-col justify-center">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/30">
                    <div className={`h-full ${event.status < 400 ? "bg-success/40" : "bg-danger/40"} w-full translate-x-[-20%] animate-pulse`} />
                 </div>
              </div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}