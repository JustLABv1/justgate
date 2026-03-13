"use client";

import type { AuditEvent } from "@/lib/contracts";
import { Radio, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function LiveAuditStream() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const connect = useCallback(async () => {
    if (wsRef.current) return;
    try {
      const res = await fetch("/api/admin/audit/socket-info", { cache: "no-store" });
      if (!res.ok) return;
      const { token, wsUrl } = (await res.json()) as { token: string; wsUrl: string };
      const ws = new WebSocket(`${wsUrl}?access_token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
      };
      ws.onerror = () => {
        setConnected(false);
        ws.close();
        wsRef.current = null;
      };
      ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as AuditEvent;
          setEvents((prev) => [event, ...prev].slice(0, 200));
        } catch { /* ignore bad messages */ }
      };
    } catch { /* fetch failed */ }
  }, []);

  useEffect(() => {
    if (open) {
      connect();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [open, connect]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Radio size={12} />
        Live Stream
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${connected ? "bg-success animate-pulse" : "bg-danger"}`}
          />
          <h3 className="text-sm font-semibold text-foreground">Live Audit Stream</h3>
          <span className="text-[11px] text-muted-foreground">
            {connected ? `${events.length} events` : "Disconnected"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setEvents([]);
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="max-h-[400px] divide-y divide-border/60 overflow-y-auto"
      >
        {events.length === 0 ? (
          <div className="flex items-center justify-center px-4 py-12 text-xs text-muted-foreground">
            Waiting for events…
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 px-4 py-2.5 text-xs animate-in slide-in-from-top duration-200"
            >
              <span
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                  event.status < 400
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {event.status}
              </span>
              <span className="font-mono font-medium text-foreground">
                {event.method}
              </span>
              <span className="font-mono text-muted-foreground truncate">
                /proxy/{event.routeSlug}
              </span>
              {event.latencyMs > 0 && (
                <span className="text-muted-foreground">{event.latencyMs}ms</span>
              )}
              <span className="ml-auto text-muted-foreground/70">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
