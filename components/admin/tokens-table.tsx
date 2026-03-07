"use client";

import { RevokeTokenButton } from "@/components/admin/revoke-token-button";
import type { TokenSummary } from "@/lib/contracts";
import { Card, Chip } from "@heroui/react";

interface TokensTableProps {
  tokens: TokenSummary[];
}

export function TokensTable({ tokens }: TokensTableProps) {
  return (
    <div className="space-y-3">
      {tokens.map((token) => (
        <Card key={token.id} className="border border-slate-900/10 bg-[rgba(252,250,245,0.7)] shadow-none">
          <Card.Content className="grid gap-4 p-5 lg:grid-cols-[1.3fr_0.9fr_1.4fr_0.9fr_1fr_0.8fr_0.7fr] lg:items-center">
            <div>
              <div className="font-medium text-slate-950">{token.name}</div>
              <div className="text-sm text-slate-500">{token.preview}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Tenant</div>
              <div className="mt-1 text-slate-900">{token.tenantID}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Scopes</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {token.scopes.map((scope) => (
                  <Chip key={scope} className="bg-slate-100 text-slate-800">{scope}</Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Expires</div>
              <div className="mt-1 text-slate-900">{new Date(token.expiresAt).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Last used</div>
              <div className="mt-1 text-slate-900">{new Date(token.lastUsedAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Status</div>
              <Chip className={token.active ? "mt-2 bg-emerald-100 text-emerald-900" : "mt-2 bg-amber-100 text-amber-900"}>
                {token.active ? "active" : "revoked"}
              </Chip>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Action</div>
              {token.active ? <div className="mt-2"><RevokeTokenButton tokenID={token.id} /></div> : <div className="mt-2 text-sm text-slate-500">Locked</div>}
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}