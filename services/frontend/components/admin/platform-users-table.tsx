"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { UserAdminSummary } from "@/lib/contracts";
import { Shield, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface PlatformUsersTableProps {
  users: UserAdminSummary[];
}

export function PlatformUsersTable({ users }: PlatformUsersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleDelete(userID: string) {
    const res = await fetch(`/api/admin/platform/users/${encodeURIComponent(userID)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  if (users.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-muted-foreground">No users found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auth</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
            <th className="px-4 py-3 w-12" />
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id} className={i < users.length - 1 ? "border-b border-border/60" : ""}>
              <td className="px-4 py-3 font-medium text-foreground">{u.name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
              <td className="px-4 py-3">
                {u.source === "local" || u.source === "local-admin" ? (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Local</span>
                ) : u.source === "oidc" ? (
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">OIDC</span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{u.source || "—"}</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(u.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                {u.isPlatformAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <Shield size={10} />
                    Platform Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    User
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <ConfirmDialog
                  trigger={(open) => (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={open}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      title="Delete user"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  title="Delete user?"
                  description={`Permanently delete ${u.name || u.email}? Their account and all associated data will be removed. This cannot be undone.`}
                  confirmLabel="Delete user"
                  onConfirm={() => handleDelete(u.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
