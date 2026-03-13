"use client";

import type { PlatformAdminSummary } from "@/lib/contracts";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface PlatformAdminsTableProps {
  admins: PlatformAdminSummary[];
}

export function PlatformAdminsTable({ admins }: PlatformAdminsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  async function handleRevoke(userID: string) {
    const res = await fetch(`/api/admin/platform/admins/${encodeURIComponent(userID)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    setGranting(true);
    setGrantError(null);
    try {
      const res = await fetch("/api/admin/platform/admins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: grantEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        setGrantError(body?.error || "Failed to grant platform admin");
      } else {
        setGrantEmail("");
        startTransition(() => router.refresh());
      }
    } catch {
      setGrantError("Network error");
    } finally {
      setGranting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleGrant} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Grant platform admin by email
          </label>
          <input
            type="email"
            required
            value={grantEmail}
            onChange={(e) => setGrantEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          type="submit"
          disabled={granting || isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Grant
        </button>
      </form>
      {grantError && (
        <p className="text-sm text-danger">{grantError}</p>
      )}

      {admins.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-surface">
          <p className="text-sm text-muted-foreground">No platform admins yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Granted By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Granted At</th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody>
              {admins.map((a, i) => (
                <tr key={a.userID} className={i < admins.length - 1 ? "border-b border-border/60" : ""}>
                  <td className="px-4 py-3 font-medium text-foreground">{a.userName || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.userEmail}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{a.grantedBy}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(a.grantedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRevoke(a.userID)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      title="Revoke platform admin"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
