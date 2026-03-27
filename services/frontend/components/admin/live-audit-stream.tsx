"use client";

import type { AuditEvent } from "@/lib/contracts";
import { Input, ListBox, Select } from "@heroui/react";
import { Filter, Radio, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function LiveAuditStream() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [filterRoute, setFilterRoute] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "error">("all");
  const esRef = useRef<EventSource | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterRoute && !e.routeSlug.toLowerCase().includes(filterRoute.toLowerCase())) return false;
      if (filterMethod && e.method.toUpperCase() !== filterMethod.toUpperCase()) return false;
      if (filterStatus === "success" && e.status >= 400) return false;
      if (filterStatus === "error" && e.status < 400) return false;
      return true;
    });
  }, [events, filterRoute, filterMethod, filterStatus]);

  const connect = useCallback(async () => {
    if (esRef.current) return;
    try {
      const res = await fetch("/api/admin/audit/socket-info", { cache: "no-store" });
      if (!res.ok) return;
      const { token, sseUrl } = (await res.json()) as { token: string; sseUrl: string };
      const es = new EventSource(`${sseUrl}?access_token=${encodeURIComponent(token)}`);
      esRef.current = es;

      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        // EventSource will auto-reconnect; just reflect disconnected state.
      };
      es.onmessage = (msg) => {
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
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
        setConnected(false);
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
            {connected ? `${filtered.length} / ${events.length}` : "Disconnected"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setEvents([]);
            if (esRef.current) {
              esRef.current.close();
              esRef.current = null;
              setConnected(false);
            }
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
        <Filter size={11} className="shrink-0 text-muted-foreground/50" />
        <Input
          value={filterRoute}
          onChange={(e) => setFilterRoute(e.target.value)}
          placeholder="Route…"
          className="h-6 w-28 rounded border border-border bg-panel px-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
        <Select
          value={filterMethod || undefined}
          onChange={(key) => setFilterMethod(String(key ?? ""))}
        >
          <Select.Trigger className="h-6 rounded border border-border bg-panel px-2 text-[11px] text-foreground">
            <Select.Value>{filterMethod || "Method"}</Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="" textValue="Method">Method<ListBox.ItemIndicator /></ListBox.Item>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <ListBox.Item key={m} id={m} textValue={m}>{m}<ListBox.ItemIndicator /></ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          value={filterStatus}
          onChange={(key) => setFilterStatus((key ?? "all") as "all" | "success" | "error")}
        >
          <Select.Trigger className="h-6 rounded border border-border bg-panel px-2 text-[11px] text-foreground">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="all" textValue="All">All<ListBox.ItemIndicator /></ListBox.Item>
              <ListBox.Item id="success" textValue="2xx / 3xx">2xx / 3xx<ListBox.ItemIndicator /></ListBox.Item>
              <ListBox.Item id="error" textValue="4xx / 5xx">4xx / 5xx<ListBox.ItemIndicator /></ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
        {(filterRoute || filterMethod || filterStatus !== "all") && (
          <button
            type="button"
            onClick={() => { setFilterRoute(""); setFilterMethod(""); setFilterStatus("all"); }}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="max-h-[400px] divide-y divide-border/60 overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center px-4 py-12 text-xs text-muted-foreground">
            {events.length === 0 ? "Waiting for events…" : "No events match filters"}
          </div>
        ) : (
          filtered.map((event) => (
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
