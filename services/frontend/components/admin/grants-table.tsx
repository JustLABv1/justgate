"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { GrantSummary } from "@/lib/contracts";
import { Activity, ArrowUpRight, Clock, Repeat, Share2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface GrantsTableProps {
  grants: GrantSummary[];
  actionsDisabled?: boolean;
}

function expiryLabel(expiresAt: string): { label: string; urgent: boolean } | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (ms < 0) return { label: "Expired", urgent: true };
  if (days <= 7) return { label: `Expires in ${days}d`, urgent: days <= 2 };
  return null;
}

function DeleteGrantButton({ grantID, disabled }: { grantID: string; disabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await fetch(`/api/admin/grants/${grantID}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      trigger={(open) => (
        <button
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger/10 hover:text-danger disabled:pointer-events-none disabled:opacity-30"
          disabled={disabled || isPending}
          onClick={open}
          title="Revoke grant"
          type="button"
        >
          <Trash2 size={13} />
        </button>
      )}
      title="Revoke provisioning grant?"
      description="Agents that haven't provisioned yet will no longer be able to use this grant. This cannot be undone."
      confirmLabel="Revoke grant"
      isPending={isPending}
      onConfirm={handleDelete}
    />
  );
}

export function GrantsTable({ grants, actionsDisabled = false }: GrantsTableProps) {
  if (grants.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <Share2 size={22} />
        </div>
        <div className="empty-state__kicker">No grants yet</div>
        <div className="empty-state__title">No provisioning grants</div>
        <div className="empty-state__copy">
          Provisioning grants let agents self-issue tokens by calling the provision endpoint. Create one to share with your fleet.
        </div>
        <a href="/tokens" className="empty-state__action">
          Go to Tokens <ArrowUpRight size={12} />
        </a>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {grants.map((grant, idx) => {
        const expiry = expiryLabel(grant.expiresAt);
        const usedUp = grant.useCount >= grant.maxUses;

        return (
          <div
            key={grant.id}
            className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-panel/50 animate-in fade-in duration-300 fill-mode-both"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              {/* Row 1: name, preview, status badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className={`h-2 w-2 shrink-0 rounded-full ${grant.active && !usedUp ? "bg-success" : "bg-muted"}`} />
                <span className="text-sm font-semibold text-foreground">{grant.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{grant.preview}</span>
                {usedUp && (
                  <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Exhausted
                  </span>
                )}
                {expiry && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${expiry.urgent ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                    {expiry.label}
                  </span>
                )}
              </div>

              {/* Row 2: tenant, expiry, uses, token TTL, scopes */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-mono">{grant.tenantID}</span>
                <span className="flex items-center gap-1.5" title={`Grant expires ${new Date(grant.expiresAt).toLocaleString()}`}>
                  <Clock size={10} className="text-muted-foreground/50" />
                  {new Date(grant.expiresAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Activity size={10} className="text-muted-foreground/50" />
                  {grant.useCount} / {grant.maxUses} uses
                </span>
                <span className="flex items-center gap-1.5">
                  <Repeat size={10} className="text-muted-foreground/50" />
                  Token TTL: {grant.tokenTTLHours}h
                </span>
                {grant.scopes.length > 0 && (
                  <span className="flex items-center gap-1">
                    {grant.scopes.map((s) => (
                      <span key={s} className="rounded bg-panel px-1.5 py-0.5 font-mono">{s}</span>
                    ))}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <DeleteGrantButton grantID={grant.id} disabled={actionsDisabled} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
