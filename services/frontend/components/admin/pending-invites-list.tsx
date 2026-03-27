"use client";

import type { OrgInvite } from "@/lib/contracts";
import { Button } from "@heroui/react";
import { Clock, Link2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface PendingInvitesListProps {
  invites: OrgInvite[];
  orgID: string;
}

export function PendingInvitesList({ invites, orgID }: PendingInvitesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [now] = useState(Date.now);

  async function handleRevoke(inviteID: string) {
    const res = await fetch(
      `/api/admin/orgs/${encodeURIComponent(orgID)}/invites/${encodeURIComponent(inviteID)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  function expiresLabel(iso: string) {
    const diff = new Date(iso).getTime() - now;
    if (diff < 0) return { label: "Expired", urgent: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return { label: days === 0 ? "Expires today" : `${days}d remaining`, urgent: days < 2 };
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Pending Invites</h3>
      <div className="rounded-lg border border-border bg-surface divide-y divide-border">
        {invites.map((inv) => {
          const { label, urgent } = expiresLabel(inv.expiresAt);
          return (
            <div key={inv.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-foreground">{inv.code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${urgent ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock size={9} />
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                  <span>
                    {inv.useCount} / {inv.maxUses === 0 ? "∞" : inv.maxUses} uses
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => copyLink(inv.code)}
                  className="h-7 px-2.5 text-xs text-muted-foreground"
                  aria-label="Copy invite link"
                >
                  <Link2 size={12} />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isDisabled={isPending}
                  onPress={() => handleRevoke(inv.id)}
                  className="h-7 px-2.5"
                  aria-label="Revoke invite"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
