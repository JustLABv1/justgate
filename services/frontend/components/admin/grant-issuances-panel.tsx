"use client";

import type { GrantIssuance } from "@/lib/contracts";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

interface GrantIssuancesPanelProps {
  grantID: string;
}

export function GrantIssuancesPanel({ grantID }: GrantIssuancesPanelProps) {
  const [issuances, setIssuances] = useState<GrantIssuance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/grants/${encodeURIComponent(grantID)}/issuances`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setIssuances(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [grantID]);

  if (loading) {
    return (
      <div className="flex items-center justify-center px-4 py-5 text-xs text-muted-foreground">
        Loading issuance history…
      </div>
    );
  }

  if (issuances.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-5 text-xs text-muted-foreground">
        No tokens issued from this grant yet
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60 px-4 pb-2">
      <div className="flex items-center gap-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        <span className="w-36">Agent</span>
        <span className="flex-1">Token ID</span>
        <span className="w-32 text-right">Issued</span>
      </div>
      {issuances.map((item) => (
        <div key={item.id} className="flex items-center gap-2 py-2 text-xs">
          <span className="w-36 truncate font-mono text-foreground">{item.agentName}</span>
          <span className="flex flex-1 items-center gap-1 text-muted-foreground">
            <KeyRound size={10} className="shrink-0" />
            <span className="font-mono truncate">{item.tokenID.slice(0, 20)}…</span>
          </span>
          <span className="w-32 text-right text-muted-foreground/70">
            {new Date(item.issuedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ))}
    </div>
  );
}
