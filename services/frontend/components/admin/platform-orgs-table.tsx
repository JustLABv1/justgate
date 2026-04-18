"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { OrgAdminSummary } from "@/lib/contracts";
import { Input } from "@heroui/react";
import { ChevronDown, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type SortKey = "name" | "members" | "createdAt";
type SortDir = "asc" | "desc";

interface OrgSortBtnProps {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}
function OrgSortBtn({ col, label, sortKey, sortDir, onSort }: OrgSortBtnProps) {
  return (
    <button type="button" onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wider transition-colors ${sortKey === col ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {label}
      {sortKey === col && <ChevronDown size={10} className={sortDir === "desc" ? "rotate-180" : ""} />}
    </button>
  );
}

interface PlatformOrgsTableProps {
  orgs: OrgAdminSummary[];
  tenantCountByOrg?: Record<string, number>;
  routeCountByOrg?: Record<string, number>;
}

export function PlatformOrgsTable({ orgs, tenantCountByOrg = {}, routeCountByOrg = {} }: PlatformOrgsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function handleDelete(orgID: string) {
    const res = await fetch(`/api/admin/platform/orgs/${encodeURIComponent(orgID)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orgs
      .filter((o) => !q || o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
      .sort((a, b) => {
        let av: string | number = "", bv: string | number = "";
        if (sortKey === "name") { av = a.name; bv = b.name; }
        else if (sortKey === "members") { av = a.memberCount; bv = b.memberCount; }
        else { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
        if (typeof av === "number" && typeof bv === "number")
          return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
  }, [orgs, search, sortKey, sortDir]);

  if (orgs.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-muted-foreground">No organisations found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <div className="relative w-52">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orgs…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            variant="secondary"
            className="h-7 w-full rounded-lg border border-border bg-background pl-7 pr-2 text-xs"
          />
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left"><OrgSortBtn col="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
            <th className="px-4 py-3 text-left"><OrgSortBtn col="members" label="Members" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usage</th>
            <th className="px-4 py-3 text-left"><OrgSortBtn col="createdAt" label="Created" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
            <th className="px-4 py-3 w-12" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((o, i) => (
            <tr key={o.id} className={i < filtered.length - 1 ? "border-b border-border/60" : ""}>
              <td className="px-4 py-3 font-medium text-foreground">{o.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{o.id}</td>
              <td className="px-4 py-3 text-muted-foreground">{o.memberCount}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {(tenantCountByOrg[o.id] ?? 0) > 0 && (
                    <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                      {tenantCountByOrg[o.id]}t
                    </span>
                  )}
                  {(routeCountByOrg[o.id] ?? 0) > 0 && (
                    <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      {routeCountByOrg[o.id]}r
                    </span>
                  )}
                  {(tenantCountByOrg[o.id] ?? 0) === 0 && (routeCountByOrg[o.id] ?? 0) === 0 && (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(o.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <ConfirmDialog
                  trigger={(open) => (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={open}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      title="Delete organisation"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  title="Delete organisation?"
                  description={`Permanently delete "${o.name}"? All members will lose access and the organisation cannot be recovered.`}
                  confirmLabel="Delete organisation"
                  onConfirm={() => handleDelete(o.id)}
                />
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                No organisations match &ldquo;{search}&rdquo;
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
