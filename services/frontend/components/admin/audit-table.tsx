"use client";

import type { AuditEvent } from "@/lib/contracts";
import { ArrowUpRight, ShieldAlert } from "lucide-react";

interface AuditTableProps {
  events: AuditEvent[];
}

export function AuditTable({ events }: AuditTableProps) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <ShieldAlert size={22} />
        </div>
        <div className="empty-state__kicker">Audit stream idle</div>
        <div className="empty-state__title">No events recorded yet</div>
        <div className="empty-state__copy">
          Audit events appear here after authenticated requests cross the proxy boundary. Make a proxied call to see activity.
        </div>
        <a href="/tokens" className="empty-state__action">
          Issue a token <ArrowUpRight size={12} />
        </a>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {events.map((event, idx) => (
        <div
          key={event.id}
          className="group flex items-start gap-4 px-4 py-3 transition-colors hover:bg-panel/50 animate-in fade-in duration-200 fill-mode-both"
          style={{ animationDelay: `${idx * 15}ms` }}
        >
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${event.status < 400 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {event.status}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium text-foreground">
                {event.requestPath ? event.requestPath : `/proxy/${event.routeSlug}`}
              </span>
              <span className="rounded-md border border-border/60 bg-panel px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                {event.method}
              </span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground break-all">
              <span className="text-muted-foreground/60 mr-1">→</span>
              {event.upstreamURL}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{event.tenantID}</span>
              <span className="text-border">|</span>
              <span className="font-mono truncate max-w-[180px]">{event.tokenID}</span>
              <span className="text-border">|</span>
              <span>{new Date(event.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              {event.latencyMs > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span>{event.latencyMs}ms</span>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
