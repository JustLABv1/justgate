"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { UserAdminSummary } from "@/lib/contracts";
import { Input } from "@heroui/react";
import { ChevronDown, Search, Shield, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type SortKey = "name" | "email" | "createdAt";
type SortDir = "asc" | "desc";

interface UserSortBtnProps {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}
function UserSortBtn({ col, label, sortKey, sortDir, onSort }: UserSortBtnProps) {
  return (
    <button type="button" onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 text-xs font-semibold uppercase tracking-wider transition-colors ${sortKey === col ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {label}
      {sortKey === col && <ChevronDown size={10} className={sortDir === "desc" ? "rotate-180" : ""} />}
    </button>
  );
}

interface PlatformUsersTableProps {
  users: UserAdminSummary[];
}

export function PlatformUsersTable({ users }: PlatformUsersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function handleDelete(userID: string) {
    const res = await fetch(`/api/admin/platform/users/${encodeURIComponent(userID)}`, {
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
    return users
      .filter((u) => !q || (u.name ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .sort((a, b) => {
        let av: string | number = "", bv: string | number = "";
        if (sortKey === "name") { av = a.name ?? ""; bv = b.name ?? ""; }
        else if (sortKey === "email") { av = a.email; bv = b.email; }
        else { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
        if (typeof av === "number" && typeof bv === "number")
          return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
  }, [users, search, sortKey, sortDir]);

  if (users.length === 0) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-border bg-surface">
        <p className="text-sm text-muted-foreground">No users found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <div className="relative w-52">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users…"
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
            <th className="px-4 py-3 text-left"><UserSortBtn col="name" label="Name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
            <th className="px-4 py-3 text-left"><UserSortBtn col="email" label="Email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auth</th>
            <th className="px-4 py-3 text-left"><UserSortBtn col="createdAt" label="Created" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} /></th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
            <th className="px-4 py-3 w-12" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((u, i) => (
            <tr key={u.id} className={i < filtered.length - 1 ? "border-b border-border/60" : ""}>
              <td className="px-4 py-3 font-medium text-foreground">{u.name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
              <td className="px-4 py-3">
                {u.source === "local" || u.source === "local-admin" ? (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Local</span>
                ) : u.source === "oidc" ? (
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">OIDC</span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{u.source || "—"}</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(u.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                {u.isPlatformAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <Shield size={10} />
                    Platform Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    User
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <ConfirmDialog
                  trigger={(open) => (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={open}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      title="Delete user"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  title="Delete user?"
                  description={`Permanently delete ${u.name || u.email}? Their account and all associated data will be removed. This cannot be undone.`}
                  confirmLabel="Delete user"
                  onConfirm={() => handleDelete(u.id)}
                />
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                No users match &ldquo;{search}&rdquo;
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
