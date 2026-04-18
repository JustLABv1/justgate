"use client";

import type { CircuitBreakerStatus, ExpiringToken } from "@/lib/contracts";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Notification {
  id: string;
  type: "token_expiring" | "circuit_breaker";
  title: string;
  body: string;
  href: string;
}

async function fetchNotifications(): Promise<Notification[]> {
  const notifications: Notification[] = [];
  try {
    const [tokensRes, cbRes] = await Promise.all([
      fetch("/api/admin/tokens/expiring?days=7", { cache: "no-store" }),
      fetch("/api/admin/circuit-breakers", { cache: "no-store" }),
    ]);

    if (tokensRes.ok) {
      const tokens = (await tokensRes.json()) as ExpiringToken[];
      for (const t of tokens.slice(0, 5)) {
        notifications.push({
          id: `token-${t.id}`,
          type: "token_expiring",
          title: `Token expiring: ${t.name}`,
          body: `Expires in ${t.daysUntilExpiry} day${t.daysUntilExpiry !== 1 ? "s" : ""}`,
          href: "/tokens",
        });
      }
    }

    if (cbRes.ok) {
      const breakers = (await cbRes.json()) as CircuitBreakerStatus[];
      for (const cb of breakers.filter((c) => c.state === "open").slice(0, 5)) {
        notifications.push({
          id: `cb-${cb.routeID}`,
          type: "circuit_breaker",
          title: `Circuit breaker open: ${cb.slug}`,
          body: `${cb.failureCount} failure${cb.failureCount !== 1 ? "s" : ""} detected`,
          href: "/routes",
        });
      }
    }
  } catch {
    // Silently ignore — notifications are best-effort
  }
  return notifications;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  // Fetch on open
  useEffect(() => {
    if (!open) return;
    fetchNotifications()
      .then(setNotifications)
      .finally(() => setLoaded(true));
  }, [open]);

  const loading = open && !loaded;
  const count = notifications.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          if (open) {
            setOpen(false);
            setLoaded(false);
          } else {
            setOpen(true);
          }
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <Bell size={16} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-warning-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-border bg-overlay py-1.5 shadow-lg backdrop-blur-sm">
          <div className="border-b border-border px-3 py-2">
            <span className="text-[12px] font-semibold text-foreground">Notifications</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : count === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No active notifications
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex flex-col gap-0.5 px-3 py-2.5 hover:bg-surface/60 transition-colors"
                >
                  <span className="text-[12px] font-medium text-foreground">{n.title}</span>
                  <span className="text-[11px] text-muted-foreground">{n.body}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
