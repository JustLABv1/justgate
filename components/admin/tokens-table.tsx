"use client";

import { DeleteTokenButton } from "@/components/admin/delete-token-button";
import { RevokeTokenButton } from "@/components/admin/revoke-token-button";
import type { TokenSummary } from "@/lib/contracts";
import { Card } from "@heroui/react";
import { Shield, Clock, Activity, KeyRound } from "lucide-react";

interface TokensTableProps {
  tokens: TokenSummary[];
  actionsDisabled?: boolean;
}

export function TokensTable({ tokens, actionsDisabled = false }: TokensTableProps) {
  if (tokens.length === 0) {
    return (
      <div className="enterprise-empty-state">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <KeyRound size={14} />
          No issued credentials
        </div>
        <div className="enterprise-empty-state__title">No tokens have been issued yet.</div>
        <div className="enterprise-empty-state__copy">
          Issue the first tenant-scoped credential after routes are defined. Secrets are shown once, while the control plane retains only the hashed record and metadata.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tokens.map((token, idx) => (
        <Card key={token.id} variant="transparent" className="surface-card-muted group relative overflow-hidden rounded-[22px] border-0 p-4 transition-all animate-in fade-in slide-in-from-left-4 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 40}ms` }}>
          <Card.Content className="relative z-10 p-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-[1rem] border transition-colors ${token.active ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}`}>
                  <Shield size={18} className={token.active ? "animate-pulse" : ""} />
                </div>
                <div>
                   <div className="text-base font-semibold tracking-tight text-foreground">{token.name}</div>
                   <div className="mt-0.5 font-mono text-xs font-medium text-muted-foreground">{token.preview}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col items-end gap-0.5 px-3">
                   <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Tenant anchor</div>
                   <div className="text-sm font-semibold text-foreground">{token.tenantID}</div>
                </div>
                <div className="mx-1 h-8 w-px bg-border/40" />
                <div className="flex gap-2">
                   {token.active ? <RevokeTokenButton tokenID={token.id} disabled={actionsDisabled} label="Revoke" /> : null}
                   <DeleteTokenButton tokenID={token.id} disabled={actionsDisabled} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-border/55 pt-3.5 md:grid-cols-3">
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Authorized scopes</div>
                <div className="flex flex-wrap gap-1.5">
                  {token.scopes.map((scope) => (
                    <div key={scope} className="rounded-full border border-border/70 bg-surface/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                       {scope}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Expiration</div>
                <div className={`flex items-center gap-2 text-sm font-semibold ${new Date(token.expiresAt) < new Date() ? "text-danger" : "text-foreground"}`}>
                   <Clock size={14} />
                   {new Date(token.expiresAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Last activity</div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                   <Activity size={14} className="text-muted-foreground" />
                   {new Date(token.lastUsedAt).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}