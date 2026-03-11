"use client";

import { CreateOrgModal } from "@/components/admin/create-org-modal";
import type { OrgSummary } from "@/lib/contracts";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export function OrgSwitcher() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const activeOrgId = session?.activeOrgId;
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  useEffect(() => {
    fetch("/api/admin/orgs")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrgs(data as OrgSummary[]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(e: MouseEvent) {
      // Don't close when clicking inside a portaled modal/dialog
      if ((e.target as Element).closest?.('[role="dialog"]')) return;
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  async function switchOrg(orgId: string) {
    setIsOpen(false);
    await update({ activeOrgId: orgId });
    startTransition(() => router.refresh());
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        disabled={isPending}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground disabled:opacity-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Building2 size={15} className="shrink-0" />
          <span className="truncate">{activeOrg?.name ?? "Select org…"}</span>
        </span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-overlay p-1 shadow-lg">
          {orgs.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No organisations yet.</p>
          )}
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => switchOrg(org.id)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-surface/60"
            >
              <Building2 size={14} className="shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === activeOrgId && <Check size={13} className="shrink-0 text-success" />}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <CreateOrgModal onCreated={(org) => setOrgs((prev) => [...prev, org])} />
        </div>
      )}
    </div>
  );
}
