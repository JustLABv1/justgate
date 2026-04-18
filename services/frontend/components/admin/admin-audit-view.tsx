"use client";

import type { AdminAuditEvent } from "@/lib/contracts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface AdminAuditViewProps {
  events: AdminAuditEvent[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function AdminAuditView({ events, page, pageSize, total, totalPages }: AdminAuditViewProps) {
  const router = useRouter();

  function goToPage(p: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  }

  const pageStart = (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      {/* Result count */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          {total > 0 ? `${pageStart}–${pageEnd} of ${total} event${total !== 1 ? "s" : ""}` : "No admin events recorded yet"}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="flex items-center rounded-md border border-border bg-panel px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 text-[12px] text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="flex items-center rounded-md border border-border bg-panel px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        {events.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No admin activity recorded.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">Resource</th>
                <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                    {new Date(ev.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{ev.userEmail || ev.userID}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-panel border border-border px-2 py-0.5 font-medium text-foreground">
                      {ev.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {ev.resourceType}
                    {ev.resourceID ? <span className="ml-1 font-mono opacity-60">{ev.resourceID.slice(0, 8)}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-[280px] truncate" title={ev.details}>{ev.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
