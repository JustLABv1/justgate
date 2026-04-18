"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { MemberSummary } from "@/lib/contracts";
import { Button } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface TeamMembersTableProps {
  members: MemberSummary[];
  orgID: string;
  currentUserID: string;
  isOwner: boolean;
}

export function TeamMembersTable({ members, orgID, currentUserID, isOwner }: TeamMembersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleRemove(userID: string) {
    const res = await fetch(`/api/admin/orgs/${encodeURIComponent(orgID)}/members/${encodeURIComponent(userID)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  async function handleRoleChange(userID: string, newRole: string) {
    const res = await fetch(`/api/admin/orgs/${encodeURIComponent(orgID)}/members/${encodeURIComponent(userID)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  if (members.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-muted-foreground">No members yet.</p>
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
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</th>
            {(isOwner) && (
              <th className="px-4 py-3 w-12" />
            )}
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={m.userID} className={i < members.length - 1 ? "border-b border-border/60" : ""}>
              <td className="px-4 py-3 font-medium text-foreground">{m.userName || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{m.userEmail}</td>
              <td className="px-4 py-3">
                {isOwner && m.userID !== currentUserID ? (
                  <select
                    value={m.role}
                    disabled={isPending}
                    onChange={(e) => handleRoleChange(m.userID, e.target.value)}
                    className="rounded-md border border-border bg-panel px-2 py-0.5 text-[11px] font-semibold text-foreground outline-none focus:border-accent disabled:opacity-50"
                  >
                    <option value="member">member</option>
                    <option value="owner">owner</option>
                  </select>
                ) : (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    m.role === "owner"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {m.role}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(m.joinedAt).toLocaleDateString()}
              </td>
              {(isOwner) && (
                <td className="px-4 py-3">
                  {(isOwner && m.userID !== currentUserID) && (
                    <ConfirmDialog
                      trigger={(open) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 min-w-7 rounded-md p-0 text-muted-foreground hover:text-danger"
                          isDisabled={isPending}
                          onPress={open}
                          aria-label="Remove member"
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                      title="Remove member?"
                      description={`Remove ${m.userName || m.userEmail} from this organisation? They will lose access to all its resources.`}
                      confirmLabel="Remove member"
                      onConfirm={() => handleRemove(m.userID)}
                    />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
