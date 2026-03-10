"use client";

import type { AuditEvent } from "@/lib/contracts";
import { ShieldAlert } from "lucide-react";

interface AuditTableProps {
  events: AuditEvent[];
}

export function AuditTable({ events }: AuditTableProps) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <ShieldAlert size={14} />
          No audit events
        </div>
        <div className="empty-state__title">The audit stream is idle.</div>
        <div className="empty-state__copy">
          Events appear here after authenticated calls cross the proxy boundary.
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {events.map((event, idx) => (
        <div
          key={event.id}
          className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-panel/50 animate-in fade-in duration-200 fill-mode-both"
          style={{ animationDelay: `${idx * 15}ms` }}
        >
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${event.status < 400 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {event.status}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-foreground">/proxy/{event.routeSlug}</span>
              <span className="rounded-md border border-border/60 bg-panel px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                {event.method}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{event.tenantID}</span>
              <span className="text-border">|</span>
              <span className="font-mono truncate max-w-[180px]">{event.tokenID}</span>
              <span className="text-border">|</span>
              <span>{new Date(event.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
          </div>

          <div className="hidden shrink-0 font-mono text-[11px] text-muted-foreground truncate max-w-[200px] sm:block">
            {event.upstreamURL}
          </div>
        </div>
      ))}
    </div>
  );
}
