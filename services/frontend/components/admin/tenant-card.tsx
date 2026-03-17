"use client";

import { DeleteTenantButton } from "@/components/admin/delete-tenant-button";
import { UpdateTenantForm } from "@/components/admin/update-tenant-form";
import type { TenantSummary } from "@/lib/contracts";
import { Shield } from "lucide-react";

interface TenantCardProps {
  tenant: TenantSummary;
  disabled?: boolean;
  animationDelay?: number;
}

export function TenantCard({ tenant, disabled, animationDelay = 0 }: TenantCardProps) {
  return (
    <div
      className="animate-in fade-in duration-300 fill-mode-both"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-panel/40">
        {/* Identity */}
        <div className="min-w-0 flex-1 flex items-center gap-3 overflow-hidden">
          <span className="shrink-0 font-mono text-sm font-semibold uppercase tracking-tight text-foreground">
            {tenant.tenantID}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {tenant.name}
          </span>
        </div>

        {/* Badges */}
        <div className="hidden sm:flex shrink-0 items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Shield size={9} className="text-muted-foreground/50" />
            {tenant.headerName}
          </span>
          <span className="rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {tenant.authMode}
          </span>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-50 transition-opacity group-hover:opacity-100">
          <UpdateTenantForm
            key={`${tenant.id}:${tenant.tenantID}:${tenant.headerName}:${tenant.name}`}
            disabled={disabled}
            tenant={tenant}
          />
          <DeleteTenantButton disabled={disabled} id={tenant.id} />
        </div>
      </div>
    </div>
  );
}
