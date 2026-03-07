"use client";

import { DeleteTokenButton } from "@/components/admin/delete-token-button";
import { RevokeTokenButton } from "@/components/admin/revoke-token-button";
import type { TokenSummary } from "@/lib/contracts";
import { Card, Chip } from "@heroui/react";

interface TokensTableProps {
  tokens: TokenSummary[];
  actionsDisabled?: boolean;
}

export function TokensTable({ tokens, actionsDisabled = false }: TokensTableProps) {
  return (
    <div className="space-y-3">
      {tokens.map((token) => (
        <Card key={token.id} className="rounded-[28px] border border-border bg-background shadow-none">
          <Card.Content className="space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-foreground">{token.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">{token.preview}</div>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <Chip className="bg-surface text-foreground ring-1 ring-border">{token.tenantID}</Chip>
                <Chip className={token.active ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100" : "bg-amber-100 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"}>
                  {token.active ? "active" : "revoked"}
                </Chip>
                {token.active ? <RevokeTokenButton tokenID={token.id} disabled={actionsDisabled} label="Revoke" /> : null}
                <DeleteTokenButton tokenID={token.id} disabled={actionsDisabled} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-[1.5fr_0.9fr_1fr]">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Scopes</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {token.scopes.map((scope) => (
                    <Chip key={scope} className="bg-surface text-foreground ring-1 ring-border">{scope}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Expires</div>
                <div className="mt-1 text-sm text-foreground">{new Date(token.expiresAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Last used</div>
                <div className="mt-1 text-sm text-foreground">{new Date(token.lastUsedAt).toLocaleString()}</div>
              </div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}