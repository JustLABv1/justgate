"use client";

import { DeleteTokenButton } from "@/components/admin/delete-token-button";
import { RevokeTokenButton } from "@/components/admin/revoke-token-button";
import type { TokenSummary } from "@/lib/contracts";
import { Activity, ArrowUpRight, Clock, KeyRound, Shield } from "lucide-react";

const EXPIRY_WARNING_DAYS = 7;

function expiryStatus(expiresAt: string): { label: string; urgent: boolean } | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (ms < 0) return { label: "Expired", urgent: true };
  if (days <= EXPIRY_WARNING_DAYS) return { label: `Expires in ${days}d`, urgent: days <= 2 };
  return null;
}

function lastUsedLabel(lastUsedAt: string): string {
  if (!lastUsedAt || lastUsedAt === "0001-01-01T00:00:00Z") return "Never used";
  const ms = Date.now() - new Date(lastUsedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Used just now";
  if (mins < 60) return `Used ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Used ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Used ${days}d ago`;
}

interface TokensTableProps {
  tokens: TokenSummary[];
  actionsDisabled?: boolean;
}

export function TokensTable({ tokens, actionsDisabled = false }: TokensTableProps) {
  if (tokens.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <KeyRound size={22} />
        </div>
        <div className="empty-state__kicker">No credentials issued</div>
        <div className="empty-state__title">No tokens yet</div>
        <div className="empty-state__copy">
          Tokens are tenant-scoped credentials that authorize callers to cross the proxy boundary. Issue one after routes are defined.
        </div>
        <a href="/routes" className="empty-state__action">
          Go to Routes <ArrowUpRight size={12} />
        </a>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {tokens.map((token, idx) => {
        const expiry = expiryStatus(token.expiresAt);
        const lastUsed = lastUsedLabel(token.lastUsedAt);
        const neverUsed = lastUsed === "Never used";

        return (
          <div
            key={token.id}
            className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-panel/50 animate-in fade-in duration-300 fill-mode-both"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              {/* Row 1: status dot, name, preview, expiry warning */}
              <div className="flex flex-wrap items-center gap-2">
                <div className={`h-2 w-2 shrink-0 rounded-full ${token.active ? "bg-success" : "bg-muted"}`} />
                <span className="text-sm font-semibold text-foreground">{token.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{token.preview}</span>
                {!token.active && (
                  <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Revoked
                  </span>
                )}
                {expiry && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${expiry.urgent ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                    {expiry.label}
                  </span>
                )}
              </div>

              {/* Row 2: tenant, expiry date, last used, scopes */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield size={10} className="text-muted-foreground/50" />
                  {token.tenantID}
                </span>
                <span className="flex items-center gap-1.5" title={`Expires ${new Date(token.expiresAt).toLocaleString()}`}>
                  <Clock size={10} className="text-muted-foreground/50" />
                  {new Date(token.expiresAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className={`flex items-center gap-1.5 ${neverUsed ? "text-muted-foreground/50" : ""}`}>
                  <Activity size={10} className="text-muted-foreground/50" />
                  {lastUsed}
                </span>
                <span className="flex items-center gap-1">
                  {token.scopes.map((scope) => (
                    <span key={scope} className="rounded-md border border-border/60 bg-panel px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                      {scope}
                    </span>
                  ))}
                </span>
                {token.rateLimitRPM > 0 && (
                  <span className="flex items-center gap-1.5" title={`Rate limit: ${token.rateLimitRPM} req/min, burst ${token.rateLimitBurst}`}>
                    <div className="h-1 w-1 rounded-full bg-border" />
                    <span className="text-muted-foreground/60">limit:</span>
                    <span>{token.rateLimitRPM}/min</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 pt-0.5 opacity-60 transition-opacity group-hover:opacity-100">
              {token.active ? <RevokeTokenButton tokenID={token.id} disabled={actionsDisabled} label="Revoke" /> : null}
              <DeleteTokenButton tokenID={token.id} disabled={actionsDisabled} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
