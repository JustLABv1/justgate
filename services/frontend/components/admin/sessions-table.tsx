"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { AdminSession } from "@/lib/contracts";
import { Ban, Globe, Monitor, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SessionsTableProps {
  sessions: AdminSession[];
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  const router = useRouter();
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleRevoke(sessionID: string) {
    setRevoking(sessionID);
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(sessionID)}/revoke`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setRevoking(null);
    }
  }

  function deviceIcon(ua: string) {
    if (/mobile|android|iphone/i.test(ua)) return Smartphone;
    if (/bot|crawler/i.test(ua)) return Globe;
    return Monitor;
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface px-8 py-14 text-center">
        <p className="text-sm text-muted-foreground">No active sessions found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Device</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">IP Address</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Created</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Last Seen</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {sessions.map((session) => {
            const Icon = deviceIcon(session.userAgent);
            return (
              <tr key={session.id} className="transition-colors hover:bg-panel/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-muted-foreground" />
                    <span className="max-w-[200px] truncate text-xs text-muted-foreground" title={session.userAgent}>
                      {session.userAgent.slice(0, 50)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">{session.ipAddress}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(session.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(session.lastSeenAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {session.isRevoked ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                      Revoked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!session.isRevoked && (
                    <ConfirmDialog
                      trigger={(open) => (
                        <button
                          type="button"
                          onClick={open}
                          disabled={revoking === session.id}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                        >
                          <Ban size={12} />
                          {revoking === session.id ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                      title="Revoke session?"
                      description="This will immediately sign out this device. The user will need to sign in again."
                      confirmLabel="Revoke session"
                      onConfirm={() => handleRevoke(session.id)}
                      variant="warning"
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
