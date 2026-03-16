"use client";

import { RequestWaterfall } from "@/components/admin/request-waterfall";
import type { AuditEvent } from "@/lib/contracts";
import { ArrowUpRight, ChevronDown, ShieldAlert } from "lucide-react";
import { useState } from "react";

interface AuditTableProps {
  events: AuditEvent[];
}

export function AuditTable({ events }: AuditTableProps) {
  const [expandedID, setExpandedID] = useState<string | null>(null);

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
      {events.map((event, idx) => {
        const isExpanded = expandedID === event.id;
        return (
          <div
            key={event.id}
            className="animate-in fade-in duration-200 fill-mode-both"
            style={{ animationDelay: `${idx * 15}ms` }}
          >
            <button
              type="button"
              className="group flex w-full items-start gap-4 px-4 py-3 text-left transition-colors hover:bg-panel/50"
              onClick={() => setExpandedID(isExpanded ? null : event.id)}
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
                      <span className={event.latencyMs < 100 ? "text-success" : event.latencyMs < 500 ? "text-warning" : "text-danger"}>
                        {event.latencyMs}ms
                      </span>
                    </>
                  )}
                </div>
              </div>

              <ChevronDown
                size={13}
                className={`mt-1 shrink-0 text-muted-foreground/40 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {isExpanded && (
              <div className="border-t border-border/40 bg-panel/30">
                <RequestWaterfall event={event} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
