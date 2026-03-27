"use client";

import { DeleteTokenButton } from "@/components/admin/delete-token-button";
import { RateLimitGauge } from "@/components/admin/rate-limit-gauge";
import { RevokeTokenButton } from "@/components/admin/revoke-token-button";
import { RotateTokenButton } from "@/components/admin/rotate-token-button";
import { TokenStatsPanel } from "@/components/admin/token-stats-panel";
import type { TokenSummary } from "@/lib/contracts";
import { Button, Input } from "@heroui/react";
import {
    Activity,
    ArrowUpRight,
    BarChart2,
    ChevronDown,
    Clock,
    KeyRound,
    Search,
    Shield,
    Trash2,
    XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

type SortKey = "name" | "tenant" | "expiry" | "lastUsed";
type SortDir = "asc" | "desc";

interface TokensTableProps {
  tokens: TokenSummary[];
  actionsDisabled?: boolean;
}

export function TokensTable({ tokens, actionsDisabled = false }: TokensTableProps) {
  const router = useRouter();
  const [expandedID, setExpandedID] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIDs, setSelectedIDs] = useState<Set<string>>(new Set());
  const [bulkRevoking, setBulkRevoking] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tokens
      .filter((t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.tenantID.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q) ||
        t.scopes.some((s) => s.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        let av: string | number = "", bv: string | number = "";
        if (sortKey === "name") { av = a.name; bv = b.name; }
        else if (sortKey === "tenant") { av = a.tenantID; bv = b.tenantID; }
        else if (sortKey === "expiry") { av = new Date(a.expiresAt).getTime(); bv = new Date(b.expiresAt).getTime(); }
        else if (sortKey === "lastUsed") {
          av = a.lastUsedAt === "0001-01-01T00:00:00Z" ? 0 : new Date(a.lastUsedAt).getTime();
          bv = b.lastUsedAt === "0001-01-01T00:00:00Z" ? 0 : new Date(b.lastUsedAt).getTime();
        }
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
  }, [tokens, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  function toggleSelect(id: string) {
    setSelectedIDs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIDs.size === filtered.length) setSelectedIDs(new Set());
    else setSelectedIDs(new Set(filtered.map((t) => t.id)));
  }

  async function handleBulkRevoke() {
    if (selectedIDs.size === 0) return;
    if (!confirm(`Revoke ${selectedIDs.size} token(s)?`)) return;
    setBulkRevoking(true);
    try {
      await Promise.all(
        [...selectedIDs].map((id) =>
          fetch(`/api/admin/tokens/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ active: false }),
          })
        )
      );
      setSelectedIDs(new Set());
      router.refresh();
    } finally {
      setBulkRevoking(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedIDs.size === 0) return;
    if (!confirm(`Delete ${selectedIDs.size} token(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(
        [...selectedIDs].map((id) =>
          fetch(`/api/admin/tokens/${encodeURIComponent(id)}`, { method: "DELETE" })
        )
      );
      setSelectedIDs(new Set());
      router.refresh();
    } finally {
      setBulkDeleting(false);
    }
  }

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

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(col)}
      className={`flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
        sortKey === col ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {sortKey === col && (
        <ChevronDown size={10} className={`transition-transform ${sortDir === "desc" ? "rotate-180" : ""}`} />
      )}
    </button>
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-2.5">
        <Input
          placeholder="Search tokens…"
          value={search}
          onValueChange={setSearch}
          startContent={<Search size={13} className="text-muted-foreground" />}
          classNames={{ base: "w-56", inputWrapper: "h-7 min-h-7 text-xs" }}
          size="sm"
        />
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Sort:</span>
          <SortBtn col="name" label="Name" />
          <SortBtn col="tenant" label="Tenant" />
          <SortBtn col="expiry" label="Expiry" />
          <SortBtn col="lastUsed" label="Last Used" />
        </div>
        {selectedIDs.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground">{selectedIDs.size} selected</span>
            <Button
              size="sm"
              color="warning"
              variant="flat"
              isLoading={bulkRevoking}
              isDisabled={actionsDisabled || bulkRevoking}
              onPress={handleBulkRevoke}
              startContent={<XCircle size={12} />}
            >
              Revoke
            </Button>
            <Button
              size="sm"
              color="danger"
              variant="flat"
              isLoading={bulkDeleting}
              isDisabled={actionsDisabled || bulkDeleting}
              onPress={handleBulkDelete}
              startContent={<Trash2 size={12} />}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Column header */}
      <div className="flex items-center gap-4 border-b border-border/40 px-4 py-1.5 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded"
          checked={selectedIDs.size === filtered.length && filtered.length > 0}
          onChange={toggleSelectAll}
          aria-label="Select all tokens"
        />
        <span className="flex-1">Token</span>
        <span className="w-24">Actions</span>
      </div>

      <div className="divide-y divide-border">
        {filtered.map((token, idx) => {
          const expiry = expiryStatus(token.expiresAt);
          const lastUsed = lastUsedLabel(token.lastUsedAt);
          const neverUsed = lastUsed === "Never used";
          const isExpanded = expandedID === token.id;
          const isSelected = selectedIDs.has(token.id);

          return (
            <div
              key={token.id}
              className={`animate-in fade-in duration-300 fill-mode-both ${isSelected ? "bg-primary/5" : ""}`}
              style={{ animationDelay: `${idx * 30}ms` }}
            >
            <div className="group flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-panel/50">
              <input
                type="checkbox"
                className="mt-1 h-3.5 w-3.5 rounded"
                checked={isSelected}
                onChange={() => toggleSelect(token.id)}
                aria-label={`Select token ${token.name}`}
              />
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
                <button
                  type="button"
                  onClick={() => setExpandedID(isExpanded ? null : token.id)}
                  className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-panel hover:text-foreground"
                  title="Show usage stats"
                >
                  <BarChart2 size={11} />
                </button>
                {token.active ? <RotateTokenButton tokenID={token.id} disabled={actionsDisabled} /> : null}
                {token.active ? <RevokeTokenButton tokenID={token.id} disabled={actionsDisabled} label="Revoke" /> : null}
                <DeleteTokenButton tokenID={token.id} disabled={actionsDisabled} />
              </div>
            </div>
            {isExpanded && (
              <div className="border-t border-border/60 bg-panel/40">
                {token.rateLimitRPM > 0 && (
                  <div className="flex items-center gap-4 border-b border-border/40 px-4 py-3">
                    <RateLimitGauge rpm={token.rateLimitRPM} burst={token.rateLimitBurst} label="Token limit" />
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      <div><span className="text-foreground font-medium">{token.rateLimitRPM}</span> req / min</div>
                      <div><span className="text-foreground font-medium">{token.rateLimitBurst}</span> burst</div>
                    </div>
                  </div>
                )}
                <TokenStatsPanel tokenID={token.id} />
              </div>
            )}
            </div>
          );
        })}
        {filtered.length === 0 && search && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No tokens match &ldquo;{search}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}
