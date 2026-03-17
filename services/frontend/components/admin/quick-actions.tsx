"use client";

import { CreateRouteForm } from "@/components/admin/create-route-form";
import { CreateTenantForm } from "@/components/admin/create-tenant-form";
import { CreateTokenForm } from "@/components/admin/create-token-form";
import type { TenantSummary } from "@/lib/contracts";
import { Globe, Key, LayoutDashboard, Server } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface QuickActionsProps {
  tenants: TenantSummary[];
  tenantCount: number;
  routeCount: number;
  tokenCount: number;
}

const ACTION_BASE =
  "flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-panel hover:border-accent/20 whitespace-nowrap";

export function QuickActions({ tenants, tenantCount, routeCount, tokenCount }: QuickActionsProps) {
  const [openModal, setOpenModal] = useState<"tenant" | "route" | "token" | null>(null);

  return (
    <>
      {/* Controlled modal portals — no visible trigger */}
      <CreateTenantForm
        existingCount={tenantCount}
        isOpen={openModal === "tenant"}
        onOpenChange={(open) => setOpenModal(open ? "tenant" : null)}
        trigger={<></>}
      />
      <CreateRouteForm
        existingCount={routeCount}
        tenants={tenants}
        isOpen={openModal === "route"}
        onOpenChange={(open) => setOpenModal(open ? "route" : null)}
        trigger={<></>}
      />
      <CreateTokenForm
        existingCount={tokenCount}
        tenantIDs={tenants.map((t) => t.tenantID)}
        isOpen={openModal === "token"}
        onOpenChange={(open) => setOpenModal(open ? "token" : null)}
        trigger={<></>}
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" className={ACTION_BASE} onClick={() => setOpenModal("tenant")}>
          <Server size={14} className="text-muted-foreground" />
          New Tenant
        </button>

        <button type="button" className={ACTION_BASE} onClick={() => setOpenModal("route")}>
          <Globe size={14} className="text-muted-foreground" />
          New Route
        </button>

        <button type="button" className={ACTION_BASE} onClick={() => setOpenModal("token")}>
          <Key size={14} className="text-muted-foreground" />
          Issue Token
        </button>

        <Link href="/topology" className={ACTION_BASE}>
          <LayoutDashboard size={14} className="text-muted-foreground" />
          View Topology
        </Link>
      </div>
    </>
  );
}
