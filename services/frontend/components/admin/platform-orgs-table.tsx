"use client";

import type { OrgAdminSummary } from "@/lib/contracts";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface PlatformOrgsTableProps {
  orgs: OrgAdminSummary[];
}

export function PlatformOrgsTable({ orgs }: PlatformOrgsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleDelete(orgID: string) {
    const res = await fetch(`/api/admin/platform/orgs/${encodeURIComponent(orgID)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  if (orgs.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-muted-foreground">No organisations found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
            <th className="px-4 py-3 w-12" />
          </tr>
        </thead>
        <tbody>
          {orgs.map((o, i) => (
            <tr key={o.id} className={i < orgs.length - 1 ? "border-b border-border/60" : ""}>
              <td className="px-4 py-3 font-medium text-foreground">{o.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.id}</td>
              <td className="px-4 py-3 text-muted-foreground">{o.memberCount}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(o.id)}
                  className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                  title="Delete organisation"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
