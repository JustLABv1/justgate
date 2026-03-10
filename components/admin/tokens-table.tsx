"use client";

import { DeleteTokenButton } from "@/components/admin/delete-token-button";
import { RevokeTokenButton } from "@/components/admin/revoke-token-button";
import type { TokenSummary } from "@/lib/contracts";
import { Shield, Clock, KeyRound } from "lucide-react";

interface TokensTableProps {
  tokens: TokenSummary[];
  actionsDisabled?: boolean;
}

export function TokensTable({ tokens, actionsDisabled = false }: TokensTableProps) {
  if (tokens.length === 0) {
    return (
      <div className="empty-state">
        <div className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <KeyRound size={14} />
          No issued credentials
        </div>
        <div className="empty-state__title">No tokens have been issued yet.</div>
        <div className="empty-state__copy">
          Issue the first tenant-scoped credential after routes are defined.
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {tokens.map((token, idx) => (
        <div
          key={token.id}
          className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-panel/50 animate-in fade-in duration-300 fill-mode-both"
          style={{ animationDelay: `${idx * 30}ms` }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${token.active ? "bg-success" : "bg-warning"}`} />
              <span className="text-sm font-semibold text-foreground">{token.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{token.preview}</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield size={10} className="text-muted-foreground/50" />
                {token.tenantID}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={10} className="text-muted-foreground/50" />
                {new Date(token.expiresAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <span className="flex items-center gap-1">
                {token.scopes.map((scope) => (
                  <span key={scope} className="rounded-md border border-border/60 bg-panel px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                    {scope}
                  </span>
                ))}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 pt-0.5 opacity-60 transition-opacity group-hover:opacity-100">
            {token.active ? <RevokeTokenButton tokenID={token.id} disabled={actionsDisabled} label="Revoke" /> : null}
            <DeleteTokenButton tokenID={token.id} disabled={actionsDisabled} />
          </div>
        </div>
      ))}
    </div>
  );
}
